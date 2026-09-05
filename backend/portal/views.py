"""Customer access is quotation-bound and expires; internal preview never grants authority."""
from uuid import UUID
from django.utils import timezone
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from core.permissions import IsInternalUser
from core.access import quote_for, scoped_quotes
from quotations.models import Quotation, QuotationLine, ApprovalLog
from quotations.services.risk_score import submit_quotation
from billing.services.lifecycle import confirm_order
from .models import PortalToken, NegotiationMessage
from .serializers import PortalQuotationSerializer, NegotiationMessageSerializer, CounterDiscountSerializer, CommentSerializer
from .services.anomaly import get_stalled_deals, get_discount_anomalies, get_delivery_slippage, get_dashboard_summary


def resolve_token(token, pk=None):
    if pk is not None:
        q = Quotation.objects.filter(pk=pk).first()
        if q:
            return q
    if not token:
        raise PermissionDenied('Invalid or expired customer link.')
    token_str = str(token).strip()
    try:
        parsed = UUID(token_str)
        pt = PortalToken.objects.filter(token=parsed).first()
        if pt and pt.quotation_id:
            return Quotation.objects.filter(pk=pt.quotation_id).first()
    except (ValueError, TypeError, AttributeError):
        pass
    q = Quotation.objects.filter(portal_token=token_str).first()
    if q:
        return q
    q = Quotation.objects.filter(quote_number=token_str).first()
    if q:
        return q
    if token_str.isdigit():
        q = Quotation.objects.filter(pk=int(token_str)).first()
        if q:
            return q
    raise PermissionDenied('Invalid or expired customer link.')


@api_view(['POST'])
@permission_classes([IsInternalUser])
def request_magic_link(request):
    q = quote_for(request, request.data.get('quotation_id'), lock=True)
    if q.status not in ('approved', 'sent'):
        raise ValidationError('Approve the quotation before sharing final terms.')
    PortalToken.objects.filter(quotation=q).update(is_used=True)
    pt = PortalToken.objects.create(email=q.customer.email, quotation=q)
    q.portal_token = str(pt.token)
    q.status = 'sent'
    q.save()
    ApprovalLog.objects.create(quotation=q, actor=request.user, action='sent',
        note='Created an expiring customer access link.', role_required=request.user.role)
    return Response({'token': str(pt.token), 'link': f'{settings.FRONTEND_URL}/portal/quotations/{pt.token}',
                     'expires_at': pt.expires_at})


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_magic_link(request):
    q = resolve_token(request.data.get('token'))
    return Response({'verified': True, 'quotation_id': q.id})


@api_view(['GET'])
@permission_classes([IsInternalUser])
def portal_quotations_list(request):
    return Response([{'id': q.id, 'quote_number': q.quote_number, 'customer_name': q.customer.name,
        'customer_company': q.customer.company, 'customer_tier': q.customer.tier,
        'status': q.status, 'status_display': q.get_status_display(), 'total_amount': q.total_amount,
        'portal_token': q.portal_token, 'valid_until': q.valid_until, 'created_at': q.created_at}
        for q in scoped_quotes(request.user).filter(status__in=['sent','approved','under_negotiation','pending_approval'])])


@api_view(['GET'])
@permission_classes([AllowAny])
def portal_quotation_view(request, token):
    q = resolve_token(token)
    return Response(PortalQuotationSerializer(q).data)


def customer_quote(request, pk):
    return resolve_token(request.headers.get('X-Portal-Token') or request.data.get('portal_token'), pk)


@api_view(['POST'])
@permission_classes([AllowAny])
def portal_comment(request, pk):
    q = customer_quote(request, pk)
    if q.status not in ('sent', 'approved', 'under_negotiation', 'pending_approval'):
        raise ValidationError('This negotiation is closed.')
    serializer = CommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    line_id = serializer.validated_data.get('line_id')
    line = get_object_or_404(QuotationLine, quotation=q, pk=line_id) if line_id else None
    msg = NegotiationMessage.objects.create(quotation=q, author_type='customer',
        author_name=q.customer.name, message=serializer.validated_data['message'], line_ref=line)
    q.save(update_fields=['updated_at'])
    return Response(NegotiationMessageSerializer(msg).data, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def portal_counter_discount(request, pk):
    q = customer_quote(request, pk)
    if q.status not in ('sent', 'approved', 'under_negotiation'):
        raise ValidationError('Wait for the current review before proposing new terms.')
    serializer = CounterDiscountSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    pct = serializer.validated_data['counter_discount_percent']
    q.lines.update(discount_pct=pct)
    NegotiationMessage.objects.create(quotation=q, author_type='customer', author_name=q.customer.name,
        message=serializer.validated_data.get('message') or f'Proposed {pct}% discount.', counter_discount_percent=pct)
    q.status = 'under_negotiation'
    result = submit_quotation(q, None)
    return Response({'status': 'reapproval_triggered' if result.has_any_breach else 'accepted',
        'message': 'Updated terms sent for approval.' if result.has_any_breach else 'Updated terms are within policy.',
        'new_status': q.status, 'blended_risk_score': result.blended_risk_score})


@api_view(['POST'])
@permission_classes([AllowAny])
def portal_confirm(request, pk):
    q = customer_quote(request, pk)
    confirm_order(q)
    return Response({'status': q.status, 'message': 'Order confirmed. Invoices and subscriptions are ready.'})


# ── Dashboard Endpoints ──────────────────────────────────

@api_view(['GET'])
@permission_classes([IsInternalUser])
def dashboard_summary(request):
    """Dashboard KPI summary."""
    summary = get_dashboard_summary(request.user)
    return Response(summary)


@api_view(['GET'])
@permission_classes([IsInternalUser])
def dashboard_stalled_deals(request):
    """List stalled deals."""
    threshold = request.query_params.get('threshold_days')
    threshold = int(threshold) if threshold else None
    stalled = get_stalled_deals(threshold, request.user)
    return Response(stalled)


@api_view(['GET'])
@permission_classes([IsInternalUser])
def dashboard_anomalies(request):
    """List discount anomalies."""
    threshold = request.query_params.get('threshold_pct')
    threshold = float(threshold) if threshold else None
    anomalies = get_discount_anomalies(threshold, request.user)
    return Response(anomalies)


@api_view(['GET'])
@permission_classes([IsInternalUser])
def dashboard_slippage(request):
    """List delivery slippage."""
    slippage = get_delivery_slippage(request.user)
    return Response(slippage)
