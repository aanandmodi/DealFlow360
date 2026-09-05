"""
Quotations app models — Person A: Core Deal Engine.

Models:
- DiscountTier: customer tier discount limits (Bronze/Silver/Gold)
- CategoryDiscountCeiling: per-category discount limits per tier
- ApprovalChain: maps overage ranges to approval levels
- Quotation: the deal itself with status state machine
- QuotationLine: individual line items on a quotation
- ApprovalLog: full audit trail of approval actions
"""

from django.db import models
from django.conf import settings
from decimal import Decimal


class DiscountTier(models.Model):
    """
    Customer-tier-level discount ceiling.
    E.g. Bronze ≤5%, Silver ≤10%, Gold ≤15%.
    Links to Customer.tier choices via the `tier_key` field.
    """

    tier_key = models.CharField(
        max_length=10,
        unique=True,
        help_text='Must match Customer.Tier choices: bronze, silver, gold',
    )
    name = models.CharField(max_length=50)
    max_discount_percent = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        db_table = 'quotations_discount_tier'
        ordering = ['max_discount_percent']

    def __str__(self):
        return f"{self.name} (≤{self.max_discount_percent}%)"


class CategoryDiscountCeiling(models.Model):
    """
    Per-category, per-tier discount ceiling override.
    E.g. Gold + Hardware = 15%, Gold + Services = 10%.
    If no category ceiling exists, falls back to DiscountTier.max_discount_percent.
    """

    category = models.ForeignKey(
        'core.ProductCategory',
        on_delete=models.CASCADE,
        related_name='discount_ceilings',
    )
    discount_tier = models.ForeignKey(
        DiscountTier,
        on_delete=models.CASCADE,
        related_name='category_ceilings',
    )
    max_discount_percent = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        db_table = 'quotations_category_discount_ceiling'
        unique_together = ['category', 'discount_tier']
        ordering = ['discount_tier', 'category']

    def __str__(self):
        return f"{self.discount_tier.name} / {self.category.name}: ≤{self.max_discount_percent}%"


class ApprovalChain(models.Model):
    """
    Maps blended overage score ranges to approval requirements.
    E.g. 0-5 = Manager only, 5+ = Manager + Finance.
    """

    name = models.CharField(max_length=100)
    min_overage_threshold = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text='Minimum blended overage score for this chain step',
    )
    max_overage_threshold = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text='Maximum blended overage score for this chain step',
    )
    requires_finance = models.BooleanField(
        default=False,
        help_text='If True, needs Finance approval after Manager',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'quotations_approval_chain'
        ordering = ['min_overage_threshold']

    def __str__(self):
        level = 'Manager + Finance' if self.requires_finance else 'Manager only'
        return f"{self.name}: {self.min_overage_threshold}–{self.max_overage_threshold} → {level}"


class Quotation(models.Model):
    """
    The core deal object. Status follows a state machine:
    Draft → PendingApproval → Approved/Rejected → Confirmed → UnderNegotiation
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING_APPROVAL = 'pending_approval', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CONFIRMED = 'confirmed', 'Confirmed'
        UNDER_NEGOTIATION = 'under_negotiation', 'Under Negotiation'

    class ApprovalLevel(models.TextChoices):
        NONE = 'none', 'No Approval Needed'
        MANAGER = 'manager', 'Manager Only'
        MANAGER_FINANCE = 'manager_finance', 'Manager + Finance'

    customer = models.ForeignKey(
        'core.Customer',
        on_delete=models.PROTECT,
        related_name='quotations',
    )
    sales_rep = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='quotations',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    blended_risk_score = models.DecimalField(
        max_digits=8, decimal_places=4, default=0,
        help_text='Computed by risk_score service on submit',
    )
    required_approval_level = models.CharField(
        max_length=20,
        choices=ApprovalLevel.choices,
        default=ApprovalLevel.NONE,
    )
    manager_approved = models.BooleanField(default=False)
    finance_approved = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    payment_terms = models.CharField(max_length=50, default='Net 30 Days')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quotations_quotation'
        ordering = ['-created_at']

    def __str__(self):
        return f"Q-{self.pk} ({self.customer.name}) — {self.get_status_display()}"

    @property
    def subtotal(self):
        """Sum of all line totals before tax."""
        return sum(line.line_total for line in self.lines.all())

    @property
    def total_discount_amount(self):
        """Sum of all discount amounts across lines."""
        return sum(line.discount_amount for line in self.lines.all())

    @property
    def tax_amount(self):
        """Sum of estimated tax across lines."""
        return sum(line.tax_amount for line in self.lines.all())

    @property
    def total(self):
        """Grand total including tax."""
        return self.subtotal + self.tax_amount

    @property
    def gross_total(self):
        """Total before any discounts."""
        return sum(line.gross_total for line in self.lines.all())

    @property
    def blended_discount_percent(self):
        """Weighted average discount across all lines."""
        gross = self.gross_total
        if gross == 0:
            return Decimal('0')
        return (self.total_discount_amount / gross * 100).quantize(Decimal('0.01'))

    @property
    def blended_margin_percent(self):
        """Placeholder margin — assumes 40% base cost for demo purposes."""
        if self.subtotal == 0:
            return Decimal('0')
        cost = self.gross_total * Decimal('0.60')  # 40% margin assumption
        margin = (self.subtotal - cost) / self.subtotal * 100
        return margin.quantize(Decimal('0.01'))


class QuotationLine(models.Model):
    """Individual line item on a quotation."""

    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    product = models.ForeignKey(
        'core.Product',
        on_delete=models.PROTECT,
        related_name='quotation_lines',
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
    )

    class Meta:
        db_table = 'quotations_quotation_line'
        ordering = ['pk']

    def __str__(self):
        return f"{self.product.name} ×{self.quantity} @ {self.discount_percent}% off"

    @property
    def gross_total(self):
        """Total before discount."""
        return self.unit_price * self.quantity

    @property
    def discount_amount(self):
        """Dollar discount on this line."""
        return self.gross_total * self.discount_percent / 100

    @property
    def net_price(self):
        """Unit price after discount."""
        return self.unit_price * (1 - self.discount_percent / 100)

    @property
    def line_total(self):
        """Total after discount, before tax."""
        return self.gross_total - self.discount_amount

    @property
    def tax_amount(self):
        """Estimated tax for this line."""
        return self.line_total * self.product.tax_rate / 100

    @property
    def line_total_with_tax(self):
        """Total including tax."""
        return self.line_total + self.tax_amount


class ApprovalLog(models.Model):
    """Full audit trail for every approval action on a quotation."""

    class Action(models.TextChoices):
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        RETURNED = 'returned', 'Returned for Revision'
        RESUBMITTED = 'resubmitted', 'Resubmitted'

    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name='approval_logs',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='approval_actions',
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    role_at_action = models.CharField(max_length=20, blank=True)
    reason = models.TextField(blank=True)
    blended_risk_score_at_action = models.DecimalField(
        max_digits=8, decimal_places=4, default=0,
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quotations_approval_log'
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.actor} — {self.get_action_display()} — Q-{self.quotation_id}"
