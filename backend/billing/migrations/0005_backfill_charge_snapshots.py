from decimal import Decimal
from django.db import migrations


def backfill(apps, schema_editor):
    Line = apps.get_model('quotations', 'QuotationLine')
    Subscription = apps.get_model('billing', 'Subscription')
    Invoice = apps.get_model('billing', 'Invoice')
    Charge = apps.get_model('billing', 'SubscriptionCharge')
    for line in Line.objects.select_related('product').all():
        if line.cost_price is None:
            line.cost_price = line.product.cost_price
        if line.tax_pct is None:
            line.tax_pct = line.product.tax_pct
        line.save(update_fields=['cost_price', 'tax_pct'])
    for sub in Subscription.objects.select_related('line').all():
        sub.anchor_day = sub.start_date.day
        if not sub.current_invoice_id:
            invoice = Invoice.objects.filter(quotation_id=sub.line.quotation_id, type='recurring').order_by('created_at').first()
            if invoice:
                sub.current_invoice_id = invoice.id
        sub.save(update_fields=['anchor_day', 'current_invoice'])
        if sub.current_invoice_id:
            amount = (sub.quantity*sub.unit_price*(1+sub.line.tax_pct/100)).quantize(Decimal('0.01'))
            Charge.objects.get_or_create(subscription=sub, invoice_id=sub.current_invoice_id,
                defaults={'period_start':sub.start_date,'amount':amount})


class Migration(migrations.Migration):
    dependencies = [('billing','0004_creditnote_invoice_subscription_anchor_day_and_more'),
                    ('quotations','0003_quotationline_cost_price_quotationline_tax_pct_and_more')]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
