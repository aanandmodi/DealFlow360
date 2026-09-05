"""Quotations app serializers."""

from rest_framework import serializers
from .models import (
    DiscountTier, CategoryDiscountCeiling, ApprovalChain,
    Quotation, QuotationLine, ApprovalLog,
)


class DiscountTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountTier
        fields = '__all__'


class CategoryDiscountCeilingSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    tier_name = serializers.CharField(source='discount_tier.name', read_only=True)

    class Meta:
        model = CategoryDiscountCeiling
        fields = '__all__'


class ApprovalChainSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalChain
        fields = '__all__'


class QuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True)
    net_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    gross_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = QuotationLine
        fields = [
            'id', 'quotation', 'product', 'product_name', 'product_sku',
            'category_name', 'quantity', 'unit_price', 'discount_percent',
            'net_price', 'gross_total', 'discount_amount', 'line_total', 'tax_amount',
        ]
        read_only_fields = ['id']


class ApprovalLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True)
    actor_username = serializers.CharField(source='actor.username', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = ApprovalLog
        fields = [
            'id', 'quotation', 'actor', 'actor_name', 'actor_username',
            'action', 'action_display', 'role_at_action', 'reason',
            'blended_risk_score_at_action', 'timestamp',
        ]
        read_only_fields = ['id', 'timestamp']


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    approval_logs = ApprovalLogSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_tier = serializers.CharField(source='customer.tier', read_only=True)
    customer_tier_display = serializers.CharField(source='customer.get_tier_display', read_only=True)
    sales_rep_name = serializers.CharField(source='sales_rep.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approval_level_display = serializers.CharField(source='get_required_approval_level_display', read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    gross_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    blended_discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    blended_margin_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id', 'customer', 'customer_name', 'customer_tier', 'customer_tier_display',
            'sales_rep', 'sales_rep_name', 'status', 'status_display',
            'blended_risk_score', 'required_approval_level', 'approval_level_display',
            'manager_approved', 'finance_approved',
            'notes', 'payment_terms',
            'subtotal', 'total_discount_amount', 'tax_amount', 'total',
            'gross_total', 'blended_discount_percent', 'blended_margin_percent',
            'created_at', 'updated_at',
            'lines', 'approval_logs',
        ]
        read_only_fields = [
            'id', 'status', 'blended_risk_score', 'required_approval_level',
            'manager_approved', 'finance_approved', 'created_at', 'updated_at',
        ]


class QuotationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (no nested lines/logs)."""
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_tier = serializers.CharField(source='customer.tier', read_only=True)
    sales_rep_name = serializers.CharField(source='sales_rep.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            'id', 'customer', 'customer_name', 'customer_tier',
            'sales_rep', 'sales_rep_name', 'status', 'status_display',
            'blended_risk_score', 'required_approval_level',
            'total', 'line_count',
            'created_at', 'updated_at',
        ]

    def get_line_count(self, obj):
        return obj.lines.count()


class RiskScoreBreakdownSerializer(serializers.Serializer):
    """Serializer for the risk score breakdown endpoint."""
    line_id = serializers.IntegerField()
    product_name = serializers.CharField()
    category_name = serializers.CharField()
    discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    ceiling = serializers.DecimalField(max_digits=5, decimal_places=2)
    overage = serializers.DecimalField(max_digits=5, decimal_places=2)
    line_value = serializers.DecimalField(max_digits=12, decimal_places=2)
    policy_status = serializers.CharField()
