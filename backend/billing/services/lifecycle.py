"""Persistent quote-to-cash transactions. Callers hold the quotation row lock."""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from billing.models import Invoice, Payment, Subscription, SubscriptionPlan, CreditNote
from quotations.models import ApprovalLog
from .proration import _next_cycle_date


@transaction.atomic
def confirm_order(quote, actor=None):
    if quote.status in ('confirmed', 'fulfillment', 'invoiced', 'paid'):
        return
    if quote.status not in ('approved', 'sent'):
        raise ValidationError('Only approved final terms can be confirmed.')
    if quote.valid_until and quote.valid_until < timezone.localdate():
        raise ValidationError('This quotation has expired.')
    if not quote.lines.exists():
        raise ValidationError('An empty quotation cannot be confirmed.')
    totals = {'one_time': Decimal(0), 'recurring': Decimal(0)}
    today = timezone.localdate()
    for line in quote.lines.select_related('product'):
        kind = 'recurring' if line.is_subscription else 'one_time'
        totals[kind] += line.line_total + line.tax_amount
        if line.is_subscription:
            plan = SubscriptionPlan.objects.filter(product=line.product, is_active=True).first()
            if not plan:
                raise ValidationError(f'Configure an active subscription plan for {line.product.name}.')
            Subscription.objects.get_or_create(line=line, defaults={
                'plan': plan, 'quantity': line.qty, 'unit_price': line.net_price,
                'start_date': today, 'next_billing_date': _next_cycle_date(today, plan.cycle),
            })
    for kind, amount in totals.items():
        if amount > 0:
            Invoice.objects.create(quotation=quote, type=kind, amount=amount,
                invoice_number=f'INV-{uuid4().hex[:12].upper()}', status='sent', due_date=today + timedelta(days=30))
    quote.status = 'confirmed'
    quote.save()
    ApprovalLog.objects.create(quotation=quote, actor=actor, action='confirmed', role_required='customer',
                               note='Final terms accepted; invoices and recurring agreements created.')


def invoice_data(invoice):
    paid = invoice.payments.aggregate(total=Sum('amount'))['total'] or Decimal(0)
    return {'id': invoice.id, 'invoice_number': invoice.invoice_number, 'quotation': invoice.quotation_id,
            'quote_number': invoice.quotation.quote_number, 'customer': invoice.quotation.customer.name,
            'type': invoice.type, 'amount': str(invoice.amount), 'paid_amount': str(paid),
            'balance': str(invoice.amount-paid), 'status': invoice.status,
            'due_date': invoice.due_date, 'currency': 'INR'}


@transaction.atomic
def record_payment(invoice, data, actor):
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    existing = invoice.payments.filter(reference=data['reference']).first()
    if existing:
        if existing.amount != data['amount'] or existing.method != data['method']:
            raise ValidationError('This reference was already used for a different payment.')
        return invoice_data(invoice)
    balance = Decimal(invoice_data(invoice)['balance'])
    if invoice.status == 'cancelled' or data['amount'] > balance:
        raise ValidationError('Payment exceeds the outstanding balance or invoice is cancelled.')
    Payment.objects.create(invoice=invoice, recorded_by=actor, **data)
    if data['amount'] == balance:
        invoice.status = 'paid'
        invoice.save(update_fields=['status'])
    quote = invoice.quotation
    if not quote.invoices.exclude(status='paid').exists():
        quote.status = 'paid'
        quote.save()
    ApprovalLog.objects.create(quotation=quote, actor=actor, action='payment', role_required=actor.role,
        note=f"Recorded INR {data['amount']} against {invoice.invoice_number}; reference {data['reference']}.")
    return invoice_data(invoice)
