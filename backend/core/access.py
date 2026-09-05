"""Shared access boundaries for the single-company sales workspace."""
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from quotations.models import Quotation


def scoped_quotes(user):
    qs = Quotation.objects.select_related('customer', 'rep').prefetch_related('lines__product')
    if not user.is_authenticated or user.role == 'customer':
        return qs.none()
    return qs.filter(rep=user) if user.role == 'sales_rep' else qs


def quote_for(request, pk, lock=False):
    qs = scoped_quotes(request.user)
    if lock:
        # Lock the quotation only: nullable rep joins cannot be locked on PostgreSQL.
        qs = qs.select_for_update(of=('self',))
    return get_object_or_404(qs, pk=pk)


def require_roles(user, *roles):
    if not user.is_authenticated or user.role not in roles:
        raise PermissionDenied('Your role cannot perform this action.')


def editable(quote):
    if quote.status != 'draft':
        raise ValidationError('Only drafts can be edited. Return the quote for revision first.')
