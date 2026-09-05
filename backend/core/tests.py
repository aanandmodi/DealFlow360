from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from core.models import User
from quotations.models import Customer, Product, Quotation, QuotationLine, DiscountTier, ApprovalChainRule
from fulfillment.models import Warehouse, StockLevel, FulfillmentSplit
from billing.models import SubscriptionPlan, Subscription, Invoice, Payment, CreditNote
from portal.models import PortalToken
from billing.services.proration import _next_cycle_date


class DealFlowTests(TestCase):
    def setUp(self):
        self.rep = User.objects.create_user('rep', role='sales_rep')
        self.other = User.objects.create_user('other', role='sales_rep')
        self.manager = User.objects.create_user('manager', role='sales_manager')
        self.finance = User.objects.create_user('finance', role='finance')
        self.admin = User.objects.create_user('admin', role='admin')
        self.customer = Customer.objects.create(name='Narmada Technologies', email='buy@narmada.example', tier='gold')
        self.hardware = Product.objects.create(name='Workstation', sku='WS', category='hardware', base_price=80000, cost_price=50000, tax_pct=18)
        self.saas = Product.objects.create(name='Cloud seats', sku='SAAS', category='subscriptions', base_price=2000, cost_price=500, is_subscription=True)
        SubscriptionPlan.objects.create(name='Monthly', product=self.saas, price=2000)
        DiscountTier.objects.create(tier='gold', category='hardware', max_discount_pct=15)
        DiscountTier.objects.create(tier='gold', category='subscriptions', max_discount_pct=10)
        ApprovalChainRule.objects.create(name='Manager', min_over_pct=0, max_over_pct=5)
        ApprovalChainRule.objects.create(name='Finance', min_over_pct=5, max_over_pct=100, requires_finance=True)
        self.quote = Quotation.objects.create(quote_number='Q-TEST', customer=self.customer, rep=self.rep)
        self.line = QuotationLine.objects.create(quotation=self.quote, product=self.hardware, qty=10, unit_price=80000, discount_pct=25)
        self.subline = QuotationLine.objects.create(quotation=self.quote, product=self.saas, qty=5, unit_price=2000, is_subscription=True)
        self.w1 = Warehouse.objects.create(name='Mumbai', shipping_cost_weight=1)
        self.w2 = Warehouse.objects.create(name='Bengaluru', shipping_cost_weight=2)
        StockLevel.objects.create(warehouse=self.w1, product=self.hardware, in_stock=6)
        StockLevel.objects.create(warehouse=self.w2, product=self.hardware, in_stock=3)
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def post(self, url, data=None):
        return self.client.post(url, data or {}, format='json')

    def approve(self):
        self.as_user(self.rep)
        self.assertEqual(self.post(f'/api/quotations/{self.quote.pk}/submit/').status_code, 200)
        self.as_user(self.manager)
        self.assertEqual(self.post(f'/api/quotations/{self.quote.pk}/approve/').status_code, 200)
        self.as_user(self.finance)
        self.assertEqual(self.post(f'/api/quotations/{self.quote.pk}/approve/').status_code, 200)

    def token(self):
        self.as_user(self.rep)
        response = self.post('/api/auth/portal/request-magic-link/', {'quotation_id': self.quote.pk})
        self.assertEqual(response.status_code, 200, response.data)
        self.as_user(None)
        return response.data['token']

    def test_complete_negotiation_to_cash(self):
        self.approve()
        token = self.token()
        response = self.post(f'/api/portal/quotations/{self.quote.pk}/counter-discount/', {'portal_token': token, 'counter_discount_percent': 28})
        self.assertEqual(response.status_code, 200, response.data)
        self.quote.refresh_from_db()
        self.assertFalse(self.quote.manager_approved)
        self.assertFalse(self.quote.finance_approved)
        self.line.refresh_from_db()
        self.assertEqual(self.line.discount_pct, 28)
        self.assertEqual(self.post(f'/api/portal/quotations/{self.quote.pk}/confirm/', {'portal_token': token}).status_code, 400)
        self.as_user(self.manager)
        self.post(f'/api/quotations/{self.quote.pk}/approve/')
        self.as_user(self.finance)
        self.post(f'/api/quotations/{self.quote.pk}/approve/')
        self.as_user(None)
        self.assertEqual(self.post(f'/api/portal/quotations/{self.quote.pk}/confirm/', {'portal_token': token}).status_code, 200)
        self.post(f'/api/portal/quotations/{self.quote.pk}/confirm/', {'portal_token': token})
        self.assertEqual(Invoice.objects.count(), 2)
        self.assertEqual(Subscription.objects.count(), 1)
        self.as_user(self.finance)
        for _ in range(2):
            response = self.post(f'/api/fulfillment/{self.quote.pk}/accept-split/')
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(sum(StockLevel.objects.values_list('reserved', flat=True)), 9)
        self.assertEqual(FulfillmentSplit.objects.filter(is_backorder=True).get().qty, 1)
        self.assertFalse(FulfillmentSplit.objects.filter(product=self.saas).exists())
        for invoice in Invoice.objects.all():
            body = {'amount': str(invoice.amount), 'method': 'upi', 'reference': f'UTR-{invoice.pk}'}
            for _ in range(2):
                response = self.post(f'/api/invoices/{invoice.pk}/payments/', body)
                self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Payment.objects.count(), 2)
        self.quote.refresh_from_db()
        self.assertEqual(self.quote.status, 'paid')

    def test_rep_cannot_escalate_or_read_other_deals(self):
        self.as_user(self.other)
        self.assertEqual(self.client.get(f'/api/quotations/{self.quote.pk}/').status_code, 404)
        self.assertEqual(self.client.get('/api/quotations/?scope=all').data, [])
        for action in ['approve','reject','return']:
            self.assertEqual(self.post(f'/api/quotations/{self.quote.pk}/{action}/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/billing/{self.quote.pk}/schedule/').status_code, 404)

    def test_public_portal_cannot_enumerate_or_mutate(self):
        for identifier in ['default','1','Q-TEST','not-a-token']:
            self.assertEqual(self.client.get(f'/api/portal/quotations/{identifier}/').status_code, 403)
        self.assertIn(self.client.get('/api/portal/quotations/').status_code, [401,403])
        for action in ['confirm','comment','counter-discount']:
            self.assertEqual(self.post(f'/api/portal/quotations/{self.quote.pk}/{action}/').status_code, 403)
        self.assertIn(self.post('/api/auth/portal/request-magic-link/', {'quotation_id': self.quote.pk}).status_code, [401,403])

    def test_token_scope_expiry_and_private_fields(self):
        self.approve()
        token = self.token()
        response = self.client.get(f'/api/portal/quotations/{token}/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('cost_price', str(response.data))
        self.assertNotIn('line_limit_pct', str(response.data))
        self.assertEqual(response.data['notes'], '')
        self.assertEqual(self.post('/api/portal/quotations/99999/confirm/', {'portal_token': token}).status_code, 403)
        PortalToken.objects.update(expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.client.get(f'/api/portal/quotations/{token}/').status_code, 403)

    def test_invalid_inputs_and_immutable_approved_terms(self):
        self.as_user(self.rep)
        url = f'/api/quotations/{self.quote.pk}/lines/{self.line.pk}/'
        for data in [{'quantity': -1}, {'discount_percent': 101}, {'quantity': 'NaN'}, {'quantity': 1.5}]:
            self.assertEqual(self.client.patch(url, data, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'discount_percent': 0}, format='json').status_code, 200)
        self.client.patch(url, {'discount_percent': 25}, format='json')
        self.approve()
        self.assertEqual(self.as_user(self.rep).patch(url, {'quantity': 3}, format='json').status_code, 400)

    def test_signup_never_grants_admin(self):
        response = self.post('/api/auth/register/', {'username':'attacker','password':'Strong-pass-32892','role':'admin'})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='attacker').exists())

    def test_subscription_changes_persist(self):
        self.approve()
        token = self.token()
        self.post(f'/api/portal/quotations/{self.quote.pk}/confirm/', {'portal_token': token})
        self.as_user(self.finance)
        response = self.post(f'/api/billing/{self.subline.pk}/prorate/', {'change_date':str(timezone.localdate()),'new_quantity':10})
        self.assertEqual(response.status_code, 200, response.data)
        sub = Subscription.objects.get()
        self.assertEqual(sub.quantity, 10)
        self.assertEqual(Invoice.objects.count(), 3)
        response = self.post(f'/api/billing/{self.subline.pk}/cancel/')
        self.assertEqual(response.status_code, 200, response.data)
        sub.refresh_from_db()
        self.assertEqual(sub.status, 'cancelled')
        self.assertEqual(CreditNote.objects.count(), 1)
        self.assertEqual(self.post(f'/api/billing/{self.subline.pk}/cancel/').status_code, 400)

    def test_calendar_boundaries(self):
        self.assertEqual(_next_cycle_date(date(2024,2,29), 'yearly'), date(2025,2,28))
        self.assertEqual(_next_cycle_date(date(2026,1,31), 'monthly'), date(2026,2,28))

    def test_configuration_validation(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.get('/api/config/products/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/config/products/{self.hardware.pk}/', {'base_price':-1}, format='json').status_code, 400)
        self.as_user(self.rep)
        self.assertEqual(self.client.get('/api/config/products/').status_code, 403)
