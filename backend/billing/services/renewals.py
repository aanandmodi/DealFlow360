"""Idempotent billing worker; run on a schedule using the management command."""
from calendar import monthrange
from decimal import Decimal
from uuid import uuid4
from django.db import transaction
from billing.models import Subscription, Invoice, SubscriptionCharge
from quotations.models import Quotation, ApprovalLog
from .proration import _next_cycle_date


def renew_due_subscriptions(as_of):
    created = 0
    ids = list(Subscription.objects.filter(status='active', next_billing_date__lte=as_of).values_list('pk', flat=True))
    for pk in ids:
        with transaction.atomic():
            sub = Subscription.objects.get(pk=pk)
            quote = Quotation.objects.select_for_update().get(pk=sub.line.quotation_id)
            sub = Subscription.objects.select_for_update().get(pk=pk)
            while sub.status == 'active' and sub.next_billing_date <= as_of:
                start = sub.next_billing_date
                amount = (sub.quantity * sub.unit_price * (1 + (sub.line.tax_pct if sub.line.tax_pct is not None else sub.line.product.tax_pct) / 100)).quantize(Decimal('0.01'))
                invoice = Invoice.objects.create(quotation=quote, type='recurring', amount=amount,
                    invoice_number=f'REN-{uuid4().hex[:12]}', status='sent', due_date=start)
                SubscriptionCharge.objects.create(subscription=sub, invoice=invoice, period_start=start, amount=amount)
                sub.start_date = start
                sub.next_billing_date = _next_cycle_date(start, sub.plan.cycle, sub.anchor_day)
                sub.current_invoice = invoice
                sub.prorated_amount = 0
                sub.save()
                created += 1
            if created and quote.status == 'paid':
                quote.status = 'invoiced'
                quote.save()
    return created
