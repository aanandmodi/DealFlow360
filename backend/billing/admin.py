from django.contrib import admin
from .models import SubscriptionPlan, Invoice, Payment, UpsellRule


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'product', 'cycle', 'price', 'is_active']
    list_filter = ['cycle', 'is_active']
    search_fields = ['name', 'product__name']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'quotation', 'type', 'amount', 'status', 'due_date', 'created_at']
    list_filter = ['type', 'status']
    search_fields = ['invoice_number', 'quotation__quote_number']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'amount', 'method', 'paid_at']
    list_filter = ['method']
    search_fields = ['invoice__invoice_number', 'reference']


@admin.register(UpsellRule)
class UpsellRuleAdmin(admin.ModelAdmin):
    list_display = ['product', 'suggested_product', 'min_margin_pct', 'is_promoted']
    list_filter = ['is_promoted']
