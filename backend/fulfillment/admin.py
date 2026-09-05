from django.contrib import admin
from .models import Warehouse, StockLevel, FulfillmentSplit


class StockLevelInline(admin.TabularInline):
    model = StockLevel
    extra = 1


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'shipping_cost_weight', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'location']
    inlines = [StockLevelInline]


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ['warehouse', 'product', 'in_stock', 'reserved', 'available']
    list_filter = ['warehouse']
    search_fields = ['product__name']

    def available(self, obj):
        return obj.available
    available.short_description = 'Available'


@admin.register(FulfillmentSplit)
class FulfillmentSplitAdmin(admin.ModelAdmin):
    list_display = ['quotation', 'warehouse', 'product', 'qty', 'status', 'promised_ship_date']
    list_filter = ['status', 'warehouse']
    search_fields = ['quotation__id']
