"""
URL routing for the Fulfillment app — Person B.
Included under /api/ from root urls.py.
"""
from django.urls import path
from . import views

urlpatterns = [
    path(
        'fulfillment/<int:quotation_id>/suggest-split/',
        views.suggest_split_view,
        name='fulfillment-suggest-split',
    ),
    path(
        'fulfillment/<int:quotation_id>/accept-split/',
        views.accept_split_view,
        name='fulfillment-accept-split',
    ),
    path(
        'fulfillment/<int:quotation_id>/override-split/',
        views.override_split_view,
        name='fulfillment-override-split',
    ),
]
