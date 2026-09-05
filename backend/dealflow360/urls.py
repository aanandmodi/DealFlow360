"""
URL configuration for DealFlow360 project.
Root router includes each app's urls.py under /api/.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import ProductViewSet, CustomerViewSet, ProductCategoryViewSet

# Customize Django Admin header
admin.site.site_header = 'DealFlow360 Administration'
admin.site.site_title = 'DealFlow360 Admin'
admin.site.index_title = 'Backend Configuration'

# Top-level router for products & customers (shared across apps)
api_router = DefaultRouter()
api_router.register(r'products', ProductViewSet)
api_router.register(r'customers', CustomerViewSet)
api_router.register(r'categories', ProductCategoryViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    # Auth endpoints (Person C — core app)
    path('api/auth/', include('core.urls')),
    # Products & Customers at /api/products/, /api/customers/
    path('api/', include(api_router.urls)),
    # Quotation endpoints (Person A — quotations app)
    path('api/quotations/', include('quotations.urls')),
    # Fulfillment endpoints (Person B — fulfillment app)
    path('api/', include('fulfillment.urls')),
    # Billing endpoints (Person B — billing app)
    path('api/', include('billing.urls')),
    # Portal & Dashboard endpoints (Person C — portal app)
    path('api/', include('portal.urls')),
]

