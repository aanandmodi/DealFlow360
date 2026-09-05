"""Fulfillment models — Person B fills these in."""

from django.db import models


class Warehouse(models.Model):
    """Warehouse location for stock management."""
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=300, blank=True)
    is_active = models.BooleanField(default=True)
    shipping_cost_weight = models.DecimalField(max_digits=5, decimal_places=2, default=1)

    class Meta:
        db_table = 'fulfillment_warehouse'

    def __str__(self):
        return self.name


class StockLevel(models.Model):
    """Stock level per product per warehouse."""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='stock_levels')
    product = models.ForeignKey('core.Product', on_delete=models.CASCADE, related_name='stock_levels')
    quantity = models.PositiveIntegerField(default=0)
    reorder_point = models.PositiveIntegerField(default=10)

    class Meta:
        db_table = 'fulfillment_stock_level'
        unique_together = ['warehouse', 'product']

    def __str__(self):
        return f"{self.product.name} @ {self.warehouse.name}: {self.quantity}"
