"""
Quotations serializers — for API consumption.
Person A will expand these.
"""
from rest_framework import serializers
from .models import (
    Customer, Product, ProductVariant, Quotation, QuotationLine,
    ApprovalLog, DiscountTier, PriceList, PriceListItem,
)


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = '__all__'


class QuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_category = serializers.CharField(source='product.category', read_only=True, default='')
    line_total = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()

    class Meta:
        model = QuotationLine
        fields = '__all__'

    def get_line_total(self, obj):
        return float(obj.line_total)

    def get_discount_amount(self, obj):
        return float(obj.discount_amount)


class ApprovalLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalLog
        fields = '__all__'

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.username
        return 'System'


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    approval_logs = ApprovalLogSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_tier = serializers.CharField(source='customer.tier', read_only=True)
    rep_name = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    total_discount = serializers.SerializerMethodField()
    margin_pct = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = '__all__'

    def get_rep_name(self, obj):
        if obj.rep:
            return obj.rep.get_full_name() or obj.rep.username
        return 'Unassigned'

    def get_total_amount(self, obj):
        return float(obj.total_amount)

    def get_total_discount(self, obj):
        return float(obj.total_discount)

    def get_margin_pct(self, obj):
        return float(obj.margin_pct)


class QuotationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list/kanban views."""
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_tier = serializers.CharField(source='customer.tier', read_only=True)
    customer_company = serializers.CharField(source='customer.company', read_only=True)
    rep_name = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    margin_pct = serializers.SerializerMethodField()
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            'id', 'quote_number', 'customer_name', 'customer_tier',
            'customer_company', 'rep_name', 'status', 'blended_risk_score',
            'total_amount', 'margin_pct', 'line_count',
            'created_at', 'updated_at',
        ]

    def get_rep_name(self, obj):
        if obj.rep:
            return obj.rep.get_full_name() or obj.rep.username
        return 'Unassigned'

    def get_total_amount(self, obj):
        return float(obj.total_amount)

    def get_margin_pct(self, obj):
        return float(obj.margin_pct)

    def get_line_count(self, obj):
        return obj.lines.count()


class DiscountTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountTier
        fields = '__all__'
