"""Explainable deal checks and scenario calculations using the live pricing engine."""
from copy import copy
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from core.access import quote_for, require_roles
from core.permissions import IsInternalUser
from quotations.services.risk_score import compute_risk_score, get_ceiling_for_line
from fulfillment.models import StockLevel, FulfillmentSplit
from billing.models import SubscriptionPlan


class ScenarioInput(serializers.Serializer):
    discount = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)


class ScenarioLines:
    def __init__(self, lines):
        self.lines = lines

    def select_related(self, *args):
        return self

    def all(self):
        return self.lines


def scenario_result(quote, lines, name):
    # The same risk function operates on an in-memory view; no model writes.
    class ScenarioQuote:
        customer = quote.customer
    scenario = ScenarioQuote()
    scenario.lines = ScenarioLines(lines)
    risk = compute_risk_score(scenario)
    net = sum((line.line_total for line in lines), Decimal(0))
    cost = sum((line.cost_price * line.qty for line in lines), Decimal(0))
    tax = sum((line.tax_amount for line in lines), Decimal(0))
    return dict(name=name, net=net, tax=tax, total=net+tax, gross_profit=net-cost,
        margin=round((net-cost)/net*100, 2) if net else 0,
        risk=risk.blended_risk_score, approval=risk.required_approval_level,
        lines=[dict(id=line.id, product=line.product.name, discount=line.discount_pct,
                    ceiling=get_ceiling_for_line(line.product.category, quote.customer.tier)) for line in lines])


@api_view(['POST'])
@permission_classes([IsInternalUser])
def pricing_scenarios(request, pk):
    quote = quote_for(request, pk)
    data = ScenarioInput(data=request.data)
    data.is_valid(raise_exception=True)
    original = list(quote.lines.select_related('product'))
    if not original:
        raise serializers.ValidationError('Add at least one product before comparing scenarios.')
    proposed, policy = [], []
    for line in original:
        changed, compliant = copy(line), copy(line)
        changed.discount_pct = data.validated_data['discount']
        compliant.discount_pct = min(line.discount_pct, get_ceiling_for_line(line.product.category, quote.customer.tier))
        proposed.append(changed)
        policy.append(compliant)
    return Response({'currency':'INR', 'persisted':False, 'scenarios':[
        scenario_result(quote, original, 'Current terms'),
        scenario_result(quote, proposed, 'Proposed discount'),
        scenario_result(quote, policy, 'Within policy'),
    ]})


@api_view(['GET'])
@permission_classes([IsInternalUser])
def deal_readiness(request, pk):
    quote = quote_for(request, pk)
    lines = list(quote.lines.select_related('product'))
    checks = []
    def check(key, title, passed, detail, path):
        checks.append(dict(key=key, title=title, passed=passed, detail=detail, path=path))
    check('lines','Commercial scope',bool(lines),f'{len(lines)} product lines configured.',f'/quotations/{pk}')
    expired = quote.valid_until and quote.valid_until < timezone.localdate()
    check('validity','Quotation validity',not expired,'Expired quotations cannot be accepted.' if expired else 'Quotation is within its validity period.',f'/quotations/{pk}')
    required = compute_risk_score(quote).required_approval_level
    cleared = quote.status in ('approved','sent','confirmed','fulfillment','invoiced','paid')
    check('approvals','Pricing approvals',cleared, f'Current stage: {quote.get_status_display()}. Review path: {required.replace("_", " + ")}.',f'/approvals/{pk}')
    missing = [line.product.name for line in lines if line.is_subscription and not SubscriptionPlan.objects.filter(product=line.product,is_active=True).exists()]
    check('plans','Recurring plan coverage',not missing,', '.join(missing) if missing else 'Every recurring product has an active billing plan.','/config')
    shortages = []
    for product_id in {line.product_id for line in lines if line.product.category == 'hardware'}:
        product_lines = [line for line in lines if line.product_id == product_id]
        needed = sum(line.qty for line in product_lines)
        available = sum(stock.available for stock in StockLevel.objects.filter(product_id=product_id,warehouse__is_active=True))
        own_reserved = FulfillmentSplit.objects.filter(quotation=quote,product_id=product_id,is_backorder=False).aggregate(qty=Sum('qty'))['qty'] or 0
        if needed > available + own_reserved:
            shortages.append(f'{product_lines[0].product.name}: {int(needed-available-own_reserved)} units short')
    check('stock','Inventory coverage',not shortages,'; '.join(shortages) if shortages else 'Physical product demand is covered by stock or this order’s allocation.','/fulfillment')
    return Response({'quote_number':quote.quote_number,'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks)})


@api_view(['GET'])
@permission_classes([IsInternalUser])
def inventory_readiness(request):
    require_roles(request.user,'admin','sales_manager','finance')
    stocks = list(StockLevel.objects.filter(warehouse__is_active=True,product__is_active=True).select_related('warehouse','product'))
    backorders = {row['product_id']:row['quantity'] for row in FulfillmentSplit.objects.filter(is_backorder=True).values('product_id').annotate(quantity=Sum('qty'))}
    preferred = {}
    for stock in sorted(stocks,key=lambda x:(x.warehouse.shipping_cost_weight,x.warehouse_id)):
        preferred.setdefault(stock.product_id,stock.pk)
    rows = []
    for stock in stocks:
        pending = backorders.get(stock.product_id,0) if preferred[stock.product_id] == stock.pk else 0
        recommendation = max(0,stock.reorder_point+pending-stock.available)
        rows.append(dict(id=stock.pk,product=stock.product.name,sku=stock.product.sku,warehouse=stock.warehouse.name,
            in_stock=stock.in_stock,reserved=stock.reserved,available=stock.available,reorder_point=stock.reorder_point,
            backorders=pending,recommended_receipt=recommendation,
            estimated_purchase_cost=recommendation*stock.product.cost_price))
    return Response({'rows':rows,'method':'Restore the configured buffer and cover open backorders. Backorder demand is assigned once to the lowest-weight warehouse; recommendations do not place purchases.'})


class ReceiptInput(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1,max_value=1000000)
    reference = serializers.CharField(min_length=3,max_length=100)


@api_view(['POST'])
@permission_classes([IsInternalUser])
def receive_stock(request, pk):
    from django.shortcuts import get_object_or_404
    from fulfillment.models import StockReceipt
    require_roles(request.user,'admin','sales_manager')
    payload = ReceiptInput(data=request.data)
    payload.is_valid(raise_exception=True)
    stock = get_object_or_404(StockLevel.objects.select_for_update(),pk=pk,warehouse__is_active=True)
    data = payload.validated_data
    previous = StockReceipt.objects.filter(stock=stock,reference=data['reference']).first()
    if previous:
        if previous.quantity != data['quantity']:
            raise serializers.ValidationError('That receipt reference already records a different quantity.')
        return Response({'id':previous.pk,'in_stock':stock.in_stock,'replayed':True})
    if stock.in_stock+data['quantity'] > 2147483647:
        raise serializers.ValidationError('Receipt exceeds the supported stock balance.')
    receipt = StockReceipt.objects.create(stock=stock,received_by=request.user,**data)
    stock.in_stock += data['quantity']
    stock.save(update_fields=['in_stock'])
    return Response({'id':receipt.pk,'in_stock':stock.in_stock,'replayed':False},status=201)


@api_view(['GET','POST'])
@permission_classes([IsInternalUser])
def deal_conversation(request, pk):
    from portal.models import NegotiationMessage
    from portal.serializers import NegotiationMessageSerializer, CommentSerializer
    quote = quote_for(request,pk,lock=request.method=='POST')
    if request.method == 'GET':
        return Response(NegotiationMessageSerializer(quote.negotiation_messages.all(),many=True).data)
    if quote.status not in ('draft','approved','sent','pending_approval','under_negotiation'):
        raise serializers.ValidationError('This negotiation is closed.')
    data = CommentSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    message = NegotiationMessage.objects.create(quotation=quote,author_type='rep',
        author_name=request.user.get_full_name() or request.user.username,message=data.validated_data['message'])
    quote.save(update_fields=['updated_at'])
    return Response(NegotiationMessageSerializer(message).data,status=201)
