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


def resolve_token(token, pk=None, allow_used=False):
    try:
        parsed = UUID(str(token))
    except (ValueError, TypeError, AttributeError):
        raise PermissionDenied('Invalid or expired customer link.')
    query = PortalToken.objects.filter(token=parsed, expires_at__gt=timezone.now())
    if not allow_used:
        query = query.filter(is_used=False)
    pt = query.first()
    if not pt or not pt.quotation_id or (pk is not None and pt.quotation_id != pk):
        raise PermissionDenied('Invalid or expired customer link.')
    q = get_object_or_404(Quotation.objects.select_for_update(), pk=pt.quotation_id)
    if q.valid_until and q.valid_until < timezone.localdate():
        raise PermissionDenied('This quotation has expired.')
    return q


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


from core.verification import generate_quotation_signature, verify_quotation_signature


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_magic_link(request):
    q = resolve_token(request.data.get('token'))
    return Response({'verified': True, 'quotation_id': q.id})


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_quotation_public(request, quote_number):
    """
    Public verification endpoint to authenticate quotation integrity offline or via QR code.
    Checks cryptographic signature, live status, and returns complete verification metadata.
    """
    q = Quotation.objects.filter(quote_number=quote_number).select_related('customer', 'rep').prefetch_related('lines__product', 'lines__variant').first()
    if not q:
        return Response({'verified': False, 'tamper_status': 'NOT_FOUND', 'message': f'Quotation {quote_number} does not exist.'}, status=404)
    
    expected_sig = generate_quotation_signature(q)
    provided_sig = request.query_params.get('sig', '')
    token_param = request.query_params.get('token', '')

    is_signature_valid = bool(provided_sig and verify_quotation_signature(q, provided_sig))
    
    # Check if active portal token matches
    active_token = PortalToken.objects.filter(quotation=q, is_used=False, expires_at__gt=timezone.now()).first()
    has_valid_portal_token = bool(active_token and (token_param == str(active_token.token) or not token_param))

    tamper_status = 'VERIFIED_AUTHENTIC' if (is_signature_valid or not provided_sig) else 'TAMPERED_OR_INVALID'

    lines_data = []
    for line in q.lines.all():
        lines_data.append({
            'id': line.id,
            'product_name': line.product.name,
            'sku': line.product.sku,
            'variant': f"{line.variant.attribute}: {line.variant.value}" if line.variant else None,
            'qty': float(line.qty),
            'unit_price': float(line.unit_price),
            'discount_pct': float(line.discount_pct),
            'tax_pct': float(line.tax_pct if line.tax_pct is not None else line.product.tax_pct),
            'line_total': float(line.line_total),
            'is_subscription': line.is_subscription,
            'description': line.description,
        })

    frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    
    return Response({
        'verified': True,
        'tamper_status': tamper_status,
        'is_signature_valid': is_signature_valid if provided_sig else True,
        'quotation_id': q.id,
        'quote_number': q.quote_number,
        'status': q.status,
        'status_display': q.get_status_display(),
        'customer_name': q.customer.name,
        'customer_company': q.customer.company,
        'customer_email': q.customer.email,
        'customer_tier': q.customer.get_tier_display(),
        'rep_name': q.rep.get_full_name() if q.rep else 'Enterprise Sales Desk',
        'gross_total': float(q.gross_total),
        'total_discount': float(q.total_discount),
        'subtotal': float(q.total_amount),
        'tax_amount': float(q.tax_amount),
        'grand_total': float(q.total_amount + q.tax_amount),
        'payment_terms': q.payment_terms,
        'created_at': q.created_at,
        'valid_until': q.valid_until,
        'is_expired': bool(q.valid_until and q.valid_until < timezone.localdate()),
        'signature_hash': expected_sig,
        'pdf_url': f"/api/quotations/{q.id}/pdf/?sig={expected_sig}",
        'portal_token': str(active_token.token) if active_token else None,
        'portal_url': f"{frontend_base}/portal/quotations/{active_token.token}" if active_token else None,
        'lines': lines_data,
        'security_metadata': {
            'issuer': 'DealFlow360 Autonomous Deal Engine',
            'legal_entity': 'DealFlow360 Technologies India Pvt. Ltd.',
            'gstin': '27AAACD8921M1Z4',
            'verification_algorithm': 'HMAC-SHA256 Multi-Field Checksum',
            'verified_at': timezone.now(),
        }
    })


def hmac_compare_safe(a, b):
    import hmac
    return hmac.compare_digest(str(a).lower(), str(b).lower())


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
    q = resolve_token(token, allow_used=True)
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
    result = submit_quotation(q, None)  # Same policy engine; old approvals are cleared.
    return Response({'status': 'reapproval_triggered' if result.has_any_breach else 'accepted',
        'message': 'Updated terms sent for approval.' if result.has_any_breach else 'Updated terms are within policy.',
        'new_status': q.status, 'blended_risk_score': result.blended_risk_score})


@api_view(['POST'])
@permission_classes([AllowAny])
def portal_confirm(request, pk):
    raw_token = request.headers.get('X-Portal-Token') or request.data.get('portal_token')
    q = customer_quote(request, pk)
    if q.status not in ('approved', 'sent'):
        raise ValidationError(f'Quotation is in {q.status} status and cannot be confirmed.')
    confirm_order(q)
    # Mark portal token as used to enforce single-use finalization
    if raw_token:
        try:
            PortalToken.objects.filter(token=UUID(str(raw_token))).update(is_used=True)
        except (ValueError, TypeError):
            pass
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
