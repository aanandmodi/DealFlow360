"""
Role-based DRF permission classes — reused by every app.
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsSalesRep(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'sales_rep'


class IsSalesManager(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'sales_manager'


class IsFinance(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'finance'


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'customer'


class IsInternalUser(BasePermission):
    """Any non-customer role."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role != 'customer'
        )


class IsManagerOrAbove(BasePermission):
    """Sales Manager, Finance, or Admin."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ('sales_manager', 'finance', 'admin')
        )
