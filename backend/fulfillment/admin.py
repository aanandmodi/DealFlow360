from django.contrib import admin
from .models import Warehouse, StockLevel

@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'is_active']

@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ['warehouse', 'product', 'quantity', 'reorder_point']
    list_filter = ['warehouse']
