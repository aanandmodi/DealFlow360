"""Add an explicitly fictional Indian demonstration workspace without deleting data."""
import os
from datetime import timedelta
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from core.models import User
from quotations.models import Customer, Product, DiscountTier, ApprovalChainRule, Quotation, QuotationLine, ProductVariant
from quotations.services.risk_score import submit_quotation, approve_quotation
from fulfillment.models import Warehouse, StockLevel
from fulfillment.services.auto_split import suggest_split, persist_split
from billing.models import SubscriptionPlan, UpsellRule
from billing.services.lifecycle import confirm_order, record_payment


class Command(BaseCommand):
    help = 'Add fictional Indian customers and exercise real workflows. Existing records remain intact.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and os.getenv('ALLOW_DEMO_SEED', '0') != '1':
            raise CommandError('Demonstration seeding is disabled in production. Set ALLOW_DEMO_SEED=1 to permit.')
        password = os.getenv('DEMO_PASSWORD')
        if not password or len(password) < 12:
            raise CommandError('Set DEMO_PASSWORD to a local password of at least 12 characters.')
        users = {}
        for username, first, last, role in [('aarav.sharma','Aarav','Sharma','sales_rep'),
            ('meera.shah','Meera','Shah','sales_manager'),('riya.iyer','Riya','Iyer','finance'),
            ('aanand.admin','Aanand','Modi','admin')]:
            user, created = User.objects.get_or_create(username=username, defaults={'first_name':first,'last_name':last,
                'email':f'{username}@dealflow.example','role':role,'is_staff':role=='admin'})
            if created:
                user.set_password(password)
                user.save()
            users[role] = user
        products = []
        catalog = [('IN-LAP14','BusinessBook Pro 14','hardware',84900,61000,18,False),
            ('IN-MON27','StudioView 27 Monitor','hardware',24500,16200,18,False),
            ('IN-NET48','Enterprise Network Switch','hardware',62500,44000,18,False),
            ('IN-DEPLOY','On-site Deployment','services',12500,7200,18,False),
            ('IN-CLOUD','CloudSuite Business / seat','subscriptions',1800,550,18,True),
            ('IN-SECURE','SecureDesk Endpoint / seat','subscriptions',650,180,18,True)]
        for sku,name,category,price,cost,tax,recurring in catalog:
            product,_ = Product.objects.get_or_create(sku=sku,defaults=dict(name=name,category=category,
                base_price=price,cost_price=cost,tax_pct=tax,is_subscription=recurring,
                description='Fictional demonstration catalog. Prices are illustrative INR amounts.'))
            products.append(product)
            if recurring:
                SubscriptionPlan.objects.get_or_create(product=product,name=f'{name} Monthly',defaults={'price':price,'cycle':'monthly'})
                for cycle,multiplier in [('quarterly',3),('yearly',12)]:
                    SubscriptionPlan.objects.get_or_create(product=product,name=f'{name} {cycle.title()}',defaults={'price':price*multiplier,'cycle':cycle})
        ProductVariant.objects.get_or_create(product=products[0],attribute='Memory',value='32 GB',defaults={'extra_price':8000})
        for tier,ceiling in [('bronze',5),('silver',10),('gold',15)]:
            for category in ['hardware','software','services','subscriptions']:
                DiscountTier.objects.get_or_create(tier=tier,category=category,defaults={'max_discount_pct':ceiling-5 if category=='services' else ceiling})
        ApprovalChainRule.objects.get_or_create(name='Manager review',defaults={'min_over_pct':0,'max_over_pct':5})
        ApprovalChainRule.objects.get_or_create(name='Manager then finance',defaults={'min_over_pct':5,'max_over_pct':100,'requires_finance':True})
        warehouses=[]
        for name,location,weight in [('Mumbai Distribution Centre','Bhiwandi, Maharashtra',125),('Bengaluru South Depot','Whitefield, Karnataka',150),('Delhi NCR Hub','Gurugram, Haryana',175)]:
            wh,_=Warehouse.objects.get_or_create(name=name,defaults={'location':location,'shipping_cost_weight':weight})
            warehouses.append(wh)
            for product in products[:3]:
                StockLevel.objects.get_or_create(warehouse=wh,product=product,defaults={'in_stock':35 if wh==warehouses[0] else 20,'reorder_point':10})
        UpsellRule.objects.get_or_create(product=products[0],suggested_product=products[5],defaults={'min_margin_pct':25,'is_promoted':True})
        UpsellRule.objects.get_or_create(product=products[0],suggested_product=products[3],defaults={'min_margin_pct':20})
        customers=[('Narmada Technologies','Ahmedabad, Gujarat','gold'),('Sahyadri Manufacturing','Pune, Maharashtra','gold'),
            ('Kaveri Digital Labs','Bengaluru, Karnataka','silver'),('Aravali Healthcare','Jaipur, Rajasthan','gold'),
            ('Konkan Retail Systems','Mumbai, Maharashtra','silver'),('Deccan Learning Co.','Hyderabad, Telangana','bronze'),
            ('Malabar Logistics','Kochi, Kerala','gold'),('Vindhya Analytics','Indore, Madhya Pradesh','silver')]
        for i,(name,address,tier) in enumerate(customers):
            customer,_=Customer.objects.get_or_create(email=f'procurement{i+1}@customer.example',defaults={
                'name':name,'company':name+' Pvt. Ltd.','address':address,'tier':tier,'phone':f'+91 90000 1000{i}'})
            q,created=Quotation.objects.get_or_create(quote_number=f'IN-2026-{1101+i}',defaults={
                'customer':customer,'rep':users['sales_rep'],'valid_until':timezone.localdate()+timedelta(days=30),
                'notes':'Fictional sample deal for the hackathon demonstration.'})
            if not created:
                continue
            qty=[12,20,8,16,6,10,18,5][i]
            discount=[22,19,7,10,8,0,10,5][i]
            QuotationLine.objects.create(quotation=q,product=products[0],qty=qty,unit_price=products[0].base_price,discount_pct=discount)
            QuotationLine.objects.create(quotation=q,product=products[4],qty=qty,unit_price=products[4].base_price,is_subscription=True,discount_pct=min(discount,10))
            if i in (4,7):
                continue
            submit_quotation(q, users['sales_rep'])
            if i in (0,1):
                continue
            if q.status=='pending_approval':
                approve_quotation(q,users['sales_manager'],'Reviewed sample pricing exception.')
                if q.status=='pending_approval':
                    approve_quotation(q,users['finance'],'Reviewed sample economics.')
            if i in (3,6):
                confirm_order(q)
                persist_split(q,suggest_split(q).suggestions)
            if i==6:
                for invoice in q.invoices.all():
                    record_payment(invoice,{'amount':invoice.amount,'method':'bank_transfer','reference':f'SAMPLE-UTR-{invoice.id}'},users['finance'])
        self.stdout.write(self.style.SUCCESS('Indian demonstration workspace ready. Existing data was preserved.'))
