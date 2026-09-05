"""
Quotation views — CRUD + pipeline.
Person A will expand with approval state machine.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Quotation, QuotationLine, Customer, Product, DiscountTier
from .serializers import (
    QuotationSerializer, QuotationListSerializer,
    CustomerSerializer, ProductSerializer, DiscountTierSerializer,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quotation_list(request):
    """List quotations — supports filtering by status, customer, rep."""
    qs = Quotation.objects.select_related('customer', 'rep').prefetch_related('lines')
    stat = request.query_params.get('status')
    if stat:
        qs = qs.filter(status=stat)
    rep_id = request.query_params.get('rep')
    if rep_id:
        qs = qs.filter(rep_id=rep_id)
    return Response(QuotationListSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quotation_detail(request, pk):
    """Full quotation detail with lines and approval logs."""
    try:
        q = Quotation.objects.select_related('customer', 'rep').prefetch_related(
            'lines__product', 'approval_logs__actor'
        ).get(pk=pk)
    except Quotation.DoesNotExist:
        return Response({'detail': 'Not found'}, status=404)
    return Response(QuotationSerializer(q).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_create(request):
    """Create a new quotation."""
    import uuid
    data = request.data
    try:
        customer = Customer.objects.get(id=data.get('customer_id'))
    except Customer.DoesNotExist:
        return Response({'detail': 'Customer not found'}, status=400)
    q = Quotation.objects.create(
        quote_number=f"Q-{Quotation.objects.count() + 1001}",
        customer=customer,
        rep=request.user,
        status='draft',
        notes=data.get('notes', ''),
        portal_token=str(uuid.uuid4()),
    )
    return Response(QuotationSerializer(q).data, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_submit(request, pk):
    """Submit quotation for approval — triggers blended risk score calculation."""
    try:
        q = Quotation.objects.get(pk=pk)
    except Quotation.DoesNotExist:
        return Response({'detail': 'Not found'}, status=404)

    # Calculate blended risk score
    from decimal import Decimal
    total_over = Decimal('0')
    worst_line_over = Decimal('0')
    total_value = Decimal('0')

    customer_tier = q.customer.tier
    for line in q.lines.all():
        try:
            dt = DiscountTier.objects.get(tier=customer_tier, category=line.product.category)
            ceiling = dt.max_discount_pct
        except DiscountTier.DoesNotExist:
            ceiling = Decimal('5')  # default conservative ceiling

        over = max(Decimal('0'), line.discount_pct - ceiling)
        line_value = line.qty * line.unit_price
        total_over += over * line_value / 100
        worst_line_over = max(worst_line_over, over)
        total_value += line_value

    if total_value > 0:
        blended = (total_over / total_value * 100 + worst_line_over) / 2
    else:
        blended = Decimal('0')

    q.blended_risk_score = blended

    if blended <= 0:
        q.status = 'approved'
    else:
        q.status = 'pending_approval'

    q.save()

    # Create approval log
    from .models import ApprovalLog
    ApprovalLog.objects.create(
        quotation=q,
        action='submitted',
        actor=request.user,
        note=f'Blended risk score: {blended:.2f}%',
        role_required='sales_manager' if blended > 0 else 'none',
    )

    return Response(QuotationSerializer(q).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_list(request):
    """List all customers."""
    customers = Customer.objects.all()
    return Response(CustomerSerializer(customers, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_list(request):
    """List all products."""
    products = Product.objects.filter(is_active=True).prefetch_related('variants')
    category = request.query_params.get('category')
    if category:
        products = products.filter(category=category)
    return Response(ProductSerializer(products, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pipeline_summary(request):
    """Pipeline summary for dashboard KPI cards."""
    from django.db.models import Count, Sum, Avg
    from decimal import Decimal

    qs = Quotation.objects.all()
    total_count = qs.count()

    # Pipeline by status
    pipeline = {}
    for s in Quotation.Status:
        items = qs.filter(status=s.value)
        count = items.count()
        total = sum(q.total_amount for q in items) if count > 0 else 0
        pipeline[s.value] = {'count': count, 'total': total}

    # Total active pipeline
    active_statuses = ['draft', 'pending_approval', 'approved', 'sent', 'under_negotiation']
    active_qs = qs.filter(status__in=active_statuses)
    active_total = sum(q.total_amount for q in active_qs)

    # Pending approvals
    pending_count = qs.filter(status='pending_approval').count()

    # At risk
    at_risk = qs.filter(blended_risk_score__gt=5).count()

    return Response({
        'total_quotations': total_count,
        'active_pipeline_value': active_total,
        'active_pipeline_count': active_qs.count(),
        'pending_approvals': pending_count,
        'at_risk_count': at_risk,
        'pipeline_by_status': pipeline,
    })
