"""
Subscription proration service — Person B.

Handles mid-cycle plan/quantity changes with calendar-accurate proration,
and subscription cancellation with credit note generation.

Adapted to repo field names: SubscriptionPlan.cycle, SubscriptionPlan.price,
SubscriptionPlan.cancellation_refund_pct.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP


@dataclass
class ProrationResult:
    """Result of a proration or cancellation calculation."""
    old_plan_price: Decimal
    new_plan_price: Decimal
    days_remaining: int
    cycle_days: int
    prorated_amount: Decimal
    credit_amount: Decimal = Decimal("0.00")
    effective_date: date = None
    next_billing_date: date = None

    def to_dict(self) -> dict:
        return {
            'old_plan_price': str(self.old_plan_price),
            'new_plan_price': str(self.new_plan_price),
            'days_remaining': self.days_remaining,
            'cycle_days': self.cycle_days,
            'prorated_amount': str(self.prorated_amount),
            'credit_amount': str(self.credit_amount),
            'effective_date': str(self.effective_date) if self.effective_date else None,
            'next_billing_date': str(self.next_billing_date) if self.next_billing_date else None,
        }


def _cycle_days(cycle: str, reference_date: date) -> int:
    """Get actual calendar days for a billing cycle starting at reference_date."""
    if cycle == 'monthly':
        _, month_days = calendar.monthrange(reference_date.year, reference_date.month)
        return month_days
    elif cycle == 'quarterly':
        total = 0
        d = reference_date
        for _ in range(3):
            _, month_days = calendar.monthrange(d.year, d.month)
            total += month_days
            if d.month == 12:
                d = d.replace(year=d.year + 1, month=1)
            else:
                d = d.replace(month=d.month + 1)
        return total
    elif cycle == 'yearly':
        if calendar.isleap(reference_date.year):
            return 366
        return 365
    return 30  # fallback


def _next_cycle_date(current: date, cycle: str) -> date:
    """Calculate the next billing date from current date."""
    if cycle == 'monthly':
        if current.month == 12:
            return current.replace(year=current.year + 1, month=1, day=current.day)
        else:
            _, max_day = calendar.monthrange(current.year, current.month + 1)
            return current.replace(month=current.month + 1, day=min(current.day, max_day))
    elif cycle == 'quarterly':
        month = current.month + 3
        year = current.year
        if month > 12:
            month -= 12
            year += 1
        _, max_day = calendar.monthrange(year, month)
        return current.replace(year=year, month=month, day=min(current.day, max_day))
    elif cycle == 'yearly':
        return current.replace(year=current.year + 1)
    return current + timedelta(days=30)


def get_billing_schedule(quotation) -> dict:
    """
    Build the billing schedule for a quotation, separating
    one-time and recurring lines.
    """
    lines = quotation.lines.select_related('product').all()
    one_time_lines = []
    recurring_lines = []

    for line in lines:
        line_data = {
            'line_id': line.id,
            'product_name': line.product.name,
            'quantity': str(line.quantity),
            'unit_price': str(line.unit_price),
            'discount_percent': str(line.discount_percent),
            'line_total': str(round(line.line_total, 2)),
        }

        if line.product.is_subscription:
            # Check if there's a subscription line attached
            sub_info = _get_subscription_info(line)
            line_data['subscription'] = sub_info
            recurring_lines.append(line_data)
        else:
            one_time_lines.append(line_data)

    return {
        'one_time_lines': one_time_lines,
        'recurring_lines': recurring_lines,
        'total_one_time': str(sum(float(l['line_total']) for l in one_time_lines)),
        'total_recurring': str(sum(
            float(l['subscription']['plan_price'])
            for l in recurring_lines
            if l['subscription']
        )),
    }


def _get_subscription_info(quotation_line) -> dict:
    """Get subscription details for a quotation line, if any."""
    try:
        from billing.models import SubscriptionPlan
        # Find a plan for this product
        plan = SubscriptionPlan.objects.filter(
            product=quotation_line.product,
            is_active=True,
        ).first()

        if plan:
            return {
                'plan_name': plan.name,
                'billing_cycle': plan.cycle,
                'plan_price': str(plan.price),
                'next_billing_date': str(date.today() + timedelta(days=30)),
                'status': 'active',
                'prorated_amount': '0.00',
                'credit_note_amount': '0.00',
            }
    except Exception:
        pass

    return {
        'plan_name': 'Standard',
        'billing_cycle': 'monthly',
        'plan_price': str(quotation_line.unit_price),
        'next_billing_date': str(date.today() + timedelta(days=30)),
        'status': 'active',
        'prorated_amount': '0.00',
        'credit_note_amount': '0.00',
    }


def prorate_subscription_change(
    subscription_line,
    change_date: date,
    new_plan=None,
    new_quantity=None,
) -> ProrationResult:
    """
    Calculate proration for a mid-cycle subscription change.

    prorated_amount = (plan_price / cycle_days) × remaining_days
    """
    plan = subscription_line.plan
    old_price = plan.price
    new_price = new_plan.price if new_plan else old_price

    # Calculate cycle info
    cycle_start = subscription_line.start_date
    total_cycle_days = _cycle_days(plan.cycle, cycle_start)
    days_used = (change_date - cycle_start).days
    days_remaining = max(0, total_cycle_days - days_used)

    # Proration: charge for remaining days at the new rate
    daily_rate_new = new_price / Decimal(str(total_cycle_days))
    prorated_amount = (daily_rate_new * Decimal(str(days_remaining))).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # Credit for unused days at old rate
    daily_rate_old = old_price / Decimal(str(total_cycle_days))
    credit_amount = (daily_rate_old * Decimal(str(days_remaining))).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    next_billing = _next_cycle_date(change_date, plan.cycle)

    # Update the subscription line
    subscription_line.prorated_amount = prorated_amount
    subscription_line.next_billing_date = next_billing
    if new_plan:
        subscription_line.plan = new_plan
    subscription_line.status = 'modified'
    subscription_line.save()

    return ProrationResult(
        old_plan_price=old_price,
        new_plan_price=new_price,
        days_remaining=days_remaining,
        cycle_days=total_cycle_days,
        prorated_amount=prorated_amount,
        credit_amount=credit_amount,
        effective_date=change_date,
        next_billing_date=next_billing,
    )


def cancel_subscription(subscription_line, cancel_date: date) -> ProrationResult:
    """
    Cancel a subscription and compute a credit note for unused days.
    Uses the plan's cancellation_refund_pct to determine refund percentage.
    """
    plan = subscription_line.plan
    price = plan.price
    refund_pct = getattr(plan, 'cancellation_refund_pct', Decimal('100')) / Decimal('100')

    cycle_start = subscription_line.start_date
    total_cycle_days = _cycle_days(plan.cycle, cycle_start)
    days_used = (cancel_date - cycle_start).days
    days_remaining = max(0, total_cycle_days - days_used)

    # Credit = unused portion × refund percentage
    daily_rate = price / Decimal(str(total_cycle_days))
    raw_credit = daily_rate * Decimal(str(days_remaining))
    credit_amount = (raw_credit * refund_pct).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # Update the subscription line
    from django.utils import timezone
    subscription_line.status = 'cancelled'
    subscription_line.cancelled_at = timezone.now()
    subscription_line.credit_note_amount = credit_amount
    subscription_line.save()

    return ProrationResult(
        old_plan_price=price,
        new_plan_price=Decimal("0.00"),
        days_remaining=days_remaining,
        cycle_days=total_cycle_days,
        prorated_amount=Decimal("0.00"),
        credit_amount=credit_amount,
        effective_date=cancel_date,
        next_billing_date=None,
    )
