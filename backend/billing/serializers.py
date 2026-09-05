"""
DRF serializers for the Billing app — Person B.
"""
from rest_framework import serializers
from .models import SubscriptionPlan, Invoice, Payment, UpsellRule


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'product', 'cycle', 'price', 'is_active']


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ['id', 'invoice_number', 'quotation', 'type', 'amount',
                  'status', 'due_date', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'invoice', 'amount', 'method', 'reference', 'paid_at']


class UpsellRuleSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    suggested_product_name = serializers.CharField(source='suggested_product.name', read_only=True)

    class Meta:
        model = UpsellRule
        fields = ['id', 'product', 'product_name', 'suggested_product',
                  'suggested_product_name', 'min_margin_pct', 'is_promoted']


class ProrateRequestSerializer(serializers.Serializer):
    """Input for proration calculation."""
    change_date = serializers.DateField()
    new_plan_id = serializers.IntegerField(required=False)
    new_quantity = serializers.IntegerField(required=False)


class ProrationResponseSerializer(serializers.Serializer):
    """Output shape for proration results."""
    old_plan_price = serializers.CharField()
    new_plan_price = serializers.CharField()
    days_remaining = serializers.IntegerField()
    cycle_days = serializers.IntegerField()
    prorated_amount = serializers.CharField()
    credit_amount = serializers.CharField()
    effective_date = serializers.CharField(allow_null=True)
    next_billing_date = serializers.CharField(allow_null=True)


class UpsellSuggestionResponseSerializer(serializers.Serializer):
    """Shape of a single upsell suggestion — shared contract with Person A."""
    id = serializers.IntegerField()
    suggested_product = serializers.DictField()
    margin_delta = serializers.CharField()
    is_promoted = serializers.BooleanField()
