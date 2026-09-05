from django.contrib import admin
from .models import PortalToken, NegotiationMessage


@admin.register(PortalToken)
class PortalTokenAdmin(admin.ModelAdmin):
    list_display = ['email', 'token', 'quotation', 'expires_at', 'is_used', 'created_at']
    list_filter = ['is_used', 'created_at']
    search_fields = ['email']
    readonly_fields = ['token']


@admin.register(NegotiationMessage)
class NegotiationMessageAdmin(admin.ModelAdmin):
    list_display = ['quotation', 'author_type', 'author_name', 'short_message', 'counter_discount_percent', 'created_at']
    list_filter = ['author_type', 'created_at']
    search_fields = ['quotation__quote_number', 'message']

    def short_message(self, obj):
        return obj.message[:80] + '...' if len(obj.message) > 80 else obj.message
    short_message.short_description = 'Message'
