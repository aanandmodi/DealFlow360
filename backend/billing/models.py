"""Billing models — Person B fills these in."""

from django.db import models


class SubscriptionPlan(models.Model):
    """Subscription plan for recurring billing."""

    class Interval(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        YEARLY = 'yearly', 'Yearly'

    name = models.CharField(max_length=200)
    product = models.ForeignKey('core.Product', on_delete=models.CASCADE, related_name='subscription_plans')
    interval = models.CharField(max_length=20, choices=Interval.choices, default=Interval.MONTHLY)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'billing_subscription_plan'

    def __str__(self):
        return f"{self.name} ({self.get_interval_display()}) — ${self.price}"


class UpsellRule(models.Model):
    """Upsell/cross-sell rule for product pairings."""
    source_product = models.ForeignKey('core.Product', on_delete=models.CASCADE, related_name='upsell_sources')
    target_product = models.ForeignKey('core.Product', on_delete=models.CASCADE, related_name='upsell_targets')
    margin_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=15)
    promotion_tag = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'billing_upsell_rule'

    def __str__(self):
        return f"{self.source_product.name} → {self.target_product.name}"
