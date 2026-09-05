"""
Fulfillment app — Warehouse & stock models.
Person B owns this app. Person C created these stubs.
"""
from django.db import models
from django.conf import settings


class Warehouse(models.Model):
    """Warehouse/depot entity."""
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=300, blank=True)
    shipping_cost_weight = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fulfillment_warehouse'
        ordering = ['name']

    def __str__(self):
        return self.name


class StockLevel(models.Model):
    """Per-product stock level at a warehouse."""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='stock_levels')
    product = models.ForeignKey('core.Product', on_delete=models.CASCADE, related_name='stock_levels')
    in_stock = models.PositiveIntegerField(default=0)
    reserved = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'fulfillment_stock_level'
        unique_together = ('warehouse', 'product')

    def __str__(self):
        return f"{self.warehouse.name}: {self.product.name} — {self.available} available"

    @property
    def available(self):
        return self.in_stock - self.reserved


class FulfillmentSplit(models.Model):
    """Record of how a quotation's products are split across warehouses."""

    class Status(models.TextChoices):
        SUGGESTED = 'suggested', 'Suggested'
        ACCEPTED = 'accepted', 'Accepted'
        OVERRIDDEN = 'overridden', 'Overridden'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'

    quotation = models.ForeignKey(
        'quotations.Quotation', on_delete=models.CASCADE, related_name='fulfillment_splits'
    )
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    product = models.ForeignKey('core.Product', on_delete=models.CASCADE)
    qty = models.PositiveIntegerField()
    shipment_count = models.PositiveIntegerField(default=1)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.SUGGESTED)
    promised_ship_date = models.DateField(null=True, blank=True)
    actual_ship_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fulfillment_split'
        ordering = ['quotation', 'warehouse']

    def __str__(self):
        return f"Q-{self.quotation_id} → {self.warehouse.name}: {self.qty}x {self.product.name}"
