"""
Portal app — Customer portal auth tokens, negotiation messages.
Person C owns this app.
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class PortalToken(models.Model):
    """Magic-link token for customer portal authentication."""
    token = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    email = models.EmailField()
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='portal_tokens',
    )
    quotation = models.ForeignKey(
        'quotations.Quotation',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='portal_tokens',
    )
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'portal_token'
        ordering = ['-created_at']

    def __str__(self):
        return f"Portal token for {self.email} (expires {self.expires_at})"

    def save(self, *args, **kwargs):
        if not self.expires_at:
            hours = getattr(settings, 'PORTAL_MAGIC_LINK_EXPIRY_HOURS', 24)
            self.expires_at = timezone.now() + timedelta(hours=hours)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return not self.is_used and self.expires_at > timezone.now()


class NegotiationMessage(models.Model):
    """Line-level comments and counter-discount proposals."""

    class AuthorType(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        REP = 'rep', 'Sales Rep'
        SYSTEM = 'system', 'System'

    quotation = models.ForeignKey(
        'quotations.Quotation',
        on_delete=models.CASCADE,
        related_name='negotiation_messages',
    )
    author_type = models.CharField(max_length=10, choices=AuthorType.choices)
    author_name = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    line_ref = models.ForeignKey(
        'quotations.QuotationLine',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='negotiation_messages',
    )
    counter_discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        help_text='Counter-discount percentage proposed by the customer',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'portal_negotiation_message'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.get_author_type_display()}: {self.message[:60]}..."
