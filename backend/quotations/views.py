"""Quotations app views — all Person A API endpoints."""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from core.permissions import IsManagerOrAbove, IsAdmin

from .models import (
    DiscountTier, CategoryDiscountCeiling, ApprovalChain,
    Quotation, QuotationLine, ApprovalLog,
)
from .serializers import (
    DiscountTierSerializer, CategoryDiscountCeilingSerializer,
    ApprovalChainSerializer, QuotationSerializer, QuotationListSerializer,
    QuotationLineSerializer, ApprovalLogSerializer,
    RiskScoreBreakdownSerializer,
)
from .services.risk_score import (
    compute_risk_score, submit_quotation,
    approve_quotation, reject_quotation, return_quotation,
)


class DiscountTierViewSet(viewsets.ModelViewSet):
    """CRUD for discount tiers (Bronze/Silver/Gold config) - Manager/Admin restricted."""
    queryset = DiscountTier.objects.all()
    serializer_class = DiscountTierSerializer
    permission_classes = [IsManagerOrAbove]


class CategoryDiscountCeilingViewSet(viewsets.ModelViewSet):
    """CRUD for per-category discount ceilings - Manager/Admin restricted."""
    queryset = CategoryDiscountCeiling.objects.select_related('category', 'discount_tier').all()
    serializer_class = CategoryDiscountCeilingSerializer
    permission_classes = [IsManagerOrAbove]


class ApprovalChainViewSet(viewsets.ModelViewSet):
    """CRUD for approval chain configuration - Manager/Admin restricted."""
    queryset = ApprovalChain.objects.all()
    serializer_class = ApprovalChainSerializer
    permission_classes = [IsManagerOrAbove]


class QuotationViewSet(viewsets.ModelViewSet):
    """
    Main quotation CRUD + state machine endpoints.

    List:   GET    /api/quotations/
    Create: POST   /api/quotations/
    Detail: GET    /api/quotations/{id}/
    Update: PATCH  /api/quotations/{id}/
    Delete: DELETE /api/quotations/{id}/

    Actions:
    Submit:     POST /api/quotations/{id}/submit/
    Approve:    POST /api/quotations/{id}/approve/
    Reject:     POST /api/quotations/{id}/reject/
    Return:     POST /api/quotations/{id}/return_for_revision/
    Risk Score: GET  /api/quotations/{id}/risk_score/
    """

    def get_queryset(self):
        qs = Quotation.objects.select_related(
            'customer', 'sales_rep'
        ).prefetch_related(
            'lines__product__category', 'approval_logs__actor'
        )
        user = self.request.user
        if user.is_authenticated and getattr(user, 'role', None) == 'sales_rep' and self.request.query_params.get('scope') != 'all':
            qs = qs.filter(sales_rep=user)
        return qs.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return QuotationListSerializer
        return QuotationSerializer

    filterset_fields = ['status', 'customer', 'sales_rep', 'required_approval_level']
    search_fields = ['customer__name', 'customer__company', 'notes']
    ordering_fields = ['created_at', 'updated_at', 'blended_risk_score']

    def perform_create(self, serializer):
        serializer.save(sales_rep=self.request.user)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit quotation for approval. Computes risk score and routes."""
        quotation = self.get_object()

        if quotation.status not in [Quotation.Status.DRAFT, Quotation.Status.UNDER_NEGOTIATION]:
            return Response(
                {'error': f'Cannot submit quotation in status: {quotation.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not quotation.lines.exists():
            return Response(
                {'error': 'Cannot submit a quotation with no line items.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = submit_quotation(quotation, request.user)

        return Response({
            'status': quotation.status,
            'blended_risk_score': str(result.blended_risk_score),
            'required_approval_level': result.required_approval_level,
            'requires_finance': result.requires_finance,
            'has_any_breach': result.has_any_breach,
            'line_details': [
                {
                    'line_id': d.line_id,
                    'product_name': d.product_name,
                    'category_name': d.category_name,
                    'discount_percent': str(d.discount_percent),
                    'ceiling': str(d.ceiling),
                    'overage': str(d.overage),
                    'policy_status': d.policy_status,
                }
                for d in result.line_details
            ],
            'message': 'Quotation approved automatically (no approval needed).'
                       if result.required_approval_level == 'none'
                       else 'Quotation submitted for approval.',
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve quotation at current approval stage."""
        quotation = self.get_object()
        reason = request.data.get('reason', '')

        try:
            fully_approved = approve_quotation(quotation, request.user, reason)
            quotation.refresh_from_db()
            return Response({
                'status': quotation.status,
                'fully_approved': fully_approved,
                'manager_approved': quotation.manager_approved,
                'finance_approved': quotation.finance_approved,
                'message': 'Quotation fully approved.' if fully_approved
                           else 'Manager approved. Awaiting Finance approval.',
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject quotation."""
        quotation = self.get_object()
        reason = request.data.get('reason', '')

        try:
            reject_quotation(quotation, request.user, reason)
            return Response({
                'status': quotation.status,
                'message': 'Quotation rejected.',
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'], url_path='return')
    def return_for_revision(self, request, pk=None):
        """Return quotation for revision (back to Draft)."""
        quotation = self.get_object()
        reason = request.data.get('reason', '')

        try:
            return_quotation(quotation, request.user, reason)
            return Response({
                'status': quotation.status,
                'message': 'Quotation returned for revision.',
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get'], url_path='risk-score')
    def risk_score(self, request, pk=None):
        """Get detailed risk score breakdown for the approval screen."""
        quotation = self.get_object()
        result = compute_risk_score(quotation)

        return Response({
            'quotation_id': quotation.pk,
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

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm an approved quotation → proceeds to fulfillment."""
        quotation = self.get_object()

        if quotation.status != Quotation.Status.APPROVED:
            return Response(
                {'error': 'Only approved quotations can be confirmed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quotation.status = Quotation.Status.CONFIRMED
        quotation.save()

        return Response({
            'status': quotation.status,
            'message': 'Quotation confirmed. Ready for fulfillment.',
        })


class QuotationLineViewSet(viewsets.ModelViewSet):
    """
    CRUD for quotation lines.
    Nested under quotation: /api/quotations/{quotation_id}/lines/
    """

    serializer_class = QuotationLineSerializer

    def get_queryset(self):
        return QuotationLine.objects.filter(
            quotation_id=self.kwargs['quotation_pk']
        ).select_related('product__category')

    def perform_create(self, serializer):
        quotation = get_object_or_404(Quotation, pk=self.kwargs['quotation_pk'])
        product = serializer.validated_data['product']
        serializer.save(
            quotation=quotation,
            unit_price=serializer.validated_data.get('unit_price', product.base_price),
        )

    def perform_update(self, serializer):
        serializer.save()


class ApprovalLogListView(generics.ListAPIView):
    """List approval logs for a quotation."""
    serializer_class = ApprovalLogSerializer

    def get_queryset(self):
        return ApprovalLog.objects.filter(
            quotation_id=self.kwargs['quotation_pk']
        ).select_related('actor')
