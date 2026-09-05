from django.urls import path
from . import views

urlpatterns = [
    path('quotations/', views.quotation_list, name='quotation-list'),
    path('quotations/<int:pk>/', views.quotation_detail, name='quotation-detail'),
    path('quotations/create/', views.quotation_create, name='quotation-create'),
    path('quotations/<int:pk>/submit/', views.quotation_submit, name='quotation-submit'),
    path('quotations/pipeline-summary/', views.pipeline_summary, name='pipeline-summary'),
    path('customers/', views.customer_list, name='customer-list'),
    path('products/', views.product_list, name='product-list'),
]
