"""
URL routing for the Billing app — Person B.
Included under /api/ from root urls.py.
"""
from django.urls import path
from . import views

urlpatterns = [
    path(
        'billing/<int:quotation_id>/schedule/',
        views.billing_schedule_view,
        name='billing-schedule',
    ),
    path(
        'billing/<int:line_id>/prorate/',
        views.prorate_view,
        name='billing-prorate',
    ),
    path(
        'billing/<int:line_id>/cancel/',
        views.cancel_subscription_view,
        name='billing-cancel',
    ),
    # Shared contract — upsell suggestions
    path(
        'quotations/<int:quotation_id>/upsell-suggestions/',
        views.upsell_suggestions_view,
        name='upsell-suggestions',
    ),
]
