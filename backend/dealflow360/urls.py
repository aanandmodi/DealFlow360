"""
URL configuration for DealFlow360 project.
Root router includes each app's urls.py under /api/.
"""
from django.contrib import admin
from django.urls import path, include

# Customize Django Admin header
admin.site.site_header = 'DealFlow360 Administration'
admin.site.site_title = 'DealFlow360 Admin'
admin.site.index_title = 'Backend Configuration'

urlpatterns = [
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
