"""
Quotations app serializers — dual-compatible for Person A and Person C frontend consumers.
"""

from rest_framework import serializers
from .models import (
    Customer, Product, ProductVariant, Quotation, QuotationLine,
    ApprovalLog, DiscountTier,
)


class CustomerSerializer(serializers.ModelSerializer):
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)

    class Meta:
        model = Customer
        fields = '__all__'


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    subscription_plans = serializers.SerializerMethodField()
    variants = ProductVariantSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='get_category_display', read_only=True)
    tax_rate = serializers.DecimalField(source='tax_pct', max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

    def get_subscription_plans(self, obj):
        return list(obj.subscription_plans.filter(is_active=True).values('id','name','cycle','price'))


class QuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    category_name = serializers.CharField(source='product.category', read_only=True)
    quantity = serializers.FloatField(source='qty', read_only=True)
    discount_percent = serializers.FloatField(source='discount_pct', read_only=True)
    line_total = serializers.FloatField(read_only=True)
    discount_amount = serializers.FloatField(read_only=True)
    gross_total = serializers.FloatField(read_only=True)
    net_price = serializers.FloatField(read_only=True)
    tax_amount = serializers.FloatField(read_only=True)

    class Meta:
        model = QuotationLine
        fields = [
            'id', 'quotation', 'product', 'product_name', 'product_sku',
            'category_name', 'description', 'qty', 'quantity',
            'unit_price', 'discount_pct', 'discount_percent',
            'line_limit_pct', 'is_subscription',
            'net_price', 'gross_total', 'discount_amount', 'line_total', 'tax_amount',
        ]
        read_only_fields = ['id', 'quotation']


class ApprovalLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_username = serializers.CharField(source='actor.username', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    role_at_action = serializers.CharField(source='role_required', read_only=True)
    reason = serializers.CharField(source='note', read_only=True)
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = ApprovalLog
        fields = [
            'id', 'quotation', 'actor', 'actor_name', 'actor_username',
            'action', 'action_display', 'role_required', 'role_at_action',
            'note', 'reason', 'blended_risk_score_at_action',
            'step_order', 'created_at', 'timestamp',
        ]

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.username
        return 'System'


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    approval_logs = ApprovalLogSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_tier = serializers.CharField(source='customer.tier', read_only=True)
    customer_tier_display = serializers.CharField(source='customer.get_tier_display', read_only=True)
    sales_rep = serializers.PrimaryKeyRelatedField(source='rep', read_only=True)
    sales_rep_name = serializers.SerializerMethodField()
    rep_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approval_level_display = serializers.CharField(source='get_required_approval_level_display', read_only=True)
    total = serializers.FloatField(source='total_amount', read_only=True)
    total_amount = serializers.FloatField(read_only=True)
    subtotal = serializers.FloatField(read_only=True)
    total_discount = serializers.FloatField(read_only=True)
    total_discount_amount = serializers.FloatField(source='total_discount', read_only=True)
    gross_total = serializers.FloatField(read_only=True)
    tax_amount = serializers.FloatField(read_only=True)
    blended_discount_percent = serializers.FloatField(read_only=True)
    blended_margin_percent = serializers.FloatField(source='margin_pct', read_only=True)
    margin_pct = serializers.FloatField(read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id', 'quote_number', 'customer', 'customer_name', 'customer_tier', 'customer_tier_display',
            'rep', 'rep_name', 'sales_rep', 'sales_rep_name',
            'status', 'status_display', 'blended_risk_score',
            'required_approval_level', 'approval_level_display',
            'manager_approved', 'finance_approved',
            'notes', 'payment_terms', 'valid_until', 'portal_token',
            'subtotal', 'total_discount', 'total_discount_amount',
            'tax_amount', 'total', 'total_amount', 'gross_total',
            'blended_discount_percent', 'blended_margin_percent', 'margin_pct',
            'created_at', 'updated_at', 'lines', 'approval_logs',
        ]
        read_only_fields = [
            'id', 'quote_number', 'status', 'blended_risk_score',
            'required_approval_level', 'manager_approved', 'finance_approved',
            'created_at', 'updated_at',
        ]

    def get_rep_name(self, obj):
        if obj.rep:
            return obj.rep.get_full_name() or obj.rep.username
        return 'Unassigned'

    def get_sales_rep_name(self, obj):
        return self.get_rep_name(obj)


class QuotationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list / kanban views."""
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_tier = serializers.CharField(source='customer.tier', read_only=True)
    customer_company = serializers.CharField(source='customer.company', read_only=True)
    rep_name = serializers.SerializerMethodField()
    sales_rep_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total = serializers.FloatField(source='total_amount', read_only=True)
    total_amount = serializers.FloatField(read_only=True)
    margin_pct = serializers.FloatField(read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            'id', 'quote_number', 'customer', 'customer_name', 'customer_tier',
            'customer_company', 'rep', 'rep_name', 'sales_rep_name',
            'status', 'status_display', 'blended_risk_score',
            'portal_token',
            'total', 'total_amount', 'margin_pct', 'line_count',
            'created_at', 'updated_at',
        ]

    def get_rep_name(self, obj):
        if obj.rep:
            return obj.rep.get_full_name() or obj.rep.username
        return 'Unassigned'

    def get_sales_rep_name(self, obj):
        return self.get_rep_name(obj)

    def get_line_count(self, obj):
        return obj.lines.count()


class DiscountTierSerializer(serializers.ModelSerializer):
    tier_key = serializers.CharField(source='tier', read_only=True)
    max_discount_percent = serializers.FloatField(source='max_discount_pct', read_only=True)
    name = serializers.CharField(read_only=True)

    class Meta:
        model = DiscountTier
        fields = '__all__'
