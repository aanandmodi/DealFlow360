from core.access import scoped_quotes
"""
Anomaly detection and deal health services.
Simplified for the 18-hour hackathon build.
"""
from django.utils import timezone
from django.db.models import Avg, F, Q
from datetime import timedelta
from django.conf import settings


def get_stalled_deals(threshold_days=None, user=None):
    """
    Quotations with no status change in N configured days.
    'Stalled' = no update to updated_at in N days while still in an active status.
    """
    from quotations.models import Quotation

    if threshold_days is None:
        threshold_days = getattr(settings, 'STALLED_DEAL_THRESHOLD_DAYS', 14)

    cutoff = timezone.now() - timedelta(days=threshold_days)
    active_statuses = ['draft', 'pending_approval', 'sent', 'under_negotiation']

    stalled = (scoped_quotes(user) if user else Quotation.objects.all()).filter(
        status__in=active_statuses,
        updated_at__lt=cutoff,
    ).select_related('customer', 'rep').order_by('updated_at')

    results = []
    for q in stalled:
        days_idle = (timezone.now() - q.updated_at).days
        results.append({
            'quotation_id': q.id,
            'quote_number': q.quote_number,
            'customer_name': q.customer.name,
            'customer_company': q.customer.company,
            'rep_name': q.rep.get_full_name() if q.rep else 'Unassigned',
            'rep_id': q.rep_id,
            'status': q.status,
            'total_amount': q.total_amount,
            'days_idle': days_idle,
            'last_activity': q.updated_at.isoformat(),
            'severity': 'high' if days_idle > threshold_days * 1.5 else 'medium',
        })

    return results


def get_discount_anomalies(threshold_pct=None, user=None):
    """
    Flag discounts that are significantly above a rep's historical average.
    """
    from quotations.models import Quotation, QuotationLine

    if threshold_pct is None:
        threshold_pct = getattr(settings, 'DISCOUNT_ANOMALY_THRESHOLD_PCT', 5.0)

    from django.contrib.auth import get_user_model
    User = get_user_model()

    anomalies = []
    reps = User.objects.filter(role='sales_rep')
    if user and user.role == 'sales_rep':
        reps = reps.filter(pk=user.pk)

    for rep in reps:
        avg_discount = QuotationLine.objects.filter(
            quotation__rep=rep,
            discount_pct__gt=0,
        ).aggregate(avg=Avg('discount_pct'))['avg'] or 0

        flagged_lines = QuotationLine.objects.filter(
            quotation__rep=rep,
            discount_pct__gt=float(avg_discount) + threshold_pct,
            quotation__status__in=['draft', 'pending_approval', 'sent', 'under_negotiation', 'approved'],
        ).select_related('quotation__customer', 'product')

        for line in flagged_lines:
            over_avg = float(line.discount_pct) - float(avg_discount)
            anomalies.append({
                'quotation_id': line.quotation.id,
                'quote_number': line.quotation.quote_number,
                'customer_name': line.quotation.customer.name,
                'rep_name': rep.get_full_name() or rep.username,
                'rep_id': rep.id,
                'product_name': line.product.name,
                'discount_given': float(line.discount_pct),
                'rep_avg_discount': round(float(avg_discount), 1),
                'over_average': round(over_avg, 1),
                'total_amount': line.quotation.total_amount,
                'issue': f'Discount {line.discount_pct}% on {line.product.category} — avg {avg_discount:.1f}%',
                'severity': 'high' if over_avg > threshold_pct * 2 else 'medium',
            })

    return anomalies


def get_delivery_slippage(user=None):
    """
    Fulfillment splits where today > promised_ship_date AND status != shipped/delivered.
    """
    from fulfillment.models import FulfillmentSplit

    today = timezone.now().date()
    slipped = FulfillmentSplit.objects.filter(
        promised_ship_date__lt=today,
        status__in=['suggested', 'accepted', 'overridden'],
    ).select_related('quotation__customer', 'warehouse', 'product')

    if user:
        slipped = slipped.filter(quotation__in=scoped_quotes(user))
    results = []
    for split in slipped:
        days_late = (today - split.promised_ship_date).days
        results.append({
            'quotation_id': split.quotation.id,
            'quote_number': split.quotation.quote_number,
            'customer_name': split.quotation.customer.name,
            'warehouse_name': split.warehouse.name,
            'product_name': split.product.name,
            'promised_date': split.promised_ship_date.isoformat(),
            'days_late': days_late,
            'qty': split.qty,
            'severity': 'high' if days_late > 5 else 'medium',
        })

    return results


def get_dashboard_summary(user=None):
    """Aggregate KPI metrics for the Deal Health dashboard."""
    from quotations.models import Quotation, QuotationLine
    from django.db.models import Sum, Avg, Count

    all_quotes = scoped_quotes(user) if user else Quotation.objects.all()
    active_statuses = ['draft', 'pending_approval', 'approved', 'sent', 'under_negotiation']

    active_qs = all_quotes.filter(status__in=active_statuses)
    active_total = sum(q.total_amount for q in active_qs)
    active_count = active_qs.count()

    pending_count = all_quotes.filter(status='pending_approval').count()
    at_risk = all_quotes.filter(blended_risk_score__gt=5).count()

    # Average margin
    avg_margin = 0
    margins = [q.margin_pct for q in all_quotes if q.total_amount > 0]
    if margins:
        avg_margin = round(sum(margins) / len(margins), 1)

    # Stalled and anomalies count
    stalled = get_stalled_deals(user=user)
    anomalies = get_discount_anomalies(user=user)
    slippage = get_delivery_slippage(user=user)

    # Closed won
    closed = all_quotes.filter(status__in=['confirmed', 'paid', 'invoiced'])
    closed_total = sum(q.total_amount for q in closed)
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
