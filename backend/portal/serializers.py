"""
Portal serializers — portal quotation view, negotiation messages.
"""
from rest_framework import serializers
from .models import PortalToken, NegotiationMessage
from quotations.serializers import QuotationLineSerializer, ApprovalLogSerializer


class PortalTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortalToken
        fields = ['token', 'email', 'quotation', 'expires_at', 'is_valid']
        read_only_fields = ['token', 'expires_at', 'is_valid']


class NegotiationMessageSerializer(serializers.ModelSerializer):
    line_product_name = serializers.SerializerMethodField()

    class Meta:
        model = NegotiationMessage
        fields = '__all__'
        read_only_fields = ['created_at']

    def get_line_product_name(self, obj):
        if obj.line_ref:
            return obj.line_ref.product.name
        return None


class PortalQuotationSerializer(serializers.Serializer):
    """Customer-facing quotation view with negotiation messages."""
    id = serializers.IntegerField()
    quote_number = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_company = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    rep_name = serializers.SerializerMethodField()
    rep_email = serializers.SerializerMethodField()
    lines = QuotationLineSerializer(many=True)
    negotiation_messages = NegotiationMessageSerializer(many=True)
    total_amount = serializers.SerializerMethodField()
    total_discount = serializers.SerializerMethodField()
    valid_until = serializers.DateField()
    notes = serializers.CharField()
    created_at = serializers.DateTimeField()

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_customer_name(self, obj):
        return obj.customer.name

    def get_customer_company(self, obj):
        return obj.customer.company

    def get_customer_email(self, obj):
        return obj.customer.email

    def get_rep_name(self, obj):
        if obj.rep:
            return obj.rep.get_full_name() or obj.rep.username
        return 'Unassigned'

    def get_rep_email(self, obj):
        if obj.rep:
            return obj.rep.email
        return ''

    def get_total_amount(self, obj):
        return float(obj.total_amount)

    def get_total_discount(self, obj):
        return float(obj.total_discount)


class MagicLinkRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    quotation_id = serializers.IntegerField(required=False)


class CounterDiscountSerializer(serializers.Serializer):
    counter_discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    message = serializers.CharField(required=False, default='')
    target_delivery_date = serializers.DateField(required=False)


class CommentSerializer(serializers.Serializer):
    message = serializers.CharField()
    line_id = serializers.IntegerField(required=False)
