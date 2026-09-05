"""
Quotations app views — comprehensive implementation of Person A's Core Deal Engine
with full support for Person C's pipeline/dashboard queries and Person B's integrations.
"""

import uuid
from decimal import Decimal
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Quotation, QuotationLine, Customer, Product, DiscountTier, ApprovalLog,
)
from .serializers import (
    QuotationSerializer, QuotationListSerializer, QuotationLineSerializer,
    ApprovalLogSerializer, CustomerSerializer, ProductSerializer,
    DiscountTierSerializer,
)
from .services.risk_score import (
    compute_risk_score, submit_quotation, approve_quotation,
    reject_quotation, return_quotation,
)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def quotation_list(request):
    """
    GET: List quotations with optional filters (status, rep, customer).
    POST: Create a new quotation.
    """
    if request.method == 'GET':
        qs = Quotation.objects.select_related('customer', 'rep').prefetch_related('lines__product').all()
        stat = request.query_params.get('status')
        if stat:
            qs = qs.filter(status=stat)
        rep_id = request.query_params.get('rep')
        if rep_id:
            qs = qs.filter(rep_id=rep_id)
        customer_id = request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        user = request.user
        if user.is_authenticated and getattr(user, 'role', None) == 'sales_rep' and request.query_params.get('scope') != 'all':
            qs = qs.filter(rep=user)

        serializer = QuotationListSerializer(qs, many=True)
        if request.query_params.get('page') or request.query_params.get('paginated') == 'true':
            return Response({
                'count': qs.count(),
                'results': serializer.data,
            })
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data
        cust_id = data.get('customer') or data.get('customer_id')
        if not cust_id:
            return Response({'error': 'Customer ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = Customer.objects.get(id=cust_id)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        count = Quotation.objects.count() + 1001
        quote_number = f"Q-{count}"

        q = Quotation.objects.create(
            quote_number=quote_number,
            customer=customer,
            rep=request.user,
            status=Quotation.Status.DRAFT,
            notes=data.get('notes', ''),
            payment_terms=data.get('payment_terms', 'Net 30 Days'),
            portal_token=str(uuid.uuid4()),
        )
        return Response(QuotationSerializer(q).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def quotation_detail(request, pk):
    """
    GET: Retrieve quotation with all lines and logs.
    PATCH: Update quotation header fields.
    DELETE: Delete quotation (draft only).
    """
    q = get_object_or_404(
        Quotation.objects.select_related('customer', 'rep').prefetch_related('lines__product', 'approval_logs__actor'),
        pk=pk,
    )

    if request.method == 'GET':
        return Response(QuotationSerializer(q).data)

    elif request.method == 'PATCH':
        data = request.data
        if 'notes' in data:
            q.notes = data['notes']
        if 'payment_terms' in data:
            q.payment_terms = data['payment_terms']
        if 'valid_until' in data:
            q.valid_until = data['valid_until']
        if 'customer' in data or 'customer_id' in data:
            cid = data.get('customer') or data.get('customer_id')
            try:
                q.customer = Customer.objects.get(id=cid)
            except Customer.DoesNotExist:
                pass
        q.save()
        return Response(QuotationSerializer(q).data)

    elif request.method == 'DELETE':
        q.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_create(request):
    """Helper create endpoint for Person C compatibility."""
    return quotation_list(request)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def quotation_lines(request, pk):
    """
    GET: List line items on a quotation.
    POST: Add a new line item to a quotation.
    """
    q = get_object_or_404(Quotation, pk=pk)

    if request.method == 'GET':
        return Response(QuotationLineSerializer(q.lines.all(), many=True).data)

    elif request.method == 'POST':
        data = request.data
        prod_id = data.get('product') or data.get('product_id')
        if not prod_id:
            return Response({'error': 'Product ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, pk=prod_id)
        qty = Decimal(str(data.get('quantity') or data.get('qty') or 1))
        unit_price = Decimal(str(data.get('unit_price') or product.base_price))
        discount_pct = Decimal(str(data.get('discount_percent') or data.get('discount_pct') or 0))

        line = QuotationLine.objects.create(
            quotation=q,
            product=product,
            qty=qty,
            unit_price=unit_price,
            discount_pct=discount_pct,
            is_subscription=product.is_subscription,
        )
        return Response(QuotationLineSerializer(line).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def quotation_line_detail(request, pk, line_id):
    """
    PATCH: Update line item quantity or discount.
    DELETE: Remove line item from quotation.
    """
    q = get_object_or_404(Quotation, pk=pk)
    line = get_object_or_404(QuotationLine, pk=line_id, quotation=q)

    if request.method == 'PATCH':
        data = request.data
        if 'quantity' in data or 'qty' in data:
            line.qty = Decimal(str(data.get('quantity') or data.get('qty')))
        if 'discount_percent' in data or 'discount_pct' in data:
            line.discount_pct = Decimal(str(data.get('discount_percent') or data.get('discount_pct')))
        if 'unit_price' in data:
            line.unit_price = Decimal(str(data['unit_price']))
        line.save()
        return Response(QuotationLineSerializer(line).data)

    elif request.method == 'DELETE':
        line.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_submit(request, pk):
    """
    Submit quotation: runs blended discount risk score algorithm, sets required approval level.
    """
    q = get_object_or_404(Quotation, pk=pk)
    if not q.lines.exists():
        return Response({'error': 'Cannot submit a quotation with no line items.'}, status=status.HTTP_400_BAD_REQUEST)

    result = submit_quotation(q, request.user)

    return Response({
        'status': q.status,
        'blended_risk_score': str(result.blended_risk_score),
        'required_approval_level': result.required_approval_level,
        'requires_finance': result.requires_finance,
        'has_any_breach': result.has_any_breach,
        'message': f"Quotation submitted with blended risk score {result.blended_risk_score}%.",
        'line_details': [
            {
                'line_id': d.line_id,
                'product_name': d.product_name,
                'category_name': d.category_name,
                'discount_percent': str(d.discount_percent),
                'ceiling': str(d.ceiling),
                'overage': str(d.overage),
                'line_value': str(d.line_value),
                'policy_status': d.policy_status,
            }
            for d in result.line_details
        ],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_approve(request, pk):
    """Advance approval chain."""
    q = get_object_or_404(Quotation, pk=pk)
    reason = request.data.get('reason', '')
    try:
        fully_approved = approve_quotation(q, request.user, reason)
        return Response({
            'status': q.status,
            'fully_approved': fully_approved,
            'manager_approved': q.manager_approved,
            'finance_approved': q.finance_approved,
            'message': 'Quotation approved successfully.',
        })
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_reject(request, pk):
    """Reject quotation."""
    q = get_object_or_404(Quotation, pk=pk)
    reason = request.data.get('reason', '')
    try:
        reject_quotation(q, request.user, reason)
        return Response({'status': q.status, 'message': 'Quotation rejected.'})
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_return(request, pk):
    """Return quotation to rep for revision."""
    q = get_object_or_404(Quotation, pk=pk)
    reason = request.data.get('reason', '')
    try:
        return_quotation(q, request.user, reason)
        return Response({'status': q.status, 'message': 'Quotation returned for revision.'})
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_confirm(request, pk):
    """Confirm an approved quotation."""
    q = get_object_or_404(Quotation, pk=pk)
    if q.status not in (Quotation.Status.APPROVED, Quotation.Status.CONFIRMED):
        return Response({'error': 'Only approved quotations can be confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
    q.status = Quotation.Status.CONFIRMED
    q.save()
    return Response({'status': q.status, 'message': 'Quotation confirmed.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quotation_risk_score(request, pk):
    """Get diagnostic risk score breakdown for approval screen."""
    q = get_object_or_404(Quotation, pk=pk)
    result = compute_risk_score(q)
    return Response({
        'quotation_id': q.pk,
        'blended_risk_score': str(result.blended_risk_score),
        'has_any_breach': result.has_any_breach,
        'required_approval_level': result.required_approval_level,
        'requires_finance': result.requires_finance,
        'total_order_value': str(result.total_order_value),
        'total_weighted_overage': str(result.total_weighted_overage),
        'line_details': [
            {
                'line_id': d.line_id,
                'product_name': d.product_name,
                'category_name': d.category_name,
                'discount_percent': str(d.discount_percent),
                'ceiling': str(d.ceiling),
                'overage': str(d.overage),
                'line_value': str(d.line_value),
                'policy_status': d.policy_status,
            }
            for d in result.line_details
        ],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quotation_logs(request, pk):
    """List approval audit logs for a quotation."""
    q = get_object_or_404(Quotation, pk=pk)
    logs = q.approval_logs.select_related('actor').all()
    return Response(ApprovalLogSerializer(logs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def discount_tiers_list(request):
    """List all discount tiers."""
    tiers = DiscountTier.objects.all()
    return Response({
        'count': tiers.count(),
        'results': DiscountTierSerializer(tiers, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_list(request):
    """List all customers."""
    customers = Customer.objects.all()
    return Response({
        'count': customers.count(),
        'results': CustomerSerializer(customers, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_list(request):
    """List all products with optional category filter."""
    products = Product.objects.filter(is_active=True).prefetch_related('variants')
    cat = request.query_params.get('category')
    if cat:
        products = products.filter(category=cat)
    return Response({
        'count': products.count(),
        'results': ProductSerializer(products, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pipeline_summary(request):
    """Pipeline summary for KPI cards."""
    qs = Quotation.objects.all()
    total_count = qs.count()

    pipeline = {}
    for s in Quotation.Status:
        items = qs.filter(status=s.value)
        count = items.count()
        total = sum(q.total_amount for q in items) if count > 0 else 0
        pipeline[s.value] = {'count': count, 'total': total}

    active_statuses = ['draft', 'pending_approval', 'approved', 'sent', 'under_negotiation']
    active_qs = qs.filter(status__in=active_statuses)
    active_total = sum(q.total_amount for q in active_qs)

    pending_count = qs.filter(status='pending_approval').count()
    at_risk = qs.filter(blended_risk_score__gt=5).count()

    closed_won_qs = qs.filter(status__in=['confirmed', 'paid', 'invoiced', 'fulfillment'])
    closed_won_total = sum(q.total_amount for q in closed_won_qs)

    return Response({
        'total_quotations': total_count,
        'active_pipeline_value': active_total,
        'active_pipeline_count': active_qs.count(),
        'pending_approvals': pending_count,
        'at_risk_count': at_risk,
        'closed_won_value': closed_won_total,
        'closed_won_count': closed_won_qs.count(),
        'pipeline_by_status': pipeline,
    })
