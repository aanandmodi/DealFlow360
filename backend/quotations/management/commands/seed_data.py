"""
Seed data management command.
Populates the database with realistic demo data for the DealFlow360 hackathon demo.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import ProductCategory, Product, Customer
from quotations.models import DiscountTier, CategoryDiscountCeiling, ApprovalChain
from fulfillment.models import Warehouse, StockLevel
from billing.models import SubscriptionPlan, UpsellRule

User = get_user_model()


class Command(BaseCommand):
    help = 'Load seed data for DealFlow360 demo'

    def handle(self, *args, **options):
        self.stdout.write('Seeding DealFlow360 database...\n')

        # === Users ===
        admin_user, _ = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@dealflow360.com',
                'first_name': 'System',
                'last_name': 'Admin',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
            },
        )
        admin_user.set_password('admin123')
        admin_user.save()

        elena, _ = User.objects.get_or_create(
            username='elena.vance',
            defaults={
                'email': 'elena@dealflow360.com',
                'first_name': 'Elena',
                'last_name': 'Vance',
                'role': 'sales_rep',
            },
        )
        elena.set_password('demo123')
        elena.save()

        manager, _ = User.objects.get_or_create(
            username='m.shah',
            defaults={
                'email': 'mshah@dealflow360.com',
                'first_name': 'M.',
                'last_name': 'Shah',
                'role': 'sales_manager',
            },
        )
        manager.set_password('demo123')
        manager.save()

        finance, _ = User.objects.get_or_create(
            username='r.iyer',
            defaults={
                'email': 'riyer@dealflow360.com',
                'first_name': 'R.',
                'last_name': 'Iyer',
                'role': 'finance',
            },
        )
        finance.set_password('demo123')
        finance.save()

        self.stdout.write(self.style.SUCCESS('  [OK] Users created'))

        # === Product Categories ===
        hw_cat, _ = ProductCategory.objects.get_or_create(name='Hardware', defaults={'description': 'Physical hardware products'})
        svc_cat, _ = ProductCategory.objects.get_or_create(name='Services', defaults={'description': 'Professional services and setup'})
        war_cat, _ = ProductCategory.objects.get_or_create(name='Warranty', defaults={'description': 'Extended warranty and SLA plans'})
        sub_cat, _ = ProductCategory.objects.get_or_create(name='Subscription', defaults={'description': 'Recurring subscription products'})

        self.stdout.write(self.style.SUCCESS('  [OK] Product categories created'))

        # === Products ===
        laptop, _ = Product.objects.get_or_create(
            sku='HW-LP14',
            defaults={'name': 'Laptop Pro 14 (Core i7, 32GB RAM, 1TB NVMe)', 'category': hw_cat, 'base_price': 1200, 'unit': 'unit', 'tax_rate': 8.25},
        )
        server, _ = Product.objects.get_or_create(
            sku='HW-SRV48',
            defaults={'name': 'Enterprise Server Unit (48-Core)', 'category': hw_cat, 'base_price': 4500, 'unit': 'unit', 'tax_rate': 8.25},
        )
        mouse, _ = Product.objects.get_or_create(
            sku='ACC-WDM',
            defaults={'name': 'Wireless Mouse & Ergonomic Dock', 'category': hw_cat, 'base_price': 85, 'unit': 'bundle', 'tax_rate': 8.25},
        )
        dock, _ = Product.objects.get_or_create(
            sku='ACC-TB4',
            defaults={'name': 'Thunderbolt 4 Docking Station', 'category': hw_cat, 'base_price': 195, 'unit': 'unit', 'tax_rate': 8.25},
        )

        setup, _ = Product.objects.get_or_create(
            sku='SV-SETUP',
            defaults={'name': 'Onsite Setup & Deployment Service', 'category': svc_cat, 'base_price': 450, 'unit': 'package', 'tax_rate': 0},
        )
        consulting, _ = Product.objects.get_or_create(
            sku='SV-CONS',
            defaults={'name': 'IT Consulting (per day)', 'category': svc_cat, 'base_price': 800, 'unit': 'day', 'tax_rate': 0},
        )

        ext_warranty, _ = Product.objects.get_or_create(
            sku='SV-EXTWAR',
            defaults={'name': 'Extended Warranty & SLA (2-Year Enterprise)', 'category': war_cat, 'base_price': 180, 'unit': 'unit', 'tax_rate': 0},
        )

        care_plan, _ = Product.objects.get_or_create(
            sku='SUB-CP2',
            defaults={'name': 'Care Plan 2yr 24/7 Priority Support', 'category': sub_cat, 'base_price': 45, 'unit': 'monthly', 'tax_rate': 0, 'is_subscription': True},
        )
        cloud_backup, _ = Product.objects.get_or_create(
            sku='SUB-CB1',
            defaults={'name': 'Cloud Backup & Recovery Service', 'category': sub_cat, 'base_price': 29.99, 'unit': 'monthly', 'tax_rate': 0, 'is_subscription': True},
        )

        self.stdout.write(self.style.SUCCESS('  [OK] Products created'))

        # === Customers ===
        acme, _ = Customer.objects.get_or_create(
            email='procurement@acmecorp.com',
            defaults={'name': 'Acme Corp', 'company': 'Acme Corporation', 'tier': 'gold', 'phone': '+1-555-0100'},
        )
        delta, _ = Customer.objects.get_or_create(
            email='ops@deltaindustries.com',
            defaults={'name': 'Delta Industries', 'company': 'Delta Industries Ltd', 'tier': 'silver', 'phone': '+1-555-0200'},
        )
        zenith, _ = Customer.objects.get_or_create(
            email='tech@zenithco.com',
            defaults={'name': 'Zenith Co', 'company': 'Zenith Technologies', 'tier': 'silver', 'phone': '+1-555-0300'},
        )
        omni, _ = Customer.objects.get_or_create(
            email='buyer@omniglobal.com',
            defaults={'name': 'Omni Global', 'company': 'Omni Global Corp', 'tier': 'bronze', 'phone': '+1-555-0400'},
        )
        vanguard, _ = Customer.objects.get_or_create(
            email='deals@vanguardft.com',
            defaults={'name': 'Vanguard FinTech Group', 'company': 'Vanguard FinTech', 'tier': 'gold', 'phone': '+1-555-0500'},
        )

        self.stdout.write(self.style.SUCCESS('  [OK] Customers created'))

        # === Discount Tiers ===
        bronze_tier, _ = DiscountTier.objects.get_or_create(
            tier_key='bronze',
            defaults={'name': 'Bronze', 'max_discount_percent': 5},
        )
        silver_tier, _ = DiscountTier.objects.get_or_create(
            tier_key='silver',
            defaults={'name': 'Silver', 'max_discount_percent': 10},
        )
        gold_tier, _ = DiscountTier.objects.get_or_create(
            tier_key='gold',
            defaults={'name': 'Gold', 'max_discount_percent': 15},
        )

        self.stdout.write(self.style.SUCCESS('  [OK] Discount tiers created'))

        # === Category Discount Ceilings ===
        # Hardware gets full tier ceiling, Services gets lower
        for tier, hw_ceil, svc_ceil, war_ceil in [
            (bronze_tier, 5, 3, 5),
            (silver_tier, 10, 7, 10),
            (gold_tier, 15, 10, 15),
        ]:
            CategoryDiscountCeiling.objects.get_or_create(
                category=hw_cat, discount_tier=tier,
                defaults={'max_discount_percent': hw_ceil},
            )
            CategoryDiscountCeiling.objects.get_or_create(
                category=svc_cat, discount_tier=tier,
                defaults={'max_discount_percent': svc_ceil},
            )
            CategoryDiscountCeiling.objects.get_or_create(
                category=war_cat, discount_tier=tier,
                defaults={'max_discount_percent': war_ceil},
            )

        self.stdout.write(self.style.SUCCESS('  [OK] Category discount ceilings created'))

        # === Approval Chains ===
        ApprovalChain.objects.get_or_create(
            name='Low Risk — Manager Only',
            defaults={'min_overage_threshold': 0, 'max_overage_threshold': 5, 'requires_finance': False},
        )
        ApprovalChain.objects.get_or_create(
            name='High Risk — Manager + Finance',
            defaults={'min_overage_threshold': 5, 'max_overage_threshold': 100, 'requires_finance': True},
        )

        self.stdout.write(self.style.SUCCESS('  [OK] Approval chains created'))

        # === Warehouses ===
        main_wh, _ = Warehouse.objects.get_or_create(
            name='Main Depot',
            defaults={'location': 'San Francisco, CA', 'shipping_cost_weight': 1},
        )
        east_wh, _ = Warehouse.objects.get_or_create(
            name='East Depot',
            defaults={'location': 'New York, NY', 'shipping_cost_weight': 1.2},
        )

        self.stdout.write(self.style.SUCCESS('  [OK] Warehouses created'))

        # === Stock Levels ===
        for product, main_qty, east_qty in [
            (laptop, 50, 30),
            (server, 15, 10),
            (mouse, 200, 150),
            (dock, 80, 60),
            (setup, 999, 999),  # Services = unlimited
            (consulting, 999, 999),
            (ext_warranty, 999, 999),
        ]:
            StockLevel.objects.get_or_create(
                warehouse=main_wh, product=product,
                defaults={'quantity': main_qty, 'reorder_point': 10},
            )
            StockLevel.objects.get_or_create(
                warehouse=east_wh, product=product,
                defaults={'quantity': east_qty, 'reorder_point': 5},
            )

        self.stdout.write(self.style.SUCCESS('  [OK] Stock levels created'))

        # === Subscription Plans ===
        SubscriptionPlan.objects.get_or_create(
            name='Care Plan Monthly',
            defaults={'product': care_plan, 'interval': 'monthly', 'price': 45},
        )
        SubscriptionPlan.objects.get_or_create(
            name='Cloud Backup Monthly',
            defaults={'product': cloud_backup, 'interval': 'monthly', 'price': 29.99},
        )

        self.stdout.write(self.style.SUCCESS('  [OK] Subscription plans created'))

        # === Upsell Rules ===
        UpsellRule.objects.get_or_create(
            source_product=laptop, target_product=mouse,
            defaults={'margin_threshold': 15, 'promotion_tag': 'Bundle -17%'},
        )
        UpsellRule.objects.get_or_create(
            source_product=laptop, target_product=dock,
            defaults={'margin_threshold': 15, 'promotion_tag': 'Promo 15% Off'},
        )
        UpsellRule.objects.get_or_create(
            source_product=laptop, target_product=care_plan,
            defaults={'margin_threshold': 10, 'promotion_tag': 'Monthly Recurring'},
        )
        UpsellRule.objects.get_or_create(
            source_product=server, target_product=ext_warranty,
            defaults={'margin_threshold': 10, 'promotion_tag': 'Recommended'},
        )

        self.stdout.write(self.style.SUCCESS('  [OK] Upsell rules created'))

        self.stdout.write(self.style.SUCCESS('\n[SUCCESS] Seed data loaded successfully!'))
        self.stdout.write('\nDemo accounts:')
        self.stdout.write('  admin/admin123 — Admin (superuser)')
        self.stdout.write('  elena.vance/demo123 — Sales Rep')
        self.stdout.write('  m.shah/demo123 — Sales Manager')
        self.stdout.write('  r.iyer/demo123 — Finance')
