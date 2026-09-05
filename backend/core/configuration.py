"""Typed configuration API and field metadata for the management console."""
from decimal import Decimal
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from core.permissions import IsInternalUser
from core.access import require_roles
from quotations.models import Product, ProductVariant, Customer, DiscountTier, ApprovalChainRule, PriceList, PriceListItem
from fulfillment.models import Warehouse, StockLevel
from billing.models import SubscriptionPlan, UpsellRule

RESOURCES = {
    'products': (Product, ['name', 'sku', 'category', 'base_price', 'cost_price', 'unit', 'tax_pct', 'description', 'is_subscription', 'is_active']),
    'variants': (ProductVariant, ['product', 'attribute', 'value', 'extra_price']),
    'customers': (Customer, ['name', 'email', 'company', 'address', 'phone', 'tier']),
    'discounts': (DiscountTier, ['tier', 'category', 'max_discount_pct']),
    'approvals': (ApprovalChainRule, ['name', 'min_over_pct', 'max_over_pct', 'requires_manager', 'requires_finance']),
    'warehouses': (Warehouse, ['name', 'location', 'shipping_cost_weight', 'is_active']),
    'stock': (StockLevel, ['warehouse', 'product', 'in_stock', 'reserved', 'reorder_point']),
    'plans': (SubscriptionPlan, ['name', 'product', 'cycle', 'price', 'cancellation_refund_pct', 'is_active']),
    'price-lists': (PriceList, ['name', 'tier', 'currency', 'is_active']),
    'prices': (PriceListItem, ['price_list', 'product', 'price']),
    'upsell': (UpsellRule, ['product', 'suggested_product', 'min_margin_pct', 'is_promoted']),
}


def serializer_for(model, fields):
    class ConfigSerializer(serializers.ModelSerializer):
        class Meta:
            pass

        def validate(self, data):
            merged = {field: getattr(self.instance, field, None) for field in fields}
            merged.update(data)
            for field, value in data.items():
                if isinstance(value, (Decimal, int)) and not isinstance(value, bool):
                    if value < 0 or ('pct' in field and value > 100):
                        raise ValidationError({field: 'Enter a non-negative value; percentages cannot exceed 100.'})
            if model == StockLevel and merged.get('in_stock', 0) < (getattr(self.instance, 'reserved', 0) or 0):
                raise ValidationError('Stock cannot fall below existing reservations.')
            if model == ApprovalChainRule:
                if merged['min_over_pct'] > merged['max_over_pct']:
                    raise ValidationError('The minimum threshold must not exceed the maximum.')
            if model == PriceList and merged.get('currency') != 'INR':
                raise ValidationError('This workspace bills in INR.')
            if model == SubscriptionPlan and not merged['product'].is_subscription:
                raise ValidationError('Select a recurring product for this plan.')
            if model == UpsellRule and merged['product'] == merged['suggested_product']:
                raise ValidationError('Choose a different suggested product.')
            return data
    ConfigSerializer.Meta.model = model
    ConfigSerializer.Meta.fields = ['id'] + fields
    ConfigSerializer.Meta.read_only_fields = ['id', 'reserved']
    return ConfigSerializer


@api_view(['GET', 'POST', 'PATCH'])
@permission_classes([IsInternalUser])
def configuration(request, resource, pk=None):
    require_roles(request.user, 'admin', 'sales_manager')
    if resource not in RESOURCES:
        raise ValidationError('Unknown configuration area.')
    if request.method != 'GET' and resource not in ('discounts', 'approvals'):
        require_roles(request.user, 'admin')
    model, fields = RESOURCES[resource]
    serializer_class = serializer_for(model, fields)
    if request.method == 'GET':
        schema = []
        for name in fields:
            f = model._meta.get_field(name)
            options = []
            if f.many_to_one:
                options = [{'value': x.pk, 'label': str(x)} for x in f.related_model.objects.all()[:1000]]
            elif f.choices:
                options = [{'value': value, 'label': label} for value, label in f.choices]
            kind = 'select' if options or f.many_to_one or f.choices else (
                'checkbox' if f.get_internal_type() == 'BooleanField' else
                'number' if f.get_internal_type() in ('DecimalField', 'PositiveIntegerField') else
                'email' if f.get_internal_type() == 'EmailField' else 'text')
            schema.append({'name': name, 'type': kind, 'options': options, 'readonly': name == 'reserved',
                           'required': not f.blank and not f.has_default(),
                           'default': f.get_default() if f.has_default() else ''})
        return Response({'fields': schema, 'results': serializer_class(model.objects.all(), many=True).data,
            'can_write': request.user.role == 'admin' or resource in ('discounts', 'approvals')})
    instance = get_object_or_404(model.objects.select_for_update(), pk=pk) if request.method == 'PATCH' else None
    serializer = serializer_class(instance, data=request.data, partial=request.method == 'PATCH')
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=200 if instance else 201)
