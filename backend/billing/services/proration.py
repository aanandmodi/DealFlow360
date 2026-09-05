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


def _next_cycle_date(current: date, cycle: str, anchor_day=None) -> date:
    months = {'monthly': 1, 'quarterly': 3, 'yearly': 12}[cycle]
    index = current.year * 12 + current.month - 1 + months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(anchor_day or current.day, calendar.monthrange(year, month)[1]))


def _cycle_days(cycle, reference_date):
    return (_next_cycle_date(reference_date, cycle) - reference_date).days


def get_billing_schedule(quotation):
    from billing.models import Subscription
    one_time, recurring = [], []
    for line in quotation.lines.select_related('product'):
        item = dict(line_id=line.id, product_name=line.product.name, quantity=str(line.qty),
                    unit_price=str(line.unit_price), discount_percent=str(line.discount_pct), line_total=str(line.line_total))
        if line.is_subscription:
            sub = Subscription.objects.filter(line=line).select_related('plan').first()
            item['quantity'] = str(sub.quantity) if sub else item['quantity']
            item['subscription'] = None if not sub else dict(plan_id=sub.plan_id, plan_name=sub.plan.name, billing_cycle=sub.plan.cycle,
                available_plans=[{'id':p.id,'name':p.name,'price':str(p.price)} for p in sub.plan.__class__.objects.filter(product=line.product,cycle=sub.plan.cycle,is_active=True)],
                plan_price=str(sub.unit_price * sub.quantity), next_billing_date=str(sub.next_billing_date),
                status=sub.status, prorated_amount=str(sub.prorated_amount), credit_note_amount=str(sub.credit_note_amount))
            recurring.append(item)
        else:
            one_time.append(item)
    return dict(one_time_lines=one_time, recurring_lines=recurring,
        total_one_time=str(sum((Decimal(x['line_total']) for x in one_time), Decimal(0))),
        total_recurring=str(sum((Decimal(x['subscription']['plan_price']) for x in recurring
                                if x['subscription'] and x['subscription']['status'] != 'cancelled'), Decimal(0))))


def current_period(sub, change_date):
    from rest_framework.exceptions import ValidationError
    if sub.status == 'cancelled':
        raise ValidationError('This subscription is already cancelled.')
    if not sub.start_date <= change_date < sub.next_billing_date:
        raise ValidationError('Change date must fall within the current billed period.')
    return (sub.next_billing_date - sub.start_date).days, (sub.next_billing_date - change_date).days


def prorate_subscription_change(subscription_line, change_date, new_plan=None, new_quantity=None):
    from billing.models import CreditNote, Invoice
    from rest_framework.exceptions import ValidationError
    from uuid import uuid4
    sub = subscription_line
    days, remaining = current_period(sub, change_date)
    if new_plan and (new_plan.product_id != sub.line.product_id or new_plan.cycle != sub.plan.cycle):
        raise ValidationError('Choose an active plan for the same product and billing cycle.')
    if sub.plan.proration_rule != 'daily_proration':
        raise ValidationError('The configured plan does not support daily proration.')
    old_total = sub.unit_price * sub.quantity
    price = new_plan.price if new_plan else sub.unit_price
    qty = Decimal(new_quantity) if new_quantity is not None else sub.quantity
    if qty <= 0:
        raise ValidationError('Quantity must be positive.')
    new_total = price * qty
    charge = (new_total * remaining / days).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    credit = (old_total * remaining / days).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    from .lifecycle import apply_credit
    if charge > Decimal('9999999999.99'):
        raise ValidationError('This change exceeds the supported invoice amount.')
    delta = charge - credit
    tax_multiplier = 1 + (sub.line.tax_pct if sub.line.tax_pct is not None else sub.line.product.tax_pct) / 100
    if abs(delta * tax_multiplier) > Decimal('9999999999.99'):
        raise ValidationError('This change exceeds the supported invoice amount.')
    if delta < 0:
        apply_credit(sub, (-delta*tax_multiplier).quantize(Decimal('0.01')), 'Mid-cycle subscription reduction')
    elif delta > 0:
        adjustment = Invoice.objects.create(quotation=sub.line.quotation, invoice_number=f'ADJ-{uuid4().hex[:12]}',
            type='recurring', amount=(delta*tax_multiplier).quantize(Decimal('0.01')), status='sent', due_date=change_date)
        from billing.models import SubscriptionCharge
        SubscriptionCharge.objects.create(subscription=sub, invoice=adjustment, period_start=sub.start_date, amount=adjustment.amount)
        if sub.line.quotation.status == 'paid':
            sub.line.quotation.status = 'invoiced'
            sub.line.quotation.save()
    sub.quantity, sub.unit_price = qty, price
    sub.prorated_amount = delta
    sub.credit_note_amount += (max(Decimal(0), -delta) * tax_multiplier).quantize(Decimal('0.01'))
    if new_plan:
        sub.plan = new_plan
    sub.save()
    return ProrationResult(old_total, new_total, remaining, days, charge, credit, change_date, sub.next_billing_date)


def cancel_subscription(subscription_line, cancel_date):
    from billing.models import CreditNote
    from django.utils import timezone
    sub = subscription_line
    days, remaining = current_period(sub, cancel_date)
    price = sub.unit_price * sub.quantity
    credit = (price * remaining / days * sub.plan.cancellation_refund_pct / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if credit > 0:
        from .lifecycle import apply_credit
        credit = (credit * (1 + (sub.line.tax_pct if sub.line.tax_pct is not None else sub.line.product.tax_pct) / 100)).quantize(Decimal('0.01'))
        apply_credit(sub, credit, 'Cancellation: unused prepaid period')
    sub.status, sub.cancelled_at = 'cancelled', timezone.now()
    sub.credit_note_amount += credit
    sub.save()
    return ProrationResult(price, Decimal(0), remaining, days, Decimal(0), credit, cancel_date, None)
