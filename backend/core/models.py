"""
Core app models — shared across all Django apps.
Owner: Person C (Auth, User/Role).
Person A added: Product, ProductCategory, Customer models (needed as FKs for quotations).
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Extended user model with role support."""

    class Role(models.TextChoices):
        SALES_REP = 'sales_rep', 'Sales Rep'
        SALES_MANAGER = 'sales_manager', 'Sales Manager'
        FINANCE = 'finance', 'Finance / Ops'
        ADMIN = 'admin', 'Admin'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.SALES_REP,
    )
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = 'core_user'

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class ProductCategory(models.Model):
    """Product category — e.g. Hardware, Services, Warranty, Subscription."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'core_product_category'
        verbose_name_plural = 'Product categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(models.Model):
    """Product catalog entry."""

    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=50, unique=True)
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.PROTECT,
        related_name='products',
    )
    base_price = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=50, default='unit')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    is_subscription = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_product'
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} ({self.sku})"


class Customer(models.Model):
    """Customer / Account."""

    class Tier(models.TextChoices):
        BRONZE = 'bronze', 'Bronze'
        SILVER = 'silver', 'Silver'
        GOLD = 'gold', 'Gold'

    name = models.CharField(max_length=255)
    company = models.CharField(max_length=255, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    tier = models.CharField(
        max_length=10,
        choices=Tier.choices,
        default=Tier.BRONZE,
    )
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_customer'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_tier_display()})"
