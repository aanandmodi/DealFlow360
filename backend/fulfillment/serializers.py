"""
DRF serializers for the Fulfillment app — Person B.
"""
from rest_framework import serializers
from .models import Warehouse, StockLevel, FulfillmentSplit


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'location', 'shipping_cost_weight', 'is_active']


class StockLevelSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    available = serializers.IntegerField(read_only=True)

    class Meta:
        model = StockLevel
        fields = ['id', 'warehouse', 'warehouse_name', 'product', 'product_name',
                  'in_stock', 'reserved', 'available']


class FulfillmentSplitSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = FulfillmentSplit
        fields = ['id', 'quotation', 'warehouse', 'warehouse_name', 'product',
                  'product_name', 'qty', 'estimated_cost', 'status',
                  'promised_ship_date', 'actual_ship_date', 'created_at']


class ManualAllocationSerializer(serializers.Serializer):
    """Input for manual override split."""
    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=0)
    is_backorder = serializers.BooleanField(default=False)
