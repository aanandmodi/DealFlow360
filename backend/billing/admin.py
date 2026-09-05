from django.contrib import admin
from .models import SubscriptionPlan, UpsellRule

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'product', 'interval', 'price', 'is_active']
    list_filter = ['interval', 'is_active']

@admin.register(UpsellRule)
class UpsellRuleAdmin(admin.ModelAdmin):
    list_display = ['source_product', 'target_product', 'margin_threshold', 'promotion_tag', 'is_active']
    list_filter = ['is_active']
