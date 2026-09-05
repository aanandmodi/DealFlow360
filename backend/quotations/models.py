"""
Quotations app — Core Deal Engine models.
Person A owns this app. Person C created these stubs for Admin/Portal/Dashboard integration.
Person A will expand these with full business logic.
"""
from django.db import models
from decimal import Decimal
from django.conf import settings


class Customer(models.Model):
    """Customer entity with tier-based pricing."""

    class Tier(models.TextChoices):
        BRONZE = 'bronze', 'Bronze'
        SILVER = 'silver', 'Silver'
        GOLD = 'gold', 'Gold'

    name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    company = models.CharField(max_length=200, blank=True)
    address = models.TextField(blank=True)
    tier = models.CharField(max_length=10, choices=Tier.choices, default=Tier.BRONZE, db_index=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='customer_profile',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quotations_customer'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_tier_display()})"


class Product(models.Model):
    """Product catalog entry."""

    class Category(models.TextChoices):
        HARDWARE = 'hardware', 'Hardware'
        SERVICES = 'services', 'Services'
        SUBSCRIPTIONS = 'subscriptions', 'Subscriptions'
        SOFTWARE = 'software', 'Software'

    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=50, unique=True, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, db_index=True)
    base_price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, default='unit')
    tax_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    is_subscription = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quotations_product'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_category_display()}) — ${self.base_price}"


class ProductVariant(models.Model):
    """Product variant with attribute/value and extra price."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    attribute = models.CharField(max_length=100)  # e.g. "RAM", "Color"
    value = models.CharField(max_length=100)  # e.g. "32GB", "Black"
    extra_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'quotations_product_variant'

    def __str__(self):
        return f"{self.product.name}: {self.attribute}={self.value} (+${self.extra_price})"


class PriceList(models.Model):
    """Tier-based price list."""
    name = models.CharField(max_length=100)
    tier = models.CharField(max_length=10, choices=Customer.Tier.choices)
    currency = models.CharField(max_length=3, default='INR')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'quotations_price_list'

    def __str__(self):
        return f"{self.name} ({self.get_tier_display()} — {self.currency})"


class PriceListItem(models.Model):
    """Per-product pricing override within a price list."""
    price_list = models.ForeignKey(PriceList, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='price_list_items')
    price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'quotations_price_list_item'
        unique_together = ('price_list', 'product')

    def __str__(self):
        return f"{self.price_list.name} — {self.product.name}: ${self.price}"


class DiscountTier(models.Model):
    """Discount ceiling per customer tier AND product category."""
    tier = models.CharField(max_length=10, choices=Customer.Tier.choices, db_index=True)
    category = models.CharField(max_length=20, choices=Product.Category.choices, db_index=True)
    max_discount_pct = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        db_table = 'quotations_discount_tier'
        unique_together = ('tier', 'category')
        ordering = ['tier', 'category']

    def __str__(self):
        return f"{self.get_tier_display()} / {self.get_category_display()}: max {self.max_discount_pct}%"

    @property
    def name(self):
        return f"{self.get_tier_display()} - {self.get_category_display()}"

    @property
    def tier_key(self):
        return self.tier

    @property
    def max_discount_percent(self):
        return float(self.max_discount_pct)


class ApprovalChainRule(models.Model):
    """Defines which approval steps are required for a given overage range."""
    name = models.CharField(max_length=100)
    min_over_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    max_over_pct = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    requires_manager = models.BooleanField(default=True)
    requires_finance = models.BooleanField(default=False)

    class Meta:
        db_table = 'quotations_approval_chain_rule'
        ordering = ['min_over_pct']

    def __str__(self):
        steps = 'Manager'
        if self.requires_finance:
            steps += ' → Finance'
        return f"{self.name}: {self.min_over_pct}–{self.max_over_pct}% → {steps}"


ApprovalChain = ApprovalChainRule


class Quotation(models.Model):
    """Core quotation/deal entity."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING_APPROVAL = 'pending_approval', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        SENT = 'sent', 'Sent'
        UNDER_NEGOTIATION = 'under_negotiation', 'Under Negotiation'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'
        FULFILLMENT = 'fulfillment', 'Fulfillment'
        INVOICED = 'invoiced', 'Invoiced'
        PAID = 'paid', 'Paid'

    class ApprovalLevel(models.TextChoices):
        NONE = 'none', 'No Approval Needed'
        MANAGER = 'manager', 'Manager Only'
        MANAGER_FINANCE = 'manager_finance', 'Manager + Finance'

    quote_number = models.CharField(max_length=20, unique=True, db_index=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='quotations')
    rep = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='quotations_as_rep',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    blended_risk_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    required_approval_level = models.CharField(
        max_length=20,
        choices=ApprovalLevel.choices,
        default=ApprovalLevel.NONE,
    )
    manager_approved = models.BooleanField(default=False)
    finance_approved = models.BooleanField(default=False)
    payment_terms = models.CharField(max_length=50, default='Net 30 Days')
    notes = models.TextField(blank=True)
    valid_until = models.DateField(null=True, blank=True)
    portal_token = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quotations_quotation'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.quote_number} — {self.customer.name} ({self.get_status_display()})"

    @property
    def sales_rep(self):
        return self.rep

    @property
    def total(self):
        return self.total_amount

    @property
    def total_amount(self):
        return sum(line.line_total for line in self.lines.all())

    @property
    def subtotal(self):
        return self.total_amount

    @property
    def total_discount(self):
        return sum(line.discount_amount for line in self.lines.all())

    @property
    def total_discount_amount(self):
        return self.total_discount

    @property
    def gross_total(self):
        return sum(line.gross_total for line in self.lines.all())

    @property
    def tax_amount(self):
        return sum(line.tax_amount for line in self.lines.all())

    @property
    def blended_discount_percent(self):
        gt = self.gross_total
        if gt == 0:
            return 0.0
        return round((self.total_discount / gt) * 100, 2)

    @property
    def blended_margin_percent(self):
        return self.margin_pct

    @property
    def approval_level_display(self):
        return self.get_required_approval_level_display()

    @property
    def status_display(self):
        return self.get_status_display()

    @property
    def margin_pct(self):
        total = self.total_amount
        if total == 0:
            return 0
        cost = sum(line.qty * line.product.cost_price for line in self.lines.all())
        return round(((float(total) - cost) / float(total)) * 100, 1)


class QuotationLine(models.Model):
    """Individual line item on a quotation."""
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='quotation_lines')
    description = models.CharField(max_length=300, blank=True)
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    line_limit_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_subscription = models.BooleanField(default=False)

    class Meta:
        db_table = 'quotations_quotation_line'
        ordering = ['id']

    def __str__(self):
        return f"{self.product.name} x{self.qty} @ ${self.unit_price} ({self.discount_pct}% off)"

    @property
    def quantity(self):
        return float(self.qty)

    @property
    def discount_percent(self):
        return float(self.discount_pct)

    @property
    def gross_total(self):
        return self.qty * self.unit_price

    @property
    def line_total(self):
        return (self.qty * self.unit_price * (1 - self.discount_pct / 100)).quantize(Decimal('0.01'))

    @property
    def discount_amount(self):
        return self.gross_total - self.line_total

    @property
    def net_price(self):
        return self.unit_price * (1 - self.discount_pct / 100)

    @property
    def tax_amount(self):
        return (self.line_total * self.product.tax_pct / 100).quantize(Decimal('0.01'))

    @property
    def category_name(self):
        return self.product.get_category_display() if hasattr(self.product, 'get_category_display') else str(self.product.category)


class ApprovalLog(models.Model):
    """Audit trail for every approval action."""

    class Action(models.TextChoices):
        SUBMITTED = 'submitted', 'Submitted for Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        RETURNED = 'returned', 'Returned for Revision'
        RE_SUBMITTED = 're_submitted', 'Re-submitted'

    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='approval_logs')
    step_order = models.PositiveIntegerField(default=1)
    role_required = models.CharField(max_length=20, default='sales_manager')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='approval_actions',
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    note = models.TextField(blank=True)
    blended_risk_score_at_action = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quotations_approval_log'
        ordering = ['created_at']

    def __str__(self):
        actor_name = self.actor.get_full_name() if self.actor else 'System'
        return f"{self.quotation.quote_number} — {self.get_action_display()} by {actor_name}"

    @property
    def reason(self):
        return self.note

    @property
    def role_at_action(self):
        return self.role_required

    @property
    def timestamp(self):
        return self.created_at

    @property
    def action_display(self):
        return self.get_action_display()
