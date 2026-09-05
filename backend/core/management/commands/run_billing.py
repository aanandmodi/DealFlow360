from datetime import date
import time
from django.db import close_old_connections
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone
from billing.services.renewals import renew_due_subscriptions


class Command(BaseCommand):
    help = 'Issue due subscription invoices once per period, with locked renewals.'

    def add_arguments(self, parser):
        parser.add_argument('--as-of', type=date.fromisoformat)
        parser.add_argument('--watch', action='store_true', help='Poll once per minute for due periods.')

    def handle(self, *args, **options):
        if options['watch'] and options['as_of']:
            from django.core.management.base import CommandError
            raise CommandError('--as-of and --watch cannot be combined.')
        last_cleanup = None
        while True:
            close_old_connections()
            today = options['as_of'] or timezone.localdate()
            count = renew_due_subscriptions(today)
            if count or not options['watch']:
                self.stdout.write(f'{count} recurring invoice(s) issued.')
            if last_cleanup != today:
                call_command('flushexpiredtokens', verbosity=0)
                last_cleanup = today
            if not options['watch']:
                return
            time.sleep(60)
