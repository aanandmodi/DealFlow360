"""
DRF views for the Fulfillment app — Person B.

Endpoints:
  POST /api/fulfillment/{quotation_id}/suggest-split/
  POST /api/fulfillment/{quotation_id}/accept-split/
  POST /api/fulfillment/{quotation_id}/override-split/
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
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
        quotation = Quotation.objects.get(pk=quotation_id)
    except Quotation.DoesNotExist:
        return Response(
            {'error': f'Quotation {quotation_id} not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    result = suggest_split(quotation)
    return Response(result.to_dict(), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_split_view(request, quotation_id):
    """
    POST /api/fulfillment/{quotation_id}/accept-split/

    Accepts the last suggested split — persists to DB and reserves stock.
    """
    try:
        quotation = Quotation.objects.get(pk=quotation_id)
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
        quotation = Quotation.objects.get(pk=quotation_id)
    except Quotation.DoesNotExist:
        return Response(
            {'error': f'Quotation {quotation_id} not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    allocations_data = request.data.get('allocations', [])
    if not allocations_data:
        return Response(
            {'error': 'No allocations provided'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate
    serializer = ManualAllocationSerializer(data=allocations_data, many=True)
    serializer.is_valid(raise_exception=True)
    allocations = serializer.validated_data

    is_valid, errors = validate_manual_split(quotation, allocations)
    if not is_valid:
        return Response(
            {'error': 'Validation failed', 'details': errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

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

    created = persist_split(quotation, suggestions, status='overridden')

    return Response({
        'message': f'Manual override saved — {len(created)} allocation(s).',
        'splits_created': len(created),
    }, status=status.HTTP_200_OK)
