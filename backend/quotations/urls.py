"""Quotations URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DiscountTierViewSet, CategoryDiscountCeilingViewSet,
    ApprovalChainViewSet, QuotationViewSet,
    QuotationLineViewSet, ApprovalLogListView,
)

router = DefaultRouter()
router.register(r'discount-tiers', DiscountTierViewSet)
router.register(r'category-ceilings', CategoryDiscountCeilingViewSet)
router.register(r'approval-chains', ApprovalChainViewSet)
router.register(r'', QuotationViewSet, basename='quotation')

urlpatterns = [
    # Nested line items: /api/quotations/{id}/lines/
    path('<int:quotation_pk>/lines/',
         QuotationLineViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='quotation-lines-list'),
    path('<int:quotation_pk>/lines/<int:pk>/',
         QuotationLineViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}),
         name='quotation-lines-detail'),
    # Approval logs
    path('<int:quotation_pk>/logs/',
         ApprovalLogListView.as_view(),
         name='quotation-logs'),
    # Router URLs (includes submit/approve/reject/return actions)
    path('', include(router.urls)),
]
