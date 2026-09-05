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
        from django.core.cache import cache
        cache.clear()
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
        self.assertGreaterEqual(CreditNote.objects.count(), 1)
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

    def test_price_tax_and_cost_snapshots(self):
        original = self.quote.total_amount, self.quote.tax_amount, self.quote.margin_pct
        self.hardware.base_price = 1
        self.hardware.tax_pct = 99
        self.hardware.cost_price = 1
        self.hardware.save()
        self.quote.refresh_from_db()
        self.assertEqual(original, (self.quote.total_amount, self.quote.tax_amount, self.quote.margin_pct))

    def test_backend_sets_catalog_prices_and_variant_validation(self):
        from quotations.models import ProductVariant, PriceList, PriceListItem
        price_list = PriceList.objects.create(name='Gold INR',tier='gold',currency='INR')
        PriceListItem.objects.create(price_list=price_list,product=self.hardware,price=75000)
        variant = ProductVariant.objects.create(product=self.hardware,attribute='Memory',value='32GB',extra_price=5000)
        self.as_user(self.rep)
        response = self.post(f'/api/quotations/{self.quote.pk}/lines/', {'product':self.hardware.pk,'unit_price':1,'variant':variant.pk})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Decimal(response.data['unit_price']),80000)
        response = self.post(f'/api/quotations/{self.quote.pk}/lines/', {'product':self.saas.pk,'variant':variant.pk})
        self.assertEqual(response.status_code, 404)

    def test_manual_override_and_rollback(self):
        self.quote.status='confirmed'
        self.quote.save()
        self.as_user(self.finance)
        self.post(f'/api/fulfillment/{self.quote.pk}/accept-split/')
        before=list(StockLevel.objects.order_by('pk').values_list('reserved',flat=True))
        response=self.post(f'/api/fulfillment/{self.quote.pk}/override-split/',{'allocations':[
            {'product_id':self.hardware.pk,'warehouse_id':self.w1.pk,'quantity':10}]})
        self.assertEqual(response.status_code,400)
        self.assertEqual(before,list(StockLevel.objects.order_by('pk').values_list('reserved',flat=True)))
        response=self.post(f'/api/fulfillment/{self.quote.pk}/override-split/',{'allocations':[
            {'product_id':self.hardware.pk,'warehouse_id':self.w1.pk,'quantity':5},
            {'product_id':self.hardware.pk,'warehouse_id':self.w2.pk,'quantity':3},
            {'product_id':self.hardware.pk,'warehouse_id':self.w2.pk,'quantity':2,'is_backorder':True}]})
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(sum(StockLevel.objects.values_list('reserved',flat=True)),8)

    def test_backorder_consolidation_and_dispatch(self):
        self.quote.status='confirmed'
        self.quote.save()
        self.as_user(self.finance)
        self.post(f'/api/fulfillment/{self.quote.pk}/accept-split/')
        stock=StockLevel.objects.get(warehouse=self.w2,product=self.hardware)
        stock.in_stock=4
        stock.save()
        for _ in range(2):
            self.assertEqual(self.post(f'/api/fulfillment/{self.quote.pk}/consolidate/').status_code,200)
        self.assertEqual(sum(StockLevel.objects.values_list('reserved',flat=True)),10)
        self.assertFalse(FulfillmentSplit.objects.filter(is_backorder=True).exists())
        split=FulfillmentSplit.objects.first()
        url=f'/api/fulfillment/{self.quote.pk}/shipments/{split.pk}/'
        self.assertEqual(self.post(url,{'action':'ship'}).status_code,200)
        self.assertEqual(self.post(url,{'action':'ship'}).status_code,400)
        self.assertEqual(self.post(url,{'action':'deliver'}).status_code,200)

    def test_exports_and_csv_formula_protection(self):
        from io import BytesIO
        from openpyxl import load_workbook
        self.customer.name='=HYPERLINK("https://evil.example")'
        self.customer.save()
        self.as_user(self.manager)
        response=self.client.get('/api/reports/?export=csv')
        self.assertEqual(response.status_code,200)
        self.assertIn(b"'=HYPERLINK",response.content)
        response=self.client.get('/api/reports/?export=xlsx')
        self.assertEqual(response.status_code,200)
        workbook=load_workbook(BytesIO(response.content))
        self.assertEqual(workbook.active['B2'].data_type,'s')
        for url in ['/api/reports/?export=pdf',f'/api/quotations/{self.quote.pk}/pdf/']:
            response=self.client.get(url)
            self.assertEqual(response.status_code,200)
            self.assertTrue(response.content.startswith(b'%PDF'))

    def test_renewals_are_idempotent_and_calendar_anchored(self):
        from billing.services.renewals import renew_due_subscriptions
        self.approve()
        token=self.token()
        self.post(f'/api/portal/quotations/{self.quote.pk}/confirm/',{'portal_token':token})
        sub=Subscription.objects.get()
        sub.start_date=date(2026,1,31)
        sub.next_billing_date=date(2026,2,28)
        sub.anchor_day=31
        sub.save()
        self.assertEqual(renew_due_subscriptions(date(2026,2,28)),1)
        self.assertEqual(renew_due_subscriptions(date(2026,2,28)),0)
        sub.refresh_from_db()
        self.assertEqual(sub.next_billing_date,date(2026,3,31))

    def test_cancellation_credit_reconciles_proration_invoices(self):
        self.approve()
        token=self.token()
        self.post(f'/api/portal/quotations/{self.quote.pk}/confirm/',{'portal_token':token})
        self.as_user(self.finance)
        self.post(f'/api/billing/{self.subline.pk}/prorate/',{'change_date':str(timezone.localdate()),'new_quantity':10})
        response=self.post(f'/api/billing/{self.subline.pk}/cancel/')
        self.assertEqual(response.status_code,200,response.data)
        from billing.services.lifecycle import invoice_data
        self.assertTrue(all(Decimal(invoice_data(i)['balance'])==0 for i in Invoice.objects.filter(type='recurring')))

    def test_customer_account_cannot_enter_internal_workspace(self):
        user=User.objects.create_user('customer',role='customer')
        self.as_user(user)
        for url in ['/api/quotations/','/api/reports/','/api/products/','/api/dashboard/summary/','/api/invoices/']:
            self.assertEqual(self.client.get(url).status_code,403,url)

    def test_invoice_payment_requires_finance_and_rejects_overpayment(self):
        invoice=Invoice.objects.create(invoice_number='INV-TEST',quotation=self.quote,amount=100,status='sent')
        self.as_user(self.rep)
        self.assertEqual(self.post(f'/api/invoices/{invoice.pk}/payments/',{'amount':100,'method':'upi','reference':'UTR-1'}).status_code,403)
        self.as_user(self.finance)
        self.assertEqual(self.post(f'/api/invoices/{invoice.pk}/payments/',{'amount':101,'method':'upi','reference':'UTR-1'}).status_code,400)
        self.assertEqual(Payment.objects.count(),0)

    def test_create_alias_and_header_date_validation(self):
        self.as_user(self.rep)
        self.assertEqual(self.post('/api/quotations/create/',{'customer_id':self.customer.pk}).status_code,201)
        response=self.client.patch(f'/api/quotations/{self.quote.pk}/',{'valid_until':'not-a-date'},format='json')
        self.assertEqual(response.status_code,400)

    def test_signup_requires_activation_and_login_is_throttled(self):
        response=self.post('/api/auth/register/',{'username':'new.rep','password':'New-Workspace-Pass-3489','email':'rep@example.test'})
        self.assertEqual(response.status_code,201,response.data)
        self.assertNotIn('tokens',response.data)
        self.assertFalse(User.objects.get(username='new.rep').is_active)
        for _ in range(10):
            response=self.post('/api/auth/login/',{'username':'missing','password':'bad-password'})
        self.assertEqual(response.status_code,429)

    def test_finance_cannot_skip_manager_review(self):
        self.as_user(self.rep)
        self.post(f'/api/quotations/{self.quote.pk}/submit/')
        self.as_user(self.finance)
        self.assertEqual(self.post(f'/api/quotations/{self.quote.pk}/approve/').status_code,400)
        self.quote.refresh_from_db()
        self.assertFalse(self.quote.manager_approved)
        self.assertFalse(self.quote.finance_approved)


    def test_workspace_reads_with_real_lines(self):
        self.as_user(self.admin)
        for endpoint in ['/api/quotations/', '/api/reports/', '/api/dashboard/summary/',
                         '/api/dashboard/anomalies/', '/api/dashboard/slippage/',
                         '/api/quotations/pipeline-summary/', f'/api/quotations/{self.quote.pk}/']:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, 200, endpoint)
        self.assertAlmostEqual(self.quote.margin_pct, 17.6, places=1)
        for resource in ['products','customers','discounts','approvals','warehouses','stock','plans','price-lists','prices','variants','upsell']:
            self.assertEqual(self.client.get(f'/api/config/{resource}/').status_code, 200, resource)


from django.test import TransactionTestCase, skipUnlessDBFeature


@skipUnlessDBFeature('has_select_for_update')
class PostgreSQLConcurrencyTests(TransactionTestCase):
    setUp = DealFlowTests.setUp

    def run_parallel(self, function):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import connections
        barrier=Barrier(2)
        def run(index):
            try:
                client=APIClient()
                client.force_authenticate(self.finance)
                barrier.wait(timeout=10)
                return function(client,index)
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(run,[0,1]))

    def test_concurrent_inventory_never_over_reserves(self):
        self.quote.status='confirmed'
        self.quote.save()
        other=Quotation.objects.create(quote_number='Q-RACE',customer=self.customer,rep=self.other,status='confirmed')
        QuotationLine.objects.create(quotation=other,product=self.hardware,qty=10,unit_price=80000)
        ids=[self.quote.pk,other.pk]
        codes=self.run_parallel(lambda client,index: client.post(f'/api/fulfillment/{ids[index]}/accept-split/',{},format='json').status_code)
        self.assertIn(200,codes)
        self.assertTrue(all(code in (200,400) for code in codes),codes)
        self.assertEqual(sum(StockLevel.objects.values_list('reserved',flat=True)),9)
        self.assertTrue(all(s.reserved<=s.in_stock for s in StockLevel.objects.all()))

    def test_concurrent_duplicate_receipts_are_one_payment(self):
        invoice=Invoice.objects.create(invoice_number='INV-RACE',quotation=self.quote,amount=100,status='sent')
        codes=self.run_parallel(lambda client,index: client.post(f'/api/invoices/{invoice.pk}/payments/',
            {'amount':'100','method':'upi','reference':'UTR-RACE'},format='json').status_code)
        self.assertEqual(codes,[200,200])
        self.assertEqual(Payment.objects.count(),1)

