from decimal import Decimal
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from core.permissions import IsInternalUser
from core.access import quote_for, scoped_quotes, require_roles
from .models import Subscription, SubscriptionPlan, Invoice
from .services.proration import get_billing_schedule, prorate_subscription_change, cancel_subscription
from .services.upsell import get_upsell_suggestions
from .services.lifecycle import invoice_data, record_payment
from .serializers import ProrateRequestSerializer


@api_view(['GET'])
@permission_classes([IsInternalUser])
def billing_schedule_view(request, quotation_id):
    return Response(get_billing_schedule(quote_for(request, quotation_id)))


def subscription_for(request, line_id):
    require_roles(request.user, 'finance', 'admin')
    sub = get_object_or_404(Subscription.objects.select_related('line__quotation', 'plan'), line_id=line_id)
    quote_for(request, sub.line.quotation_id, lock=True)
    return Subscription.objects.select_for_update().get(pk=sub.pk)


@api_view(['POST'])
@permission_classes([IsInternalUser])
def prorate_view(request, line_id):
    sub = subscription_for(request, line_id)
    serializer = ProrateRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if data['change_date'] != timezone.localdate():
        raise serializers.ValidationError('Changes take effect today. Backdated and scheduled changes are not supported.')
    plan = get_object_or_404(SubscriptionPlan, pk=data['new_plan_id'], is_active=True) if data.get('new_plan_id') else None
    result = prorate_subscription_change(sub, data['change_date'], plan, data.get('new_quantity'))
    audit_subscription(request, sub, 'Subscription quantity/plan changed with proration.')
    return Response(result.to_dict())


@api_view(['POST'])
@permission_classes([IsInternalUser])
def cancel_subscription_view(request, line_id):
    sub = subscription_for(request, line_id)
    result = cancel_subscription(sub, timezone.localdate())
    audit_subscription(request, sub, 'Subscription cancelled and unused-period credit recorded.')
    return Response({'message': 'Subscription cancelled.', 'credit_note_amount': str(result.credit_amount), 'proration': result.to_dict()})


@api_view(['GET'])
@permission_classes([IsInternalUser])
def upsell_suggestions_view(request, quotation_id):
    return Response({'suggestions': [s.to_dict() for s in get_upsell_suggestions(quote_for(request, quotation_id))]})


@api_view(['GET'])
@permission_classes([IsInternalUser])
def invoice_list(request):
    invoices = Invoice.objects.filter(quotation__in=scoped_quotes(request.user)).select_related('quotation__customer')
    return Response([invoice_data(i) for i in invoices])


class PaymentInput(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    method = serializers.ChoiceField(choices=['bank_transfer', 'upi', 'card', 'cash'])
    reference = serializers.CharField(max_length=100, min_length=3)


@api_view(['POST'])
@permission_classes([IsInternalUser])
def invoice_payment(request, pk):
    require_roles(request.user, 'finance', 'admin')
    invoice = get_object_or_404(Invoice, pk=pk, quotation__in=scoped_quotes(request.user))
    quote_for(request, invoice.quotation_id, lock=True)
    serializer = PaymentInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(record_payment(invoice, serializer.validated_data, request.user))



def audit_subscription(request, sub, note):
    from quotations.models import ApprovalLog
    ApprovalLog.objects.create(quotation=sub.line.quotation, actor=request.user, action='subscription',
                               role_required=request.user.role, note=note)
