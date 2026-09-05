"""Quotations Django Admin configuration."""

from django.contrib import admin
from .models import (
    DiscountTier, CategoryDiscountCeiling, ApprovalChain,
    Quotation, QuotationLine, ApprovalLog,
)


@admin.register(DiscountTier)
class DiscountTierAdmin(admin.ModelAdmin):
    list_display = ['name', 'tier_key', 'max_discount_percent']
    ordering = ['max_discount_percent']


@admin.register(CategoryDiscountCeiling)
class CategoryDiscountCeilingAdmin(admin.ModelAdmin):
    list_display = ['discount_tier', 'category', 'max_discount_percent']
    list_filter = ['discount_tier', 'category']


@admin.register(ApprovalChain)
class ApprovalChainAdmin(admin.ModelAdmin):
    list_display = ['name', 'min_overage_threshold', 'max_overage_threshold', 'requires_finance', 'is_active']
    list_filter = ['requires_finance', 'is_active']


class QuotationLineInline(admin.TabularInline):
    model = QuotationLine
    extra = 0
    readonly_fields = ['line_total']


class ApprovalLogInline(admin.TabularInline):
    model = ApprovalLog
    extra = 0
    readonly_fields = ['actor', 'action', 'role_at_action', 'reason', 'blended_risk_score_at_action', 'timestamp']


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'status', 'blended_risk_score', 'required_approval_level', 'created_at']
    list_filter = ['status', 'required_approval_level']
    search_fields = ['customer__name', 'notes']
    inlines = [QuotationLineInline, ApprovalLogInline]
    readonly_fields = ['blended_risk_score', 'required_approval_level', 'manager_approved', 'finance_approved']
