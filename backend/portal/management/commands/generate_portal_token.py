"""
Generate a portal demo token for testing the customer portal view.
Usage: python manage.py generate_portal_token <quotation_id> [--email=customer@example.com]
"""
from django.core.management.base import BaseCommand
from quotations.models import Quotation
from portal.models import PortalToken
from datetime import timedelta
from django.utils import timezone
import uuid


class Command(BaseCommand):
    help = 'Generate a portal demo token for a quotation'

    def add_arguments(self, parser):
        parser.add_argument('quotation_id', type=int, nargs='?', default=None)
        parser.add_argument('--email', type=str, default='')

    def handle(self, *args, **options):
        qid = options['quotation_id']

        if qid:
            quotation = Quotation.objects.get(id=qid)
        else:
            # Get the first quotation with status under_negotiation or sent
            quotation = Quotation.objects.filter(
                status__in=['under_negotiation', 'sent', 'approved']
            ).first()
            if not quotation:
                quotation = Quotation.objects.first()

        if not quotation:
            self.stderr.write('No quotations found. Run seed_data first.')
            return

        email = options['email'] or quotation.customer.email

        # Create or reuse token
        token_obj, created = PortalToken.objects.get_or_create(
            quotation=quotation,
            email=email,
            defaults={
                'token': str(uuid.uuid4()),
                'expires_at': timezone.now() + timedelta(days=30),
            }
        )

        if not created:
            # Refresh expiry
            token_obj.expires_at = timezone.now() + timedelta(days=30)
            token_obj.save()

        portal_url = f'http://localhost:5173/portal/quotation/{token_obj.token}'

        self.stdout.write(self.style.SUCCESS(f'\nPortal Token Generated!'))
        self.stdout.write(f'  Quotation: {quotation.quote_number} — {quotation.customer.name}')
        self.stdout.write(f'  Email:     {email}')
        self.stdout.write(f'  Token:     {token_obj.token}')
        self.stdout.write(f'  Expires:   {token_obj.expires_at}')
        self.stdout.write(f'\n  Portal URL: {portal_url}')
        self.stdout.write('')
