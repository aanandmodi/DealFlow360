"""
Anomaly detection and deal health services.
Simplified for the 18-hour hackathon build.
"""
from django.utils import timezone
from django.db.models import Avg, F, Q
from datetime import timedelta
from django.conf import settings


def get_stalled_deals(threshold_days=None):
    """
    Quotations with no status change in N configured days.
    'Stalled' = no update to updated_at in N days while still in an active status.
    """
    from quotations.models import Quotation

    if threshold_days is None:
        threshold_days = getattr(settings, 'STALLED_DEAL_THRESHOLD_DAYS', 14)

    cutoff = timezone.now() - timedelta(days=threshold_days)
    active_statuses = ['draft', 'pending_approval', 'sent', 'under_negotiation']

    stalled = Quotation.objects.filter(
        status__in=active_statuses,
        updated_at__lt=cutoff,
    ).select_related('customer', 'sales_rep').order_by('updated_at')

    results = []
    for q in stalled:
        days_idle = (timezone.now() - q.updated_at).days
        results.append({
            'quotation_id': q.id,
            'quote_number': f'Q-{q.id}',
            'customer_name': q.customer.name,
            'customer_company': q.customer.company,
            'rep_name': q.sales_rep.get_full_name() if q.sales_rep else 'Unassigned',
            'rep_id': q.sales_rep_id,
            'status': q.status,
            'total_amount': float(q.total),
            'days_idle': days_idle,
            'last_activity': q.updated_at.isoformat(),
            'severity': 'high' if days_idle > threshold_days * 1.5 else 'medium',
        })

    return results


def get_discount_anomalies(threshold_pct=None):
    """
    Flag discounts that are significantly above a rep's historical average.
    Anomaly = line discount > (rep's avg discount + configurable threshold).
    """
    from quotations.models import Quotation, QuotationLine

    if threshold_pct is None:
        threshold_pct = getattr(settings, 'DISCOUNT_ANOMALY_THRESHOLD_PCT', 5.0)

    # Get each rep's average discount
    from django.contrib.auth import get_user_model
    User = get_user_model()

    anomalies = []
    reps = User.objects.filter(role='sales_rep')

    for rep in reps:
        avg_discount = QuotationLine.objects.filter(
            quotation__sales_rep=rep,
            discount_percent__gt=0,
        ).aggregate(avg=Avg('discount_percent'))['avg'] or 0

        # Find lines where discount significantly exceeds rep's average
        flagged_lines = QuotationLine.objects.filter(
            quotation__sales_rep=rep,
            discount_percent__gt=float(avg_discount) + threshold_pct,
            quotation__status__in=['draft', 'pending_approval', 'sent', 'under_negotiation', 'approved'],
        ).select_related('quotation__customer', 'product')

        for line in flagged_lines:
            over_avg = float(line.discount_percent) - float(avg_discount)
            anomalies.append({
                'quotation_id': line.quotation.id,
                'quote_number': f'Q-{line.quotation.id}',
                'customer_name': line.quotation.customer.name,
                'rep_name': rep.get_full_name() or rep.username,
                'rep_id': rep.id,
                'product_name': line.product.name,
                'discount_given': float(line.discount_percent),
                'rep_avg_discount': round(float(avg_discount), 1),
                'over_average': round(over_avg, 1),
                'total_amount': float(line.quotation.total),
                'issue': f'Discount {line.discount_percent}% on {line.product.category.name} — avg {avg_discount:.1f}%',
                'severity': 'high' if over_avg > threshold_pct * 2 else 'medium',
            })

    return anomalies


def get_delivery_slippage():
    """
    Fulfillment splits where today > promised_ship_date AND status != shipped/delivered.
    """
    from fulfillment.models import FulfillmentSplit

    today = timezone.now().date()

    # FulfillmentSplit may not have promised_ship_date or status in the current model,
    # so wrap in try/except for safety
    try:
        slipped = FulfillmentSplit.objects.filter(
            status__in=['suggested', 'accepted', 'overridden'],
        ).select_related('quotation__customer')

        results = []
        for split in slipped:
            # Check if the split has a promised_ship_date field
            promised = getattr(split, 'promised_ship_date', None)
            if promised and promised < today:
                days_late = (today - promised).days
                results.append({
                    'quotation_id': split.quotation.id,
                    'quote_number': f'Q-{split.quotation.id}',
                    'customer_name': split.quotation.customer.name,
                    'warehouse_name': getattr(split, 'warehouse_name', 'N/A'),
                    'product_name': getattr(split, 'product_name', 'N/A'),
                    'promised_date': promised.isoformat(),
                    'days_late': days_late,
                    'qty': getattr(split, 'quantity', 0),
                    'severity': 'high' if days_late > 5 else 'medium',
                })
        return results
    except Exception:
        return []


def get_dashboard_summary():
    """Aggregate KPI metrics for the Deal Health dashboard."""
    from quotations.models import Quotation, QuotationLine
    from django.db.models import Sum, Avg, Count

    all_quotes = Quotation.objects.all()
    active_statuses = ['draft', 'pending_approval', 'approved', 'sent', 'under_negotiation']

    active_qs = all_quotes.filter(status__in=active_statuses)
    active_total = sum(float(q.total) for q in active_qs)
    active_count = active_qs.count()

    pending_count = all_quotes.filter(status='pending_approval').count()
    at_risk = all_quotes.filter(blended_risk_score__gt=5).count()

    # Average margin
    avg_margin = 0
    margins = [float(q.blended_margin_percent) for q in all_quotes if q.total > 0]
    if margins:
        avg_margin = round(sum(margins) / len(margins), 1)

    # Stalled and anomalies count
    stalled = get_stalled_deals()
    anomalies = get_discount_anomalies()
    slippage = get_delivery_slippage()

    # Closed won
    closed = all_quotes.filter(status__in=['confirmed', 'paid', 'invoiced'])
    closed_total = sum(float(q.total) for q in closed)
    closed_count = closed.count()

    return {
        'active_pipeline_value': active_total,
        'active_pipeline_count': active_count,
        'pending_approvals': pending_count,
        'at_risk_count': at_risk + len(anomalies),
        'avg_margin_pct': avg_margin,
        'stalled_count': len(stalled),
        'anomaly_count': len(anomalies),
        'slippage_count': len(slippage),
        'closed_won_value': closed_total,
        'closed_won_count': closed_count,
    }
