from django.urls import path
from . import views

urlpatterns = [
    # Portal auth
    path('auth/portal/request-magic-link/', views.request_magic_link, name='portal-magic-link'),
    path('auth/portal/verify/', views.verify_magic_link, name='portal-verify'),

    # Portal quotation (customer-facing)
    path('portal/quotations/', views.portal_quotations_list, name='portal-quotations-list'),
    path('portal/quotations/<str:token>/', views.portal_quotation_view, name='portal-quotation'),
    path('portal/quotations/<int:pk>/comment/', views.portal_comment, name='portal-comment'),
    path('portal/quotations/<int:pk>/counter-discount/', views.portal_counter_discount, name='portal-counter-discount'),
    path('portal/quotations/<int:pk>/confirm/', views.portal_confirm, name='portal-confirm'),

    # Dashboard
    path('dashboard/summary/', views.dashboard_summary, name='dashboard-summary'),
    path('dashboard/stalled-deals/', views.dashboard_stalled_deals, name='dashboard-stalled'),
    path('dashboard/anomalies/', views.dashboard_anomalies, name='dashboard-anomalies'),
    path('dashboard/slippage/', views.dashboard_slippage, name='dashboard-slippage'),
]
