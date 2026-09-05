"""
DealFlow360 URL Configuration.
Root router — includes each app's urls.py under /api/...
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls')),
    path('api/quotations/', include('quotations.urls')),
    path('api/fulfillment/', include('fulfillment.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/portal/', include('portal.urls')),
]
