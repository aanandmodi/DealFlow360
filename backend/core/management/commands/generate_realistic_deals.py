"""
Django Management Command — Generates 200–300+ highly realistic, mathematically consistent
enterprise deals for DealFlow360.

Works seamlessly on both SQLite (local dev) and PostgreSQL (production).
Run:
    python manage.py generate_realistic_deals --count 250
    python manage.py generate_realistic_deals --count 300 --clean
"""

import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import User
from quotations.models import (
    Customer, Product, ProductVariant, DiscountTier, ApprovalChainRule,
    Quotation, QuotationLine, ApprovalLog,
)
from quotations.services.risk_score import compute_risk_score
from fulfillment.models import Warehouse, StockLevel, FulfillmentSplit
from billing.models import SubscriptionPlan, Invoice, Payment
from portal.models import NegotiationMessage


# Comprehensive pool of realistic B2B enterprise customers
ENTERPRISE_ACCOUNTS = [
    # Gold Tier (Large Enterprise / Tech Giants)
    ("Snowflake Computing", "procurement@snowflake.com", "gold", "450 Concar Dr, San Mateo, CA"),
    ("Datadog Systems", "billing@datadoghq.com", "gold", "620 8th Ave, New York, NY"),
    ("CrowdStrike Global", "it-ops@crowdstrike.com", "gold", "206 E 9th St, Austin, TX"),
    ("Zscaler Networks", "enterprise@zscaler.com", "gold", "120 Holger Way, San Jose, CA"),
    ("Twilio Enterprise", "finance@twilio.com", "gold", "101 Spear St, San Francisco, CA"),
    ("Shopify Plus Operations", "procure@shopify.com", "gold", "151 O'Connor St, Ottawa, Canada"),
    ("MongoDB Cloud Services", "vendor-desk@mongodb.com", "gold", "1633 Broadway, New York, NY"),
    ("HubSpot Marketing Tech", "billing@hubspot.com", "gold", "25 First St, Cambridge, MA"),
    ("Stripe Payments Corp", "dealdesk@stripe.com", "gold", "354 Oyster Point Blvd, San Francisco, CA"),
    ("Atlassian Cloud Corp", "procurement@atlassian.com", "gold", "341 George St, Sydney, Australia"),
    ("Palantir Technologies", "deals@palantir.com", "gold", "1555 Blake St, Denver, CO"),
    ("Okta Identity Inc", "finance@okta.com", "gold", "100 1st St, San Francisco, CA"),

    # Silver Tier (Mid-Market / Growth Tech)
    ("Brex Financial Inc", "ops@brex.com", "silver", "1283 Howard St, San Francisco, CA"),
    ("Ramp Card Operations", "procurement@ramp.com", "silver", "28 W 23rd St, New York, NY"),
    ("Figma Design Systems", "it@figma.com", "silver", "760 Market St, San Francisco, CA"),
    ("Notion Labs Enterprise", "dealflow@makenotion.com", "silver", "548 Market St, San Francisco, CA"),
    ("Canva Media Solutions", "finance@canva.com", "silver", "110 Kippax St, Surry Hills, Australia"),
    ("Zapier Integrations", "vendors@zapier.com", "silver", "548 Market St, San Francisco, CA"),
    ("Gusto Payroll Corp", "purchasing@gusto.com", "silver", "525 20th St, San Francisco, CA"),
    ("Vercel Frontend Cloud", "procure@vercel.com", "silver", "340 S Lemon Ave, Walnut, CA"),
    ("Linear Project Labs", "it@linear.app", "silver", "Mission St, San Francisco, CA"),
    ("Retool Internal Systems", "finance@retool.com", "silver", "156 2nd St, San Francisco, CA"),
    ("Loom Video Computing", "billing@loom.com", "silver", "140 2nd St, San Francisco, CA"),
    ("Supabase Cloud DB", "finance@supabase.com", "silver", "970 Toa Payoh N, Singapore"),

    # Bronze Tier (Early-Stage / Regional B2B)
    ("Acme Logistics Corp", "procure@acmelogistics.com", "bronze", "100 Industrial Pkwy, Chicago, IL"),
    ("Beacon Health Labs", "it@beaconhealth.org", "bronze", "450 Medical Blvd, Boston, MA"),
    ("Crestview Financial", "ops@crestviewcap.com", "bronze", "800 Wall St, New York, NY"),
    ("Dynamic Robotics", "admin@dynamicrobotics.io", "bronze", "12 Pioneer Way, Pittsburgh, PA"),
    ("Elevate Retail Group", "procure@elevateretail.com", "bronze", "500 Commercial St, Dallas, TX"),
    ("Falcon Aero Parts", "supply@falconaero.com", "bronze", "300 Aviation Way, Wichita, KS"),
    ("Greenfield Agritech", "ops@greenfieldag.com", "bronze", "70 Farmview Rd, Des Moines, IA"),
    ("Helix Bioanalytics", "lab@helixbio.com", "bronze", "200 Discovery Ln, San Diego, CA"),
    ("Ironclad Security Co", "it@ironcladsec.com", "bronze", "900 Defense Ave, Arlington, VA"),
    ("Jupiter IoT Solutions", "procurement@jupiteriot.com", "bronze", "10 Tech Hub, Austin, TX"),
    ("Kinetix Logistics", "warehouse@kinetixlog.com", "bronze", "400 Freight Rd, Memphis, TN"),
    ("Luminary Energy Corp", "finance@luminaryenergy.com", "bronze", "600 Solar Way, Phoenix, AZ"),
]

NEGOTIATION_FEEDBACK_SAMPLES = [
    "We love the proposal! If you can offer a 15% discount on the enterprise license, we will sign by end of week.",
    "Can you bundle Premier 24/7 SLA with the hardware package? We need guarantee on replacement units.",
    "Budget allocation for this quarter is capped at $45,000. Can we adjust quantities or extend contract term?",
    "Our board approved the technical evaluation. Please adjust payment terms to Net-45 for procurement sign-off.",
    "Counter proposal: 18% discount on subscriptions in exchange for a 2-year commitment.",
]


class Command(BaseCommand):
    help = 'Generate 200–300+ realistic enterprise deals with consistent calculations for DealFlow360'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=250,
            help='Number of realistic quotations to generate (default: 250)',
        )
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Wipe existing quotations and lines before generating',
        )

    def handle(self, *args, **options):
        count = options['count']
        clean = options['clean']

        self.stdout.write(self.style.NOTICE(f"\n=================================================="))
        self.stdout.write(self.style.NOTICE(f"  DealFlow360 Enterprise Realistic Data Generator"))
        self.stdout.write(self.style.NOTICE(f"  Target: {count} Deals | Clean mode: {clean}"))
        self.stdout.write(self.style.NOTICE(f"==================================================\n"))

        with transaction.atomic():
            # 1. Verify / Setup Users
            reps = list(User.objects.filter(role='sales_rep'))
            if not reps:
                elena, _ = User.objects.get_or_create(
                    username='elena.vance',
                    defaults={'email': 'elena@dealflow360.com', 'first_name': 'Elena', 'last_name': 'Vance', 'role': 'sales_rep'}
                )
                elena.set_password('demo123')
                elena.save()
                reps.append(elena)

            # Ensure additional team reps exist for realistic leaderboard distribution
            extra_reps = [
                ('marcus.ross', 'Marcus', 'Ross', 'marcus@dealflow360.com'),
                ('sarah.lin', 'Sarah', 'Lin', 'sarah@dealflow360.com'),
                ('david.kim', 'David', 'Kim', 'david@dealflow360.com'),
            ]
            for u, fn, ln, em in extra_reps:
                r_obj, created = User.objects.get_or_create(
                    username=u,
                    defaults={'email': em, 'first_name': fn, 'last_name': ln, 'role': 'sales_rep'}
                )
                if created:
                    r_obj.set_password('demo123')
                    r_obj.save()
                if r_obj not in reps:
                    reps.append(r_obj)

            manager, _ = User.objects.get_or_create(
                username='m.shah',
                defaults={'email': 'mshah@dealflow360.com', 'first_name': 'M.', 'last_name': 'Shah', 'role': 'sales_manager'}
            )
            manager.set_password('demo123')
            manager.save()

            finance, _ = User.objects.get_or_create(
                username='r.iyer',
                defaults={'email': 'riyer@dealflow360.com', 'first_name': 'R.', 'last_name': 'Iyer', 'role': 'finance'}
            )
            finance.set_password('demo123')
            finance.save()

            # 2. Verify / Setup Products
            products = list(Product.objects.filter(is_active=True))
            if not products:
                self.stdout.write("  Creating default products catalog...")
                default_prods = [
                    ('DealFlow360 Enterprise CRM', 'DF-CRM-ENT', 'subscriptions', Decimal('1800.00'), 'license/mo', True),
                    ('Autonomous RevOps AI Copilot', 'DF-AI-COPILOT', 'subscriptions', Decimal('2400.00'), 'org/mo', True),
                    ('Enterprise Gateway Server Rack', 'HW-SRV-RACK', 'hardware', Decimal('12500.00'), 'unit', False),
                    ('Edge IoT Smart Controller 4K', 'HW-IOT-4K', 'hardware', Decimal('750.00'), 'device', False),
                    ('Implementation & Data Migration', 'SRV-IMPL-ENT', 'services', Decimal('15000.00'), 'engagement', False),
                    ('Premier 24/7 Dedicated Support', 'SRV-PREM-247', 'services', Decimal('5000.00'), 'yr', True),
                    ('Enterprise Security Compliance Pack', 'SW-SEC-COMPL', 'software', Decimal('8500.00'), 'license', False),
                    ('Custom ERP Integration Suite', 'SW-ERP-INTG', 'software', Decimal('11000.00'), 'license', False),
                ]
                for name, sku, cat, price, unit, sub in default_prods:
                    p = Product.objects.create(
                        name=name, sku=sku, category=cat, base_price=price,
                        unit=unit, tax_pct=Decimal('8.50'), is_subscription=sub, is_active=True
                    )
                    products.append(p)

            # 3. Verify / Setup Warehouses
            warehouses = list(Warehouse.objects.filter(is_active=True))
            if not warehouses:
                wh_main = Warehouse.objects.create(name='Main Hub (Chicago)', code='WH-CHI', shipping_cost_weight=Decimal('1.00'))
                wh_west = Warehouse.objects.create(name='West Coast Depot (Reno)', code='WH-RNO', shipping_cost_weight=Decimal('1.35'))
                wh_east = Warehouse.objects.create(name='East Coast Depot (Atlanta)', code='WH-ATL', shipping_cost_weight=Decimal('1.20'))
                warehouses.extend([wh_main, wh_west, wh_east])

            # 4. Verify / Setup Customers
            existing_customers = list(Customer.objects.all())
            if len(existing_customers) < len(ENTERPRISE_ACCOUNTS):
                for comp_name, email, tier, addr in ENTERPRISE_ACCOUNTS:
                    cust, created = Customer.objects.get_or_create(
                        name=comp_name,
                        defaults={
                            'email': email,
                            'company': comp_name,
                            'tier': tier,
                            'address': addr,
                            'phone': f"(555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
                        }
                    )
                    if cust not in existing_customers:
                        existing_customers.append(cust)

            if clean:
                self.stdout.write("  Cleaning previous quotations and lines...")
                Quotation.objects.all().delete()

            self.stdout.write(f"  Generating {count} realistic quotations with full CPQ workflows...")

            now = timezone.now()
            created_quotes = []

            # Determine next starting quote number
            last_quote = Quotation.objects.order_by('-id').first()
            start_num = (last_quote.id + 100) if last_quote else 1000

            for i in range(count):
                quote_num = f"Q-{start_num + i}"
                customer = random.choice(existing_customers)
                rep = random.choice(reps)

                # Spread dates organically across last 90 days
                days_ago = random.randint(0, 90)
                created_date = now - timedelta(days=days_ago, hours=random.randint(1, 23), minutes=random.randint(1, 59))

                # Realistic status distribution for B2B pipeline
                status_roll = random.random()
                if status_roll < 0.32:
                    status = random.choice(['confirmed', 'paid', 'invoiced'])
                elif status_roll < 0.55:
                    status = random.choice(['under_negotiation', 'sent'])
                elif status_roll < 0.75:
                    status = 'pending_approval'
                elif status_roll < 0.90:
                    status = 'approved'
                elif status_roll < 0.96:
                    status = 'draft'
                else:
                    status = 'rejected'

                # Some deals should be idle > 14 days to trigger the Stalled Deal Anomaly detector!
                if status in ['under_negotiation', 'sent', 'pending_approval'] and random.random() < 0.18:
                    updated_date = created_date
                else:
                    updated_date = created_date + timedelta(days=random.randint(0, min(10, days_ago)))

                quote = Quotation.objects.create(
                    quote_number=quote_num,
                    customer=customer,
                    rep=rep,
                    status=status,
                    payment_terms=random.choice(['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Due Upon Receipt']),
                    notes=f"Q3 Enterprise Expansion Proposal for {customer.name}.",
                    portal_token=str(uuid.uuid4()),
                    created_at=created_date,
                    updated_at=updated_date,
                )

                # Add 1 to 4 products per deal
                num_lines = random.choices([1, 2, 3, 4], weights=[25, 45, 20, 10])[0]
                selected_prods = random.sample(products, k=min(num_lines, len(products)))

                subtotal = Decimal('0.00')
                gross_total = Decimal('0.00')
                total_discount = Decimal('0.00')
                total_tax = Decimal('0.00')

                # Base discount ceiling for customer tier
                tier_ceilings = {'gold': Decimal('15'), 'silver': Decimal('10'), 'bronze': Decimal('5')}
                base_ceiling = tier_ceilings.get(customer.tier, Decimal('5'))

                for p in selected_prods:
                    qty = random.choices([1, 2, 5, 10, 25, 50], weights=[40, 25, 20, 10, 3, 2])[0]
                    unit_price = Decimal(str(p.base_price))

                    # Discount distribution: 65% within limit, 25% mild overage (manager), 10% high overage (finance)
                    disc_type = random.random()
                    if disc_type < 0.65:
                        discount_pct = Decimal(str(random.randint(0, int(base_ceiling))))
                    elif disc_type < 0.88:
                        discount_pct = base_ceiling + Decimal(str(random.randint(2, 9)))
                    else:
                        discount_pct = base_ceiling + Decimal(str(random.randint(11, 22)))

                    line_gross = (unit_price * qty).quantize(Decimal('0.01'))
                    line_discount_amount = (line_gross * (discount_pct / Decimal('100'))).quantize(Decimal('0.01'))
                    line_net = line_gross - line_discount_amount
                    line_tax = (line_net * (Decimal('8.50') / Decimal('100'))).quantize(Decimal('0.01'))
                    line_total = line_net + line_tax

                    QuotationLine.objects.create(
                        quotation=quote,
                        product=p,
                        qty=qty,
                        unit_price=unit_price,
                        discount_pct=discount_pct,
                        is_subscription=p.is_subscription,
                        description=f"{p.name} - {qty} {p.unit}(s)",
                    )

                    gross_total += line_gross
                    total_discount += line_discount_amount
                    subtotal += line_net
                    total_tax += line_tax

                # Compute exact blended risk score using system engine
                risk_result = compute_risk_score(quote)
                quote.blended_risk_score = risk_result.blended_risk_score

                # Set required approval level
                if risk_result.requires_finance:
                    quote.required_approval_level = Quotation.ApprovalLevel.MANAGER_FINANCE
                elif risk_result.has_any_breach:
                    quote.required_approval_level = Quotation.ApprovalLevel.MANAGER
                else:
                    quote.required_approval_level = Quotation.ApprovalLevel.NONE

                if status in ['approved', 'confirmed', 'invoiced', 'paid']:
                    quote.manager_approved = True
                    if risk_result.requires_finance:
                        quote.finance_approved = True

                quote.save()

                # Update timestamp after save to preserve historical dates
                Quotation.objects.filter(pk=quote.pk).update(
                    created_at=created_date,
                    updated_at=updated_date,
                )

                # Generate realistic Audit Logs for state transitions
                if status in ['pending_approval', 'approved', 'confirmed', 'invoiced', 'paid']:
                    ApprovalLog.objects.create(
                        quotation=quote,
                        step_order=1,
                        role_required='sales_manager',
                        actor=manager,
                        action='approved' if status != 'pending_approval' else 'pending',
                        note='Commercial review passed. Discount structure within delegated operational authority.'
                             if status != 'pending_approval' else 'Automated routing: awaiting Sales Manager review.',
                        created_at=created_date + timedelta(hours=random.randint(1, 4))
                    )

                if risk_result.requires_finance and status in ['approved', 'confirmed', 'invoiced', 'paid']:
                    ApprovalLog.objects.create(
                        quotation=quote,
                        step_order=2,
                        role_required='finance',
                        actor=finance,
                        action='approved',
                        note='VP Finance Sign-off: Gross margin criteria met via multi-year contract term.',
                        created_at=created_date + timedelta(hours=random.randint(5, 12))
                    )

                if status == 'rejected':
                    ApprovalLog.objects.create(
                        quotation=quote,
                        step_order=1,
                        role_required='sales_manager',
                        actor=manager,
                        action='rejected',
                        note='Discount overage exceeds business target; please renegotiate with standard payment terms.',
                        created_at=created_date + timedelta(hours=2)
                    )

                # Generate Customer Portal Negotiation messages for interactive deals
                if status in ['under_negotiation', 'confirmed', 'invoiced']:
                    if random.random() < 0.40:
                        NegotiationMessage.objects.create(
                            quotation=quote,
                            author_type='customer',
                            author_name=customer.name,
                            message=random.choice(NEGOTIATION_FEEDBACK_SAMPLES),
                            created_at=created_date + timedelta(days=1)
                        )

                # Generate Fulfillment Splits for confirmed/invoiced orders
                if status in ['confirmed', 'invoiced', 'paid']:
                    hw_lines = quote.lines.filter(product__category='hardware')
                    for hl in hw_lines:
                        wh = random.choice(warehouses)
                        FulfillmentSplit.objects.create(
                            quotation=quote,
                            product=hl.product,
                            warehouse=wh,
                            qty=hl.qty,
                            estimated_cost=Decimal(str(hl.qty * 15)),
                            status='accepted',
                        )

                created_quotes.append(quote)

        self.stdout.write(self.style.SUCCESS(f"\n[SUCCESS] Successfully generated {len(created_quotes)} realistic deals!"))
        self.stdout.write(self.style.SUCCESS(f"  - Total Customers in Registry: {Customer.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"  - Total Quotations Active: {Quotation.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"  - Total Quotation Lines: {QuotationLine.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"  - Total Approval Logs: {ApprovalLog.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"  - Total Fulfillment Splits: {FulfillmentSplit.objects.count()}"))
        self.stdout.write(self.style.NOTICE(f"\nAll dashboards (/dashboard, /quotations, /reports, /deal-health) are now fully populated!\n"))
