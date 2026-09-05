from django.urls import path
from . import views

urlpatterns = [
    # Quotations CRUD
    path('quotations/', views.quotation_list, name='quotation-list'),
    path('quotations/create/', views.quotation_create, name='quotation-create'),
    path('quotations/<int:pk>/', views.quotation_detail, name='quotation-detail'),
    path('quotations/<int:pk>/lines/', views.quotation_lines, name='quotation-lines'),
    path('quotations/<int:pk>/lines/<int:line_id>/', views.quotation_line_detail, name='quotation-line-detail'),

    # Approval State Machine Actions
    path('quotations/<int:pk>/submit/', views.quotation_submit, name='quotation-submit'),
    path('quotations/<int:pk>/approve/', views.quotation_approve, name='quotation-approve'),
    path('quotations/<int:pk>/reject/', views.quotation_reject, name='quotation-reject'),
    path('quotations/<int:pk>/return/', views.quotation_return, name='quotation-return'),
    path('quotations/<int:pk>/confirm/', views.quotation_confirm, name='quotation-confirm'),

    # Risk Score & Audit Logs
    path('quotations/<int:pk>/risk-score/', views.quotation_risk_score, name='quotation-risk-score'),
    path('quotations/<int:pk>/logs/', views.quotation_logs, name='quotation-logs'),

    # Catalogs & Config
    path('quotations/discount-tiers/', views.discount_tiers_list, name='quotation-discount-tiers'),
    path('quotations/pipeline-summary/', views.pipeline_summary, name='pipeline-summary'),
    path('customers/', views.customer_list, name='customer-list'),
    path('products/', views.product_list, name='product-list'),
]
