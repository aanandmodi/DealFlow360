"""
Billing app — Subscription, Invoice, Payment models.
Person B owns this app. Person C created these stubs.
"""
from django.db import models
from django.conf import settings


class SubscriptionPlan(models.Model):
    """Recurring billing plan."""

    class Cycle(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        YEARLY = 'yearly', 'Yearly'

    name = models.CharField(max_length=200)
    product = models.ForeignKey('quotations.Product', on_delete=models.CASCADE, related_name='subscription_plans')
    cycle = models.CharField(max_length=15, choices=Cycle.choices, default=Cycle.MONTHLY)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    proration_rule = models.CharField(max_length=50, default='daily_proration')
    cancellation_refund_pct = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_subscription_plan'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_cycle_display()}) — ${self.price}"


class Invoice(models.Model):
    """Invoice entity."""

    class Type(models.TextChoices):
        ONE_TIME = 'one_time', 'One-Time'
        RECURRING = 'recurring', 'Recurring'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SENT = 'sent', 'Sent'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'
        CANCELLED = 'cancelled', 'Cancelled'

    invoice_number = models.CharField(max_length=20, unique=True)
    quotation = models.ForeignKey('quotations.Quotation', on_delete=models.CASCADE, related_name='invoices')
    type = models.CharField(max_length=15, choices=Type.choices, default=Type.ONE_TIME)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_invoice'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.invoice_number} — ${self.amount} ({self.get_status_display()})"


class Payment(models.Model):
    """Payment against an invoice."""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=50, default='bank_transfer')
    reference = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_payment'

    def __str__(self):
        return f"Payment ${self.amount} for {self.invoice.invoice_number}"


class UpsellRule(models.Model):
    """Product pairing rules for upsell/cross-sell."""
    product = models.ForeignKey('quotations.Product', on_delete=models.CASCADE, related_name='upsell_from')
    suggested_product = models.ForeignKey('quotations.Product', on_delete=models.CASCADE, related_name='upsell_to')
    min_margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    is_promoted = models.BooleanField(default=False)

    class Meta:
        db_table = 'billing_upsell_rule'

    def __str__(self):
        return f"{self.product.name} → {self.suggested_product.name}"
