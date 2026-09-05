"""
DRF views for the Fulfillment app — Person B.

Endpoints:
  POST /api/fulfillment/{quotation_id}/suggest-split/
  POST /api/fulfillment/{quotation_id}/accept-split/
  POST /api/fulfillment/{quotation_id}/override-split/
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from core.permissions import IsInternalUser as IsAuthenticated
from core.access import quote_for, require_roles
from rest_framework.response import Response

from quotations.models import Quotation
from .serializers import ManualAllocationSerializer
from .services.auto_split import (
    suggest_split,
    persist_split,
    validate_manual_split,
    SplitSuggestion,
)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_split_view(request, quotation_id):
    """
    POST /api/fulfillment/{quotation_id}/suggest-split/

    Runs the auto-split algorithm and returns a suggested warehouse allocation.
    Does NOT persist — just a preview.
    """
    try:
        quotation = quote_for(request, quotation_id, lock=True)
    except Quotation.DoesNotExist:
        return Response(
            {'error': f'Quotation {quotation_id} not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    from fulfillment.models import FulfillmentSplit
    from .services.auto_split import _check_backorder_consolidation
    existing = list(FulfillmentSplit.objects.filter(quotation=quotation).select_related('product','warehouse'))
    if existing:
        splits = [{'id':s.pk,'product_id':s.product_id,'product_name':s.product.name,
            'warehouse_id':s.warehouse_id,'warehouse_name':s.warehouse.name,'quantity':s.qty,
            'estimated_cost':s.estimated_cost,'is_backorder':s.is_backorder,'status':s.status,
            'promised_ship_date':s.promised_ship_date} for s in existing]
        return Response({'splits':splits,'total_shipments':len({s.warehouse_id for s in existing if not s.is_backorder}),
            'total_estimated_cost':sum(s.estimated_cost for s in existing if not s.is_backorder),
            'has_backorders':any(s.is_backorder for s in existing),
            'backorder_consolidation_available':_check_backorder_consolidation(quotation),'persisted':True})
    result = suggest_split(quotation)
    return Response({**result.to_dict(), 'persisted':False})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_split_view(request, quotation_id):
    require_roles(request.user, 'finance', 'sales_manager', 'admin')
    """
    POST /api/fulfillment/{quotation_id}/accept-split/

    Accepts the last suggested split — persists to DB and reserves stock.
    """
    try:
        quotation = quote_for(request, quotation_id, lock=True)
    except Quotation.DoesNotExist:
        return Response(
            {'error': f'Quotation {quotation_id} not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Re-run suggestion to get fresh data
    result = suggest_split(quotation)

    # Persist the splits
    created = persist_split(quotation, result.suggestions, status='accepted')

    return Response({
        'message': f'Split accepted — {len(created)} allocation(s) created.',
        'splits_created': len(created),
        'has_backorders': result.has_backorders,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def override_split_view(request, quotation_id):
    require_roles(request.user, 'finance', 'sales_manager', 'admin')
    """
    POST /api/fulfillment/{quotation_id}/override-split/

    Manual override: rep provides their own allocation.

    Request body:
    {
        "allocations": [
            {"product_id": 1, "warehouse_id": 2, "quantity": 50, "is_backorder": false},
            ...
        ]
    }
    """
    try:
        quotation = quote_for(request, quotation_id, lock=True)
    except Quotation.DoesNotExist:
        return Response(
            {'error': f'Quotation {quotation_id} not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    from fulfillment.models import FulfillmentSplit, StockLevel
    from django.db.models import F
    from rest_framework.exceptions import ValidationError
    existing = list(FulfillmentSplit.objects.filter(quotation=quotation))
    if any(s.status in ('shipped','delivered') for s in existing):
        raise ValidationError('Dispatched allocations cannot be overridden.')
    list(StockLevel.objects.select_for_update().filter(product_id__in=[s.product_id for s in existing]).order_by('pk'))
    for split in existing:
        if not split.is_backorder:
            StockLevel.objects.filter(warehouse_id=split.warehouse_id,product_id=split.product_id).update(reserved=F('reserved')-split.qty)
    # These changes roll back if validation fails.
    allocations_data = request.data.get('allocations', [])
    if not allocations_data:
        raise ValidationError('No allocations provided.')

    # Validate
    serializer = ManualAllocationSerializer(data=allocations_data, many=True)
    serializer.is_valid(raise_exception=True)
    allocations = serializer.validated_data

    is_valid, errors = validate_manual_split(quotation, allocations)
    if not is_valid:
        raise ValidationError(errors)

    # Convert to SplitSuggestion objects and persist
    from fulfillment.models import Warehouse
    from quotations.models import Product

    suggestions = []
    for alloc in allocations:
        try:
            wh = Warehouse.objects.get(pk=alloc['warehouse_id'])
            prod = Product.objects.get(pk=alloc['product_id'])
        except (Warehouse.DoesNotExist, Product.DoesNotExist):
            continue

        suggestions.append(SplitSuggestion(
            product_id=alloc['product_id'],
            product_name=prod.name,
            warehouse_id=alloc['warehouse_id'],
            warehouse_name=wh.name,
            quantity=alloc['quantity'],
            is_backorder=alloc.get('is_backorder', False),
            shipping_cost_weight=wh.shipping_cost_weight,
        ))

    FulfillmentSplit.objects.filter(quotation=quotation).delete()
    created = persist_split(quotation, suggestions, status='overridden')

    return Response({
        'message': f'Manual override saved — {len(created)} allocation(s).',
        'splits_created': len(created),
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def warehouse_options(request):
    from fulfillment.models import Warehouse
    return Response(list(Warehouse.objects.filter(is_active=True).values('id','name','location')))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def consolidate(request, quotation_id):
    from fulfillment.models import FulfillmentSplit, StockLevel
    from django.db.models import F
    from decimal import Decimal
    require_roles(request.user, 'finance', 'sales_manager', 'admin')
    q = quote_for(request, quotation_id, lock=True)
    backorders = list(q.fulfillment_splits.filter(is_backorder=True).order_by('pk'))
    stocks = list(StockLevel.objects.select_for_update().filter(product_id__in=[s.product_id for s in backorders],
        warehouse__is_active=True).select_related('warehouse').order_by('pk'))
    units = 0
    for bo in backorders:
        for stock in sorted(stocks, key=lambda s:s.warehouse.shipping_cost_weight):
            if stock.product_id != bo.product_id or stock.available <= 0:
                continue
            qty = min(bo.qty, stock.available)
            stock.reserved += qty
            stock.save(update_fields=['reserved'])
            FulfillmentSplit.objects.create(quotation=q,warehouse=stock.warehouse,product=bo.product,
                qty=qty,estimated_cost=Decimal(qty)*stock.warehouse.shipping_cost_weight,status='accepted',
                promised_ship_date=bo.promised_ship_date)
            bo.qty -= qty
            units += qty
            if bo.qty == 0:
                break
        if bo.qty:
            bo.save(update_fields=['qty'])
        else:
            bo.delete()
    return Response({'message': f'{units} backordered units allocated from available stock.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def shipment_action(request, quotation_id, split_id):
    from fulfillment.models import FulfillmentSplit, StockLevel
    from rest_framework.exceptions import ValidationError
    from django.shortcuts import get_object_or_404
    from django.utils import timezone
    from rest_framework import serializers
    from quotations.models import ApprovalLog
    require_roles(request.user, 'finance', 'sales_manager', 'admin')
    q = quote_for(request, quotation_id, lock=True)
    split = get_object_or_404(FulfillmentSplit, quotation=q, pk=split_id)
    action = request.data.get('action')
    if action == 'promise':
        split.promised_ship_date = serializers.DateField().run_validation(request.data.get('date'))
    elif action == 'ship' and split.status in ('accepted','overridden') and not split.is_backorder:
        stock = StockLevel.objects.select_for_update().get(product=split.product, warehouse=split.warehouse)
        stock.reserved -= split.qty
        stock.in_stock -= split.qty
        stock.save()
        split.status, split.actual_ship_date = 'shipped', timezone.localdate()
    elif action == 'deliver' and split.status == 'shipped':
        split.status = 'delivered'
    else:
        raise ValidationError('This shipment cannot take that action in its current state.')
    split.save()
    ApprovalLog.objects.create(quotation=q,actor=request.user,action='fulfillment',role_required=request.user.role,
        note=f'{action}: {split.qty} units of {split.product.name} from {split.warehouse.name}.')
    return Response({'message': 'Shipment updated.', 'status':split.status})
