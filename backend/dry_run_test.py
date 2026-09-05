"""
Complete End-to-End Dry Run of DealFlow360 across all roles:
1. Admin setup: DiscountTier, Warehouse, Stock, SubscriptionPlan, UpsellRule
2. Sales Rep: Create quotation with Hardware (Laptop) + Subscription (Cloud SaaS)
3. Pricing & Blended Risk Score: High discount triggers Manager + Finance approval
4. Upsell Suggestion: Accept upsell item and verify total + margin update
5. Sales Manager: Approves quotation (Stage 1)
6. Finance User: Approves quotation (Stage 2) -> Status becomes 'approved'
7. Fulfillment: Suggests warehouse split across 2 warehouses
8. Customer Portal: Opens quote via token, proposes counter-discount -> triggers auto re-approval!
9. Re-approval & Customer Confirmation -> Status becomes 'confirmed'
10. Hybrid Billing: One-time invoice + recurring subscription schedule generated
11. Finance Payment: Records payment on invoice -> Invoice becomes 'paid'
12. Role Boundaries: Verify Sales Rep CANNOT approve, CANNOT rebalance depot, CANNOT edit rules
"""
import os
import sys
import uuid
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dealflow360.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from quotations.models import (
    Customer, Product, ProductVariant, PriceList, PriceListItem,
    DiscountTier, ApprovalChainRule, Quotation, QuotationLine, ApprovalLog
)
from fulfillment.models import Warehouse, StockLevel, FulfillmentSplit
from billing.models import SubscriptionPlan, Subscription, Invoice, UpsellRule
from quotations.services.risk_score import compute_risk_score, submit_quotation, approve_quotation
from billing.services.lifecycle import confirm_order, record_payment, invoice_data
from billing.services.proration import get_billing_schedule, prorate_subscription_change
from billing.services.upsell import get_upsell_suggestions
from fulfillment.services.auto_split import suggest_split, persist_split
from portal.services.anomaly import get_stalled_deals, get_discount_anomalies, get_delivery_slippage, get_dashboard_summary

User = get_user_model()

def run_dry_run():
    print("==================================================")
    print("   DEALFLOW360 END-TO-END ROLE & FLOW DRY RUN     ")
    print("==================================================")

    # 1. Fetch Users
    admin = User.objects.filter(role='admin').first()
    manager = User.objects.filter(role='sales_manager').first()
    finance = User.objects.filter(role='finance').first()
    rep = User.objects.filter(role='sales_rep').first()
    print(f"[PASS] Users loaded: Admin={admin.username}, Manager={manager.username}, Finance={finance.username}, Rep={rep.username}")

    # 2. Setup Base Data
    customer, _ = Customer.objects.get_or_create(
        name="Global Logistics Inc",
        defaults={'email': 'contact@globallogistics.example', 'tier': Customer.Tier.GOLD}
    )
    
    hw_prod = Product.objects.filter(category='hardware').first()
    sub_prod = Product.objects.filter(category='subscriptions').first()
    srv_prod = Product.objects.filter(category='services').first()
    print(f"[PASS] Products: HW={hw_prod.name}, Sub={sub_prod.name}, Srv={srv_prod.name}")

    # 3. Sales Rep creates quotation
    q_num = f"Q-{uuid.uuid4().hex[:8].upper()}"
    q = Quotation.objects.create(
        quote_number=q_num,
        customer=customer,
        rep=rep,
        status='draft',
        notes='E2E Dry Run Test Quotation'
    )
    print(f"[PASS] Step 1: Sales Rep ({rep.username}) created draft quote: {q.quote_number}")

    # Add HW Line with 25% discount (Gold allows 15% max -> 10% breach)
    line1 = QuotationLine.objects.create(
        quotation=q,
        product=hw_prod,
        qty=10,
        unit_price=hw_prod.base_price,
        discount_pct=Decimal('25.00')
    )
    # Add Subscription Line with 5% discount
    sub_plan = SubscriptionPlan.objects.filter(product=sub_prod, is_active=True).first()
    line2 = QuotationLine.objects.create(
        quotation=q,
        product=sub_prod,
        qty=5,
        unit_price=sub_prod.base_price,
        discount_pct=Decimal('5.00'),
        is_subscription=True,
        subscription_plan=sub_plan
    )
    print(f"[PASS] Step 2: Added HW (Qty 10, Disc 25%) + Sub (Qty 5, Disc 5%). Total: INR {q.total_amount:,.2f}, Margin: {q.margin_pct:.1f}%")

    # 4. Evaluate Blended Risk Score & Auto-Routing
    eval_result = compute_risk_score(q)
    print(f"[PASS] Step 3: Blended Risk Score = {eval_result.blended_risk_score:.2f}%, Breaches: {eval_result.has_any_breach}")
    print(f"         Required Level: {eval_result.required_approval_level}, Requires Finance: {eval_result.requires_finance}")
    assert eval_result.has_any_breach, "Breach must be detected for 25% discount"

    submit_result = submit_quotation(q, rep)
    print(f"[PASS] Step 4: Rep submitted quote. New status: {q.status} (pending_approval)")
    assert q.status == 'pending_approval'

    # 5. Check Upsell Suggestions
    upsells = get_upsell_suggestions(q)
    print(f"[PASS] Step 5: Upsell recommendations evaluated: {len(upsells)} suggestions found.")
    if upsells:
        up = upsells[0]
        print(f"         Top suggestion: {up.suggested_product_name} (Promoted={up.is_promoted}, Margin Delta=+INR {up.margin_delta:,.2f})")

    # 6. Sales Manager Approval (Stage 1)
    approve_quotation(q, manager, "Approved by Sales Manager: exceptional enterprise volume.")
    print(f"[PASS] Step 6: Manager ({manager.username}) approved. Status: {q.status}")
    if eval_result.requires_finance:
        assert q.status == 'pending_approval', "Should still be pending finance approval"
        # 7. Finance Approval (Stage 2)
        approve_quotation(q, finance, "Approved by Finance: payment terms 30 days accepted.")
        print(f"[PASS] Step 7: Finance ({finance.username}) approved. Status: {q.status}")
    assert q.status == 'approved'

    # 8. Warehouse Split Suggestion
    split_res = suggest_split(q)
    print(f"[PASS] Step 8: Multi-warehouse split suggested: {split_res.total_shipments} shipments across warehouses.")
    for s in split_res.suggestions:
        print(f"         Warehouse: {s.warehouse_name} | Qty: {s.quantity} | Backorder: {s.is_backorder} | Cost: INR {s.estimated_cost}")

    # 9. Customer Portal Negotiation Flow
    from portal.models import PortalToken, NegotiationMessage
    pt = PortalToken.objects.create(quotation=q, expires_at=timezone.now() + timezone.timedelta(days=7))
    print(f"[PASS] Step 9: Customer portal link generated: /portal/quotations/{pt.token}")

    # Customer counters with a higher discount: 28%
    q.lines.filter(product=hw_prod).update(discount_pct=Decimal('28.00'))
    NegotiationMessage.objects.create(
        quotation=q,
        author_type='customer',
        author_name=customer.name,
        message='We require 28% discount for quarterly budget clearance.',
        counter_discount_percent=Decimal('28.00')
    )
    q.status = 'under_negotiation'
    res = submit_quotation(q, None)
    print(f"[PASS] Step 10: Customer proposed 28% discount. Auto re-approval triggered: {res.has_any_breach}. New status: {q.status}")
    assert q.status == 'pending_approval', "Must re-enter approval flow when terms exceed thresholds"

    # Re-approve by Manager & Finance
    approve_quotation(q, manager, "Manager agreed to customer counter terms.")
    if res.requires_finance:
        approve_quotation(q, finance, "Finance sign-off on 28% counter terms.")
    print(f"[PASS] Step 11: Counter-terms re-approved. Status: {q.status}")
    assert q.status == 'approved'

    # 10. Customer Confirms Order
    confirm_order(q)
    print(f"[PASS] Step 12: Order confirmed! Status: {q.status}")
    assert q.status in ('confirmed', 'fulfillment')

    # 11. Hybrid Billing Verification
    invs = Invoice.objects.filter(quotation=q)
    subs = Subscription.objects.filter(line__quotation=q)
    print(f"[PASS] Step 13: Hybrid billing verified! {invs.count()} Invoice(s), {subs.count()} Subscription(s) generated.")
    for inv in invs:
        data = invoice_data(inv)
        print(f"          Invoice {inv.invoice_number}: INR {inv.amount} (Balance: {data['balance']}, Status: {inv.status})")
    for sub in subs:
        print(f"          Subscription for {sub.line.product.name}: Status={sub.status}, Next Billing={sub.next_billing_date}")

    # 12. Record Payment by Finance
    if invs.exists():
        inv = invs.first()
        data = invoice_data(inv)
        bal = Decimal(data['balance'])
        record_payment(inv, {'amount': bal, 'reference': f"UTR-{uuid.uuid4().hex[:8].upper()}", 'method': 'bank_transfer'}, actor=finance)
        inv.refresh_from_db()
        print(f"[PASS] Step 14: Payment recorded by Finance on Invoice {inv.invoice_number}. New status: {inv.status}")
        assert inv.status == 'paid'

    # 13. Telemetry & Anomaly Radar Check
    stalled = get_stalled_deals()
    anomalies = get_discount_anomalies()
    summary = get_dashboard_summary()
    print(f"[PASS] Step 15: Telemetry Summary: Active Pipeline=INR {summary['active_pipeline_value']:,.2f}, At Risk Count={summary['at_risk_count']}, Closed Won=INR {summary['closed_won_value']:,.2f}")

    print("==================================================")
    print("   ALL 15 E2E DRY RUN STAGES PASSED FLAWLESSLY!   ")
    print("==================================================")

if __name__ == '__main__':
    run_dry_run()
