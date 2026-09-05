"""
Core app — User model with role-based access.
Person C owns this app.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom User model with role field for RBAC."""

    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        SALES_REP = 'sales_rep', 'Sales Rep'
        SALES_MANAGER = 'sales_manager', 'Sales Manager'
        FINANCE = 'finance', 'Finance'
        CUSTOMER = 'customer', 'Customer'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.SALES_REP,
        db_index=True,
    )
    phone = models.CharField(max_length=20, blank=True)
    avatar_url = models.URLField(blank=True)

    class Meta:
        db_table = 'core_user'
        ordering = ['username']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_internal(self):
        return self.role != self.Role.CUSTOMER

    @property
    def is_manager_or_above(self):
        return self.role in (self.Role.SALES_MANAGER, self.Role.FINANCE, self.Role.ADMIN)
