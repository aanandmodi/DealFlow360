"""
Portal views — magic-link auth, customer negotiation, dashboard endpoints.
Person C owns this app.
"""
import uuid
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import PortalToken, NegotiationMessage
from .serializers import (
    PortalQuotationSerializer, NegotiationMessageSerializer,
    MagicLinkRequestSerializer, CounterDiscountSerializer, CommentSerializer,
)
from .services.anomaly import get_stalled_deals, get_discount_anomalies, get_delivery_slippage, get_dashboard_summary
from quotations.models import Quotation, QuotationLine, DiscountTier, ApprovalLog


# ── Portal Auth ──────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def request_magic_link(request):
    """Generate a magic-link token for portal access."""
    serializer = MagicLinkRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email']
    quotation_id = serializer.validated_data.get('quotation_id')

    # Find customer user
    from core.models import User
    customer = User.objects.filter(email=email, role='customer').first()

    hours = getattr(settings, 'PORTAL_MAGIC_LINK_EXPIRY_HOURS', 24)
    token = PortalToken.objects.create(
        email=email,
        customer=customer,
        quotation_id=quotation_id,
        expires_at=timezone.now() + timedelta(hours=hours),
    )

    # In production, you'd email this link. For the demo, return it directly.
    frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:5173'
    magic_link = f"{frontend_url}/portal/verify?token={token.token}"

    return Response({
        'message': 'Magic link generated',
        'token': str(token.token),
        'link': magic_link,
        'expires_at': token.expires_at.isoformat(),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_magic_link(request):
    """Verify a magic-link token and return portal session."""
    token_str = request.data.get('token')
    if not token_str:
        return Response({'detail': 'Token required'}, status=400)

    try:
        portal_token = PortalToken.objects.get(token=token_str)
    except PortalToken.DoesNotExist:
        return Response({'detail': 'Invalid token'}, status=404)

    if not portal_token.is_valid:
        return Response({'detail': 'Token expired or already used'}, status=400)

    portal_token.is_used = True
    portal_token.save()

    # If customer user exists, generate JWT
    tokens = None
    if portal_token.customer:
        refresh = RefreshToken.for_user(portal_token.customer)
        tokens = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }

    return Response({
        'verified': True,
        'email': portal_token.email,
        'quotation_id': portal_token.quotation_id,
        'tokens': tokens,
    })


# ── Portal Quotation Views ─────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def portal_quotations_list(request):
    """Customer-facing list of quotations available in portal."""
    qs = Quotation.objects.select_related('customer', 'rep').order_by('-updated_at')

    # Optional customer email filter if passed
    email = request.query_params.get('email')
    if email:
        qs = qs.filter(customer__email__iexact=email)

    data = []
    for q in qs:
        data.append({
            'id': q.id,
            'quote_number': q.quote_number,
            'customer_name': q.customer.name if q.customer else 'Customer',
            'customer_company': q.customer.company if q.customer else '',
            'customer_tier': q.customer.tier if q.customer else 'bronze',
            'status': q.status,
            'status_display': q.get_status_display(),
            'total_amount': float(q.total_amount),
            'portal_token': q.portal_token or str(q.id),
            'valid_until': q.valid_until.isoformat() if q.valid_until else None,
            'created_at': q.created_at.isoformat(),
        })
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def portal_quotation_view(request, token):
    """Customer-facing quotation view via portal token, quote number, ID, or 'default'."""
    quotation = None

    # 1. Handle special keywords: 'default', 'latest', 'active', 'demo', 'under_negotiation'
    if token in ('default', 'latest', 'active', 'demo', 'under_negotiation'):
        quotation = Quotation.objects.select_related('customer', 'rep').prefetch_related(
            'lines__product', 'negotiation_messages__line_ref',
        ).filter(status='under_negotiation').first()
        if not quotation:
            quotation = Quotation.objects.select_related('customer', 'rep').prefetch_related(
                'lines__product', 'negotiation_messages__line_ref',
            ).first()

    # 2. Try PortalToken model lookup
    if not quotation:
        try:
            pt = PortalToken.objects.select_related('quotation').get(token=token)
            if pt.is_valid and pt.quotation:
                quotation = Quotation.objects.select_related('customer', 'rep').prefetch_related(
                    'lines__product', 'negotiation_messages__line_ref',
                ).get(pk=pt.quotation.pk)
        except (PortalToken.DoesNotExist, Exception):
            pass

    # 3. Try portal_token field on Quotation
    if not quotation:
        quotation = Quotation.objects.select_related('customer', 'rep').prefetch_related(
            'lines__product', 'negotiation_messages__line_ref',
        ).filter(portal_token=token).first()

    # 4. Try quote_number (e.g. Q-1042 or 1042)
    if not quotation:
        clean_num = token.strip().upper()
        if not clean_num.startswith('Q-') and clean_num.isdigit():
            clean_num = f'Q-{clean_num}'
        quotation = Quotation.objects.select_related('customer', 'rep').prefetch_related(
            'lines__product', 'negotiation_messages__line_ref',
        ).filter(quote_number__iexact=clean_num).first()

    # 5. Try primary key / numeric ID
    if not quotation and token.isdigit():
        quotation = Quotation.objects.select_related('customer', 'rep').prefetch_related(
            'lines__product', 'negotiation_messages__line_ref',
        ).filter(pk=int(token)).first()

    if not quotation:
        return Response({'detail': 'Quotation not found'}, status=404)

    data = PortalQuotationSerializer(quotation).data
    return Response(data)


# ── Portal Negotiation ──────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def portal_comment(request, pk):
    """Customer submits a line-level comment."""
    try:
        quotation = Quotation.objects.get(pk=pk)
    except Quotation.DoesNotExist:
        return Response({'detail': 'Quotation not found'}, status=404)

    serializer = CommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    line_ref = None
    line_id = serializer.validated_data.get('line_id')
    if line_id:
        try:
            line_ref = QuotationLine.objects.get(pk=line_id, quotation=quotation)
        except QuotationLine.DoesNotExist:
            pass

    msg = NegotiationMessage.objects.create(
        quotation=quotation,
        author_type='customer',
        author_name=quotation.customer.name,
        message=serializer.validated_data['message'],
        line_ref=line_ref,
    )

    # Update quotation status to under_negotiation
    if quotation.status in ('sent', 'approved'):
        quotation.status = 'under_negotiation'
        quotation.save()

    return Response(NegotiationMessageSerializer(msg).data, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def portal_counter_discount(request, pk):
    """
    Customer submits a counter-discount proposal.
    If the new discount exceeds the threshold, re-triggers the approval flow.
    """
    try:
        quotation = Quotation.objects.select_related('customer').prefetch_related('lines__product').get(pk=pk)
    except Quotation.DoesNotExist:
        return Response({'detail': 'Quotation not found'}, status=404)

    serializer = CounterDiscountSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    counter_pct = serializer.validated_data['counter_discount_percent']
    message = serializer.validated_data.get('message', '')

    # Record the negotiation message
    NegotiationMessage.objects.create(
        quotation=quotation,
        author_type='customer',
        author_name=quotation.customer.name,
        message=message or f'Counter-discount proposal: {counter_pct}%',
        counter_discount_percent=counter_pct,
    )

    # Check if counter-discount exceeds thresholds
    customer_tier = quotation.customer.tier
    needs_re_approval = False

    for line in quotation.lines.all():
        try:
            dt = DiscountTier.objects.get(tier=customer_tier, category=line.product.category)
            ceiling = dt.max_discount_pct
        except DiscountTier.DoesNotExist:
            ceiling = Decimal('5')

        if counter_pct > ceiling:
            needs_re_approval = True
            break

    if needs_re_approval:
        # Re-trigger approval flow — reuse the real approval machinery
        quotation.status = 'pending_approval'

        # Recalculate blended risk score with new counter-discount
        total_over = Decimal('0')
        worst_line_over = Decimal('0')
        total_value = Decimal('0')

        for line in quotation.lines.all():
            try:
                dt = DiscountTier.objects.get(tier=customer_tier, category=line.product.category)
                ceiling = dt.max_discount_pct
            except DiscountTier.DoesNotExist:
                ceiling = Decimal('5')

            effective_discount = max(line.discount_pct, counter_pct)
            over = max(Decimal('0'), effective_discount - ceiling)
            line_value = line.qty * line.unit_price
            total_over += over * line_value / 100
            worst_line_over = max(worst_line_over, over)
            total_value += line_value

        if total_value > 0:
            blended = (total_over / total_value * 100 + worst_line_over) / 2
        else:
            blended = Decimal('0')

        quotation.blended_risk_score = blended
        quotation.save()

        # Log the re-submission
        ApprovalLog.objects.create(
            quotation=quotation,
            action='re_submitted',
            note=f'Customer counter-discount {counter_pct}% triggered re-approval. Blended risk: {blended:.2f}%',
            role_required='sales_manager',
        )

        return Response({
            'status': 'reapproval_triggered',
            'message': f'Counter-discount of {counter_pct}% exceeds threshold. Quotation re-entered approval flow.',
            'blended_risk_score': float(blended),
            'new_status': 'pending_approval',
        })
    else:
        quotation.status = 'under_negotiation'
        quotation.save()

        return Response({
            'status': 'accepted',
            'message': f'Counter-discount of {counter_pct}% is within allowed limits.',
            'new_status': 'under_negotiation',
        })


@api_view(['POST'])
@permission_classes([AllowAny])
def portal_confirm(request, pk):
    """Customer confirms the quotation."""
    try:
        quotation = Quotation.objects.get(pk=pk)
    except Quotation.DoesNotExist:
        return Response({'detail': 'Quotation not found'}, status=404)

    if quotation.status in ('pending_approval', 'rejected'):
        return Response({
            'detail': f'Cannot confirm — quotation is {quotation.get_status_display()}'
        }, status=400)

    quotation.status = 'confirmed'
    quotation.save()

    NegotiationMessage.objects.create(
        quotation=quotation,
        author_type='customer',
        author_name=quotation.customer.name,
        message='Quotation confirmed by customer.',
    )

    return Response({
        'status': 'confirmed',
        'message': 'Quotation has been confirmed. Proceeding to fulfillment.',
    })


# ── Dashboard Endpoints ──────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """Dashboard KPI summary."""
    summary = get_dashboard_summary()
    return Response(summary)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stalled_deals(request):
    """List stalled deals."""
    threshold = request.query_params.get('threshold_days')
    threshold = int(threshold) if threshold else None
    stalled = get_stalled_deals(threshold)
    return Response(stalled)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_anomalies(request):
    """List discount anomalies."""
    threshold = request.query_params.get('threshold_pct')
    threshold = float(threshold) if threshold else None
    anomalies = get_discount_anomalies(threshold)
    return Response(anomalies)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_slippage(request):
    """List delivery slippage."""
    slippage = get_delivery_slippage()
    return Response(slippage)
