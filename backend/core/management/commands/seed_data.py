"""
Seed data management command — populates the database with realistic demo data.
Run: python manage.py seed_data
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import User
from quotations.models import (
    Customer, Product, ProductVariant, PriceList, PriceListItem,
    DiscountTier, ApprovalChainRule, Quotation, QuotationLine, ApprovalLog,
)
from fulfillment.models import Warehouse, StockLevel, FulfillmentSplit
from billing.models import SubscriptionPlan, Invoice, Payment, UpsellRule


class Command(BaseCommand):
    help = 'Seed the database with realistic demo data for DealFlow360'

    def handle(self, *args, **options):
        self.stdout.write('* Seeding DealFlow360 database...\n')

        # Clean existing records for clean idempotent seeding
        Quotation.objects.all().delete()
        Customer.objects.all().delete()
        Product.objects.all().delete()
        DiscountTier.objects.all().delete()
        ApprovalChainRule.objects.all().delete()
        Warehouse.objects.all().delete()
        SubscriptionPlan.objects.all().delete()
        User.objects.all().delete()

        # -- Users --
        admin = User.objects.create_superuser(
            username='admin', email='admin@dealflow360.com', password='admin123',
            first_name='System', last_name='Admin', role='admin'
        )
        # Sales Rep demo account (Elena Vance)
        elena = User.objects.create_user(
            username='elena.vance', email='elena@dealflow360.com', password='demo123',
            first_name='Elena', last_name='Vance', role='sales_rep'
        )
        # Sales Manager demo account (M. Shah)
        manager = User.objects.create_user(
            username='m.shah', email='mshah@dealflow360.com', password='demo123',
            first_name='M.', last_name='Shah', role='sales_manager'
        )
        # Finance demo account (R. Iyer)
        finance = User.objects.create_user(
            username='r.iyer', email='riyer@dealflow360.com', password='demo123',
            first_name='R.', last_name='Iyer', role='finance'
        )
        # Additional team reps
        rep1 = User.objects.create_user(
            username='marcus.ross', email='marcus@dealflow360.com', password='demo123',
            first_name='Marcus', last_name='Ross', role='sales_rep'
        )
        rep2 = User.objects.create_user(
            username='sarah.lin', email='sarah@dealflow360.com', password='demo123',
            first_name='Sarah', last_name='Lin', role='sales_rep'
        )
        rep3 = User.objects.create_user(
            username='david.kim', email='david@dealflow360.com', password='demo123',
            first_name='David', last_name='Kim', role='sales_rep'
        )
        cust_user1 = User.objects.create_user(
            username='john.reynolds', email='john@acmecorp.com', password='demo123',
            first_name='John', last_name='Reynolds', role='customer'
        )
        cust_user2 = User.objects.create_user(
            username='lisa.chen', email='lisa@apexglobal.com', password='demo123',
            first_name='Lisa', last_name='Chen', role='customer'
        )
        self.stdout.write(self.style.SUCCESS('  [OK] Users created'))

        # ── Customers ──
        c_acme = Customer.objects.create(
            name='Acme Corp', email='procurement@acmecorp.com', company='Acme Corporation',
            address='100 Tech Center Blvd, Suite 400\nAustin, TX 78701',
            tier='gold', user=cust_user1, phone='(512) 555-0142'
        )
        c_apex = Customer.objects.create(
            name='Apex Global', email='ops@apexglobal.com', company='Apex Global Solutions',
            address='250 Innovation Way\nSan Jose, CA 95110',
            tier='silver', user=cust_user2, phone='(408) 555-0198'
        )
        c_delta = Customer.objects.create(
            name='Delta Industries', email='it@deltaindustries.com', company='Delta Industries Inc.',
            address='777 Enterprise Drive\nChicago, IL 60601',
            tier='gold', phone='(312) 555-0234'
        )
        c_techno = Customer.objects.create(
            name='TechNova SaaS Scale', email='admin@technovasaas.com', company='TechNova Inc.',
            address='1200 Cloud Lane\nSeattle, WA 98101',
            tier='bronze', phone='(206) 555-0167'
        )
        c_starlight = Customer.objects.create(
            name='Starlight Media Corp', email='procurement@starlightmedia.com', company='Starlight Media Corp',
            address='500 Media Plaza\nLos Angeles, CA 90028',
            tier='silver', phone='(323) 555-0189'
        )
        c_vanguard = Customer.objects.create(
            name='Vanguard FinTech Group', email='ops@vanguardft.com', company='Vanguard FinTech Group',
            address='900 Financial District\nNew York, NY 10004',
            tier='gold', phone='(212) 555-0256'
        )
        self.stdout.write(self.style.SUCCESS('  [OK] Customers created'))

        # -- Products --
        p_laptop = Product.objects.create(
            name='Laptop Pro 14', sku='HW-LP14', category='hardware',
            base_price=1200, unit='unit', tax_pct=8,
            description='Core i7, 32GB RAM, 1TB SSD - Enterprise Fleet Deployment'
        )
        p_server = Product.objects.create(
            name='Enterprise Server Unit SK-8832', sku='HW-SK8832', category='hardware',
            base_price=4500, unit='unit', tax_pct=8,
            description='Rack-mount server for data center deployment'
        )
        p_monitor = Product.objects.create(
            name='UltraWide Monitor 34"', sku='HW-MON34', category='hardware',
            base_price=650, unit='unit', tax_pct=8,
            description='34-inch 4K UltraWide for design and development teams'
        )
        p_onsite = Product.objects.create(
            name='Onsite Setup & Deployment Service', sku='SVC-SETUP', category='services',
            base_price=450, unit='service', tax_pct=0,
            description='White-glove installation, MDM zero-touch enrollment'
        )
        p_training = Product.objects.create(
            name='Enterprise Training Program', sku='SVC-TRAIN', category='services',
            base_price=1200, unit='session', tax_pct=0,
            description='2-day on-site technical training for IT teams'
        )
        p_warranty = Product.objects.create(
            name='Extended Warranty & SLA (2-Year Enterprise)', sku='SVC-WAR2Y', category='services',
            base_price=180, unit='unit', tax_pct=0,
            description='24/7 dedicated hardware replacement & incident escalation'
        )
        p_cloud = Product.objects.create(
            name='Cloud Platform License', sku='SUB-CLOUD', category='subscriptions',
            base_price=299, unit='license/mo', tax_pct=0, is_subscription=True,
            description='Full-stack cloud management platform access'
        )
        p_care = Product.objects.create(
            name='Premium Care Plan', sku='SUB-CARE', category='subscriptions',
            base_price=149, unit='seat/mo', tax_pct=0, is_subscription=True,
            description='Priority support, SLA guarantees, dedicated account manager'
        )
        p_iot = Product.objects.create(
            name='IoT Gateway Platform (3-Year)', sku='SUB-IOT3Y', category='subscriptions',
            base_price=550, unit='gateway/yr', tax_pct=0, is_subscription=True,
            description='Edge-to-cloud IoT data pipeline and management'
        )
        p_security = Product.objects.create(
            name='Automated Security Bot Tier', sku='SUB-SECBOT', category='subscriptions',
            base_price=199, unit='bot/mo', tax_pct=0, is_subscription=True,
            description='AI-driven incident response and automated security monitoring'
        )

        # Variants
        ProductVariant.objects.create(product=p_laptop, attribute='RAM', value='16GB', extra_price=-100)
        ProductVariant.objects.create(product=p_laptop, attribute='RAM', value='64GB', extra_price=300)
        ProductVariant.objects.create(product=p_laptop, attribute='Storage', value='512GB SSD', extra_price=-50)
        ProductVariant.objects.create(product=p_laptop, attribute='Storage', value='2TB SSD', extra_price=200)
        self.stdout.write(self.style.SUCCESS('  [OK] Products created'))

        # -- Price Lists --
        pl_bronze = PriceList.objects.create(name='Bronze Standard', tier='bronze', currency='USD')
        pl_silver = PriceList.objects.create(name='Silver Preferred', tier='silver', currency='USD')
        pl_gold = PriceList.objects.create(name='Gold Enterprise', tier='gold', currency='USD')

        # Gold gets 5% lower prices
        for product in Product.objects.all():
            PriceListItem.objects.create(price_list=pl_gold, product=product, price=product.base_price * Decimal('0.95'))
            PriceListItem.objects.create(price_list=pl_silver, product=product, price=product.base_price * Decimal('0.98'))
        self.stdout.write(self.style.SUCCESS('  [OK] Price lists created'))

        # -- Discount Tiers --
        # Different ceilings per tier AND category
        tiers_data = [
            ('bronze', 'hardware', 5), ('bronze', 'services', 3), ('bronze', 'subscriptions', 5), ('bronze', 'software', 5),
            ('silver', 'hardware', 10), ('silver', 'services', 7), ('silver', 'subscriptions', 10), ('silver', 'software', 8),
            ('gold', 'hardware', 15), ('gold', 'services', 10), ('gold', 'subscriptions', 15), ('gold', 'software', 12),
        ]
        for tier, cat, pct in tiers_data:
            DiscountTier.objects.create(tier=tier, category=cat, max_discount_pct=pct)
        self.stdout.write(self.style.SUCCESS('  [OK] Discount tiers created'))

        # -- Approval Chain Rules --
        ApprovalChainRule.objects.create(
            name='Low Risk - Auto Approve', min_over_pct=0, max_over_pct=0,
            requires_manager=False, requires_finance=False
        )
        ApprovalChainRule.objects.create(
            name='Medium Risk - Manager Only', min_over_pct=Decimal('0.01'), max_over_pct=10,
            requires_manager=True, requires_finance=False
        )
        ApprovalChainRule.objects.create(
            name='High Risk - Manager + Finance', min_over_pct=Decimal('10.01'), max_over_pct=100,
            requires_manager=True, requires_finance=True
        )
        self.stdout.write(self.style.SUCCESS('  [OK] Approval chain rules created'))

        # -- Warehouses --
        wh_austin = Warehouse.objects.create(
            name='Austin Central Hub', location='Austin, TX', shipping_cost_weight=1.0
        )
        wh_newark = Warehouse.objects.create(
            name='Newark East Depot', location='Newark, NJ', shipping_cost_weight=1.3
        )

        # Stock levels
        for product in Product.objects.filter(category='hardware'):
            StockLevel.objects.create(warehouse=wh_austin, product=product, in_stock=200, reserved=30)
            StockLevel.objects.create(warehouse=wh_newark, product=product, in_stock=150, reserved=20)
        self.stdout.write(self.style.SUCCESS('  [OK] Warehouses & stock created'))

        # -- Subscription Plans --
        SubscriptionPlan.objects.create(
            name='Cloud Platform Monthly', product=p_cloud, cycle='monthly', price=299
        )
        SubscriptionPlan.objects.create(
            name='Cloud Platform Yearly', product=p_cloud, cycle='yearly', price=2990
        )
        SubscriptionPlan.objects.create(
            name='Premium Care Monthly', product=p_care, cycle='monthly', price=149
        )
        SubscriptionPlan.objects.create(
            name='IoT Gateway 3-Year', product=p_iot, cycle='yearly', price=550
        )
        SubscriptionPlan.objects.create(
            name='Security Bot Monthly', product=p_security, cycle='monthly', price=199
        )
        self.stdout.write(self.style.SUCCESS('  [OK] Subscription plans created'))

        # -- Upsell Rules --
        UpsellRule.objects.create(product=p_laptop, suggested_product=p_monitor, min_margin_pct=25, is_promoted=True)
        UpsellRule.objects.create(product=p_laptop, suggested_product=p_warranty, min_margin_pct=30, is_promoted=True)
        UpsellRule.objects.create(product=p_laptop, suggested_product=p_onsite, min_margin_pct=20)
        UpsellRule.objects.create(product=p_server, suggested_product=p_cloud, min_margin_pct=25, is_promoted=True)
        UpsellRule.objects.create(product=p_server, suggested_product=p_care, min_margin_pct=30)
        self.stdout.write(self.style.SUCCESS('  [OK] Upsell rules created'))

        # -- Sample Quotations --
        def make_quote(number, customer, rep, stat, lines_data, days_ago=0, risk=0):
            q = Quotation.objects.create(
                quote_number=number,
                customer=customer,
                rep=rep,
                status=stat,
                blended_risk_score=Decimal(str(risk)),
                portal_token=str(uuid.uuid4()),
                valid_until=date.today() + timedelta(days=30),
            )
            if days_ago:
                q.created_at = timezone.now() - timedelta(days=days_ago)
                q.updated_at = timezone.now() - timedelta(days=days_ago)
                q.save(update_fields=['created_at', 'updated_at'])
            for prod, qty, price, disc, is_sub in lines_data:
                try:
                    dt = DiscountTier.objects.get(tier=customer.tier, category=prod.category)
                    limit = dt.max_discount_pct
                except DiscountTier.DoesNotExist:
                    limit = Decimal('5')
                QuotationLine.objects.create(
                    quotation=q, product=prod, qty=qty, unit_price=price,
                    discount_pct=disc, line_limit_pct=limit, is_subscription=is_sub,
                    description=prod.description,
                )
            return q

        # Q-1042: Acme Corp - Under Negotiation, high risk (the demo flow quotation)
        q1042 = make_quote('Q-1042', c_acme, rep1, 'under_negotiation', [
            (p_laptop, 2, 1200, 12, False),
            (p_onsite, 1, 450, 10, False),
            (p_warranty, 1, 180, 10, False),
        ], risk=8.5)
        ApprovalLog.objects.create(quotation=q1042, action='submitted', actor=rep1, step_order=1,
                                   role_required='sales_manager', note='Blended risk score: 8.50%')
        ApprovalLog.objects.create(quotation=q1042, action='approved', actor=manager, step_order=1,
                                   role_required='sales_manager', note='Approved - hardware discount within Gold tier limits')

        # Q-1031: Apex Global - Stalled (16 days idle)
        q1031 = make_quote('Q-1031', c_apex, rep1, 'sent', [
            (p_server, 12, 4500, 8, False),
        ], days_ago=16, risk=2)

        # Q-1039: Delta Industries - Pending Approval
        q1039 = make_quote('Q-1039', c_delta, rep3, 'pending_approval', [
            (p_iot, 1, 550, 8, True),
            (p_server, 48, 4500, 5, False),
        ], risk=3.2)
        ApprovalLog.objects.create(quotation=q1039, action='submitted', actor=rep3, step_order=1,
                                   role_required='sales_manager', note='Blended risk score: 3.20%')

        # Q-1045: TechNova - Draft
        q1045 = make_quote('Q-1045', c_techno, manager, 'draft', [
            (p_cloud, 1, 299, 0, True),
            (p_server, 1, 4500, 0, False),
        ], risk=0)

        # Q-1046: Starlight Media - Draft
        q1046 = make_quote('Q-1046', c_starlight, rep1, 'draft', [
            (p_laptop, 400, 1200, 5, False),
        ], risk=0)

        # Q-1037: Apex Logistics - Approved
        q1037 = make_quote('Q-1037', c_apex, manager, 'approved', [
            (p_server, 24, 4500, 7, False),
            (p_care, 24, 149, 5, True),
        ], risk=0)

        # Q-1038: Delta - Approved
        q1038 = make_quote('Q-1038', c_delta, rep2, 'approved', [
            (p_cloud, 10, 299, 3, True),
        ], risk=0)

        # Q-1033: Vanguard FinTech - Portal Active (counter-offer)
        q1033 = make_quote('Q-1033', c_vanguard, manager, 'under_negotiation', [
            (p_laptop, 50, 1200, 8, False),
            (p_security, 50, 199, 5, True),
        ], risk=1.5)

        # Q-1035: TechNova - Confirmed
        q1035 = make_quote('Q-1035', c_techno, rep3, 'confirmed', [
            (p_security, 10, 199, 3, True),
        ], risk=0)

        # Q-1028: Starlight Media - Approved, low margin
        q1028 = make_quote('Q-1028', c_starlight, rep2, 'approved', [
            (p_cloud, 50, 299, 17, True),
            (p_care, 50, 149, 12, True),
        ], days_ago=5, risk=12)

        self.stdout.write(self.style.SUCCESS('  [OK] Sample quotations created'))

        # -- Fulfillment Splits --
        FulfillmentSplit.objects.create(
            quotation=q1039, warehouse=wh_austin, product=p_server, qty=40,
            status='accepted', promised_ship_date=date.today() + timedelta(days=3), estimated_cost=150
        )
        FulfillmentSplit.objects.create(
            quotation=q1039, warehouse=wh_newark, product=p_server, qty=8,
            status='suggested', promised_ship_date=date.today() - timedelta(days=2), estimated_cost=220
        )
        self.stdout.write(self.style.SUCCESS('  [OK] Fulfillment splits created'))

        # -- Negotiation Messages --
        from portal.models import NegotiationMessage
        NegotiationMessage.objects.create(
            quotation=q1042, author_type='customer', author_name='John Reynolds',
            message='Can we do 15% discount if we scale to 4 units?',
            line_ref=q1042.lines.first(),
        )
        NegotiationMessage.objects.create(
            quotation=q1042, author_type='rep', author_name='Elena Vance',
            message='Approved for 12% currently; 15% triggers VP Finance sign-off.',
            line_ref=q1042.lines.first(),
        )
        NegotiationMessage.objects.create(
            quotation=q1042, author_type='customer', author_name='John Reynolds',
            message='Can we push this to next month deployment cycle?',
            line_ref=q1042.lines.all()[1],
        )
        NegotiationMessage.objects.create(
            quotation=q1033, author_type='customer', author_name='Vanguard FinTech',
            message='We need better pricing for this volume. Counter-proposing $112,000 total (-6.6%).',
            counter_discount_percent=12,
        )
        self.stdout.write(self.style.SUCCESS('  [OK] Negotiation messages created'))

        # -- Invoices --
        inv1 = Invoice.objects.create(
            invoice_number='INV-1042', quotation=q1042, type='one_time',
            amount=Decimal('2679.00'), status='sent', due_date=date.today() + timedelta(days=30)
        )
        inv2 = Invoice.objects.create(
            invoice_number='INV-1035-R1', quotation=q1035, type='recurring',
            amount=Decimal('1930.70'), status='paid', due_date=date.today() - timedelta(days=5)
        )
        Payment.objects.create(invoice=inv2, amount=Decimal('1930.70'), method='bank_transfer', reference='ACH-7392')
        self.stdout.write(self.style.SUCCESS('  [OK] Invoices & payments created'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('[SUCCESS] Seed data complete!'))
        self.stdout.write('')
        self.stdout.write('  Login credentials:')
        self.stdout.write('  -------------------------------------')
        self.stdout.write('  Admin:         admin / admin123')
        self.stdout.write('  Sales Manager: elena.vance / pass123')
        self.stdout.write('  Finance:       michael.shah / pass123')
        self.stdout.write('  Sales Rep:     marcus.ross / pass123')
        self.stdout.write('  Sales Rep:     sarah.lin / pass123')
        self.stdout.write('  Sales Rep:     david.kim / pass123')
        self.stdout.write('  Customer:      john.reynolds / pass123')
        self.stdout.write('  Customer:      lisa.chen / pass123')
        self.stdout.write('  -------------------------------------')
