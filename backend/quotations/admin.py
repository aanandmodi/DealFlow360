"""
Quotations admin — rich Django Admin for A2–A7 config models.
Person C provides these admin registrations.
"""
from django.contrib import admin
from .models import (
    Customer, Product, ProductVariant, PriceList, PriceListItem,
    DiscountTier, ApprovalChainRule, Quotation, QuotationLine, ApprovalLog,
)


# ── Inlines ──────────────────────────────────────────────

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1


class PriceListItemInline(admin.TabularInline):
    model = PriceListItem
    extra = 1
    autocomplete_fields = ['product']


class QuotationLineInline(admin.TabularInline):
    model = QuotationLine
    extra = 0
    readonly_fields = ['line_total']
    autocomplete_fields = ['product']

    def line_total(self, obj):
        return f"${obj.line_total:,.2f}" if obj.pk else "—"
    line_total.short_description = 'Line Total'


class ApprovalLogInline(admin.TabularInline):
    model = ApprovalLog
    extra = 0
    readonly_fields = ['step_order', 'role_required', 'actor', 'action', 'note', 'created_at']
    can_delete = False


# ── Model Admins ─────────────────────────────────────────

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'company', 'tier', 'created_at']
    list_filter = ['tier', 'created_at']
    search_fields = ['name', 'email', 'company']
    list_editable = ['tier']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'sku', 'category', 'base_price', 'unit', 'tax_pct', 'is_subscription', 'is_active']
    list_filter = ['category', 'is_subscription', 'is_active']
    search_fields = ['name', 'sku', 'description']
    list_editable = ['base_price', 'is_active']
    inlines = [ProductVariantInline]


@admin.register(PriceList)
class PriceListAdmin(admin.ModelAdmin):
    list_display = ['name', 'tier', 'currency', 'is_active']
    list_filter = ['tier', 'currency', 'is_active']
    search_fields = ['name']
    inlines = [PriceListItemInline]


@admin.register(DiscountTier)
class DiscountTierAdmin(admin.ModelAdmin):
    list_display = ['tier', 'category', 'max_discount_pct']
    list_filter = ['tier', 'category']
    list_editable = ['max_discount_pct']


@admin.register(ApprovalChainRule)
class ApprovalChainRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'min_over_pct', 'max_over_pct', 'requires_manager', 'requires_finance']
    list_filter = ['requires_manager', 'requires_finance']
    list_editable = ['min_over_pct', 'max_over_pct', 'requires_manager', 'requires_finance']


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ['quote_number', 'customer', 'rep', 'status', 'blended_risk_score', 'display_total', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['quote_number', 'customer__name', 'rep__username']
    readonly_fields = ['quote_number', 'blended_risk_score', 'created_at', 'updated_at']
    inlines = [QuotationLineInline, ApprovalLogInline]
    date_hierarchy = 'created_at'

    def display_total(self, obj):
        return f"${obj.total_amount:,.2f}"
    display_total.short_description = 'Total'


@admin.register(ApprovalLog)
class ApprovalLogAdmin(admin.ModelAdmin):
    list_display = ['quotation', 'action', 'actor', 'role_required', 'created_at']
    list_filter = ['action', 'role_required', 'created_at']
    search_fields = ['quotation__quote_number', 'note']
    readonly_fields = ['quotation', 'step_order', 'role_required', 'actor', 'action', 'note', 'created_at']
