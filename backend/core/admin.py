from django.contrib import admin
from .models import User, ProductCategory, Product, Customer


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'is_active']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'sku', 'category', 'base_price', 'unit', 'tax_rate', 'is_subscription', 'is_active']
    list_filter = ['category', 'is_subscription', 'is_active']
    search_fields = ['name', 'sku']


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'email', 'tier', 'is_active']
    list_filter = ['tier', 'is_active']
    search_fields = ['name', 'company', 'email']
