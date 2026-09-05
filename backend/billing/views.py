"""
DRF views for the Billing app — Person B.

Endpoints:
  GET  /api/billing/{quotation_id}/schedule/
  POST /api/billing/{line_id}/prorate/
  POST /api/billing/{line_id}/cancel/
  GET  /api/quotations/{id}/upsell-suggestions/  (shared contract)
"""
from datetime import date

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from quotations.models import Quotation
from .models import SubscriptionPlan
from .serializers import (
    UpsellSuggestionResponseSerializer,
    ProrateRequestSerializer,
    ProrationResponseSerializer,
)
from .services.proration import (
    get_billing_schedule,
    prorate_subscription_change,
    cancel_subscription,
)
from .services.upsell import get_upsell_suggestions


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_schedule_view(request, quotation_id):
    """
    GET /api/billing/{quotation_id}/schedule/

    Returns the billing schedule for a quotation, separating one-time
    and recurring lines.
    """
    try:
        quotation = Quotation.objects.get(pk=quotation_id)
    except Quotation.DoesNotExist:
        return Response(
            {'error': f'Quotation {quotation_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    schedule = get_billing_schedule(quotation)
    return Response(schedule, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def prorate_view(request, line_id):
    """
    POST /api/billing/{line_id}/prorate/

    Triggers proration calculation for a subscription line change.
    """
    # For the MVP, we look up by quotation line ID and find/create a subscription
    from billing.models import SubscriptionPlan
    from quotations.models import QuotationLine

    try:
        q_line = QuotationLine.objects.select_related('product').get(pk=line_id)
    except QuotationLine.DoesNotExist:
        return Response(
            {'error': f'Quotation line {line_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = ProrateRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # Find a subscription plan for this product
    plan = SubscriptionPlan.objects.filter(
        product=q_line.product, is_active=True
    ).first()

    if not plan:
        return Response(
            {'error': 'No active subscription plan for this product'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create a mock subscription line for proration calc
    from dataclasses import dataclass
    from decimal import Decimal

    @dataclass
    class MockSubLine:
        plan: object
        start_date: date
        next_billing_date: date
        prorated_amount: Decimal = Decimal("0.00")
        credit_note_amount: Decimal = Decimal("0.00")
        status: str = 'active'
        cancelled_at: object = None

        def save(self):
            pass  # MVP: no actual persistence yet

    sub_line = MockSubLine(
        plan=plan,
        start_date=data['change_date'] - __import__('datetime').timedelta(days=15),
        next_billing_date=data['change_date'] + __import__('datetime').timedelta(days=15),
    )

    new_plan = None
    if 'new_plan_id' in data:
        try:
            new_plan = SubscriptionPlan.objects.get(pk=data['new_plan_id'])
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {'error': f"Plan {data['new_plan_id']} not found"},
                status=status.HTTP_404_NOT_FOUND
            )

    result = prorate_subscription_change(
        subscription_line=sub_line,
        change_date=data['change_date'],
        new_plan=new_plan,
        new_quantity=data.get('new_quantity'),
    )

    return Response(result.to_dict(), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_subscription_view(request, line_id):
    """
    POST /api/billing/{line_id}/cancel/

    Cancel a subscription and generate a credit note for unused days.
    """
    from quotations.models import QuotationLine

    try:
        q_line = QuotationLine.objects.select_related('product').get(pk=line_id)
    except QuotationLine.DoesNotExist:
        return Response(
            {'error': f'Quotation line {line_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    plan = SubscriptionPlan.objects.filter(
        product=q_line.product, is_active=True
    ).first()

    if not plan:
        return Response(
            {'error': 'No active subscription plan for this product'},
            status=status.HTTP_400_BAD_REQUEST
        )

    from dataclasses import dataclass
    from decimal import Decimal

    @dataclass
    class MockSubLine:
        plan: object
        start_date: date
        next_billing_date: date
        prorated_amount: Decimal = Decimal("0.00")
        credit_note_amount: Decimal = Decimal("0.00")
        status: str = 'active'
        cancelled_at: object = None

        def save(self):
            pass

    cancel_date = date.today()
    sub_line = MockSubLine(
        plan=plan,
        start_date=cancel_date - __import__('datetime').timedelta(days=15),
        next_billing_date=cancel_date + __import__('datetime').timedelta(days=15),
    )

    result = cancel_subscription(sub_line, cancel_date)

    return Response({
        'message': 'Subscription cancelled.',
        'credit_note_amount': str(result.credit_amount),
        'proration': result.to_dict(),
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def upsell_suggestions_view(request, quotation_id):
    """
    GET /api/quotations/{quotation_id}/upsell-suggestions/

    SHARED CONTRACT — Person A's Quotation Builder calls this endpoint.
    Do NOT change the response shape without coordinating with Person A.
    """
    try:
        quotation = Quotation.objects.get(pk=quotation_id)
    except Quotation.DoesNotExist:
        return Response(
            {'error': f'Quotation {quotation_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    suggestions = get_upsell_suggestions(quotation)
    serialized = [s.to_dict() for s in suggestions]

    return Response({
        'suggestions': serialized,
    }, status=status.HTTP_200_OK)
