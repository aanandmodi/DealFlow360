"""
URL configuration for DealFlow360 project.
Root router includes each app's urls.py under /api/.
"""
from django.contrib import admin
from django.urls import path, include
from core.views import health_view
from core.intelligence import pricing_scenarios, deal_readiness, inventory_readiness, receive_stock, deal_conversation
from core.configuration import configuration
from core.reporting import reports, quotation_pdf, nudge

# Customize Django Admin header
admin.site.site_header = 'DealFlow360 Administration'
admin.site.site_title = 'DealFlow360 Admin'
admin.site.index_title = 'Backend Configuration'

urlpatterns = [
    path('api/quotations/<int:pk>/scenarios/', pricing_scenarios),
    path('api/quotations/<int:pk>/conversation/', deal_conversation),
    path('api/quotations/<int:pk>/readiness/', deal_readiness),
    path('api/inventory/readiness/', inventory_readiness),
    path('api/inventory/<int:pk>/receive/', receive_stock),
    path('api/health/', health_view),
    path('api/config/<str:resource>/', configuration),
    path('api/config/<str:resource>/<int:pk>/', configuration),
    path('api/reports/export/', reports),
    path('api/reports/', reports),
    path('api/quotations/<int:pk>/pdf/', quotation_pdf),
    path('api/quotations/<int:pk>/nudge/', nudge),
    path('admin/', admin.site.urls),
    # Auth endpoints (Person C — core app)
    path('api/auth/', include('core.urls')),
    # Quotation endpoints (Person A — quotations app)
    path('api/', include('quotations.urls')),
    # Fulfillment endpoints (Person B — fulfillment app)
    path('api/', include('fulfillment.urls')),
    # Billing endpoints (Person B — billing app)
    path('api/', include('billing.urls')),
    # Portal & Dashboard endpoints (Person C — portal app)
    path('api/', include('portal.urls')),
]
