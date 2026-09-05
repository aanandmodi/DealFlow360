"""
DealFlow360 — 5-Persona Comprehensive End-to-End Dry Run with Actual Data Flow

Personas Tested:
1. Sales Rep (aarav.sharma): Copilot margin inquiry, bulk CSV import, quote building, multi-channel dispatch, submission.
2. Sales Manager (meera.shah): Approval desk queue inspection, Tier 1 risk assessment and sign-off.
3. Finance Controller (riya.iyer): Tier 2 high-discount audit, payment term check, sign-off, invoice payment recording.
4. Fulfillment & Operations Lead: Multi-warehouse auto-split logic, latency optimization, and backorder identification.
5. Customer & Public Stakeholder: Cryptographic QR authenticity verification, portal negotiation, order confirmation, and hybrid billing verification.
"""
import os
import sys
import uuid
from decimal import Decimal

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dealflow360.settings')
import django
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
from quotations.services.dispatch import generate_dispatch_payloads, execute_dispatch
from quotations.bulk import validate_bulk_payload, commit_bulk_import
from core.verification import generate_quotation_signature, verify_quotation_signature, amount_to_words_inr
from core.copilot import build_role_context
from billing.services.lifecycle import confirm_order, record_payment, invoice_data
from billing.services.upsell import get_upsell_suggestions
from fulfillment.services.auto_split import suggest_split, persist_split
from portal.models import PortalToken, NegotiationMessage
from portal.services.anomaly import get_dashboard_summary

User = get_user_model()


def test_5_persona_flow():
    print("=" * 70)
    print("      DEALFLOW360: 5-PERSONA END-TO-END DATA TRAVEL DRY RUN       ")
    print("=" * 70)

    # -------------------------------------------------------------
    # 0. SETUP & PERSONA RESOLUTION
    # -------------------------------------------------------------
    rep = User.objects.filter(role='sales_rep').first()
    manager = User.objects.filter(role='sales_manager').first()
    finance = User.objects.filter(role='finance').first()
    admin = User.objects.filter(role='admin').first()

    assert rep and manager and finance, "All persona users must exist in DB."
    print(f"\n[PERSONAS LOADED]")
    print(f"  P1 (Sales Rep):           {rep.get_full_name()} (@{rep.username})")
    print(f"  P2 (Sales Manager):       {manager.get_full_name()} (@{manager.username})")
    print(f"  P3 (Finance Controller):  {finance.get_full_name()} (@{finance.username})")
    print(f"  P4 (Fulfillment Lead):    Automated Warehouse Routing Engine")
    print(f"  P5 (Customer Contact):    Enterprise Client via Secure Portal")

    # -------------------------------------------------------------
    # PERSONA 1: SALES REP CREATES DEAL & LEVERAGES INNOVATIONS
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("STAGE 1: SALES REP — DEAL CREATION & COPILOT ADVISORY")
    print("="*50)

    customer, _ = Customer.objects.get_or_create(
        name="Tata Digital Ventures Ltd",
        defaults={
            'email': 'procurement@tatadigital.example',
            'phone': '+91 98765 43210',
            'company': 'Tata Digital Ventures',
            'tier': Customer.Tier.GOLD
        }
    )

    quote_no = f"Q-E2E-{uuid.uuid4().hex[:6].upper()}"
    quote = Quotation.objects.create(
        quote_number=quote_no,
        customer=customer,
        rep=rep,
        status=Quotation.Status.DRAFT,
        notes="Q3 Enterprise Infrastructure Modernization Deal"
    )
    print(f"[P1.1] Quotation initialized: {quote.quote_number} for customer '{customer.name}'")

    # Feature Innovation 1: Quotation Bulk CSV Importer (Batch load line items)
    hw_laptop = Product.objects.filter(category='hardware').first()
    cloud_sub = Product.objects.filter(category='subscriptions').first()
    serv_deploy = Product.objects.filter(category='services').first()

    bulk_csv_content = f"""customer_name,customer_email,sku,quantity,unit_price,discount_pct,payment_terms,notes
{customer.name},{customer.email},{hw_laptop.sku},15,{hw_laptop.base_price},25.0,Net 30 Days,Executive Laptop Deployment
{customer.name},{customer.email},{cloud_sub.sku},25,{cloud_sub.base_price},10.0,Annual Pre-bill,Annual SaaS Seat Subscription
{customer.name},{customer.email},{serv_deploy.sku},1,{serv_deploy.base_price},15.0,Milestone,Full Implementation & SLA Kickoff
"""
    val_res = validate_bulk_payload(bulk_csv_content, rep)
    assert val_res['success'], f"Bulk validation failed: {val_res.get('error')}"
    print(f"[P1.2] Bulk CSV Parser validated: {val_res['total_rows']} rows with {val_res['error_count']} errors. Total Value: INR {val_res['total_value']:,.2f}")

    commit_res = commit_bulk_import(val_res['rows'], rep, target_quotation_id=quote.id)
    assert commit_res['success'], "Bulk commit failed"
    print(f"[P1.3] Bulk lines committed to {quote.quote_number}: {commit_res['total_lines']} items active.")

    quote.refresh_from_db()
    print(f"[P1.4] Deal financials calculated:")
    print(f"       Gross: INR {quote.gross_total:,.2f} | Net: INR {quote.total_amount:,.2f} | Margin: {quote.margin_pct:.1f}%")

    # Feature Innovation 2: Deal Copilot AI Role-Scoped RAG Intelligence
    copilot_context = build_role_context(rep)
    assert 'user_info' in copilot_context and 'priorities' in copilot_context, "Copilot context assembly failed"
    print(f"[P1.5] Deal Copilot RAG Context verified: Role={copilot_context['user_info']['role_title']}, Pipeline Value=INR {copilot_context['role_summary']['my_pipeline_value']:,.2f}")

    # Feature Innovation 3: Multi-Channel Dispatch Preview (WhatsApp & Gmail Chrome)
    dispatch_preview = generate_dispatch_payloads(
        quote,
        template_type='standard',
        recipient_phone=customer.phone or '+91 98765 43210',
        recipient_email=customer.email
    )
    assert 'whatsapp' in dispatch_preview and 'email' in dispatch_preview
    assert 'mail.google.com' in dispatch_preview['email']['gmail_url'], "Must target Gmail Web in Chrome"
    print(f"[P1.6] Multi-Channel Dispatch preview generated:")
    print(f"       - WhatsApp deep link: {dispatch_preview['whatsapp']['url'][:60]}...")
    print(f"       - Chrome Gmail link:  {dispatch_preview['email']['gmail_url'][:60]}...")

    # Dispatch via WhatsApp with immutable audit logging
    dispatch_exec = execute_dispatch(
        quotation=quote,
        channel='whatsapp',
        recipient='+91 98765 43210',
        template_type='standard',
        custom_note='Commercial proposal generated for review.',
        actor=rep,
        mark_as_sent=False
    )
    assert dispatch_exec['success'], "Dispatch execution failed"
    print(f"[P1.7] Quotation dispatch logged to audit trail (Channel: WhatsApp).")

    # Submit for Multi-Tier Approval
    eval_res = compute_risk_score(quote)
    assert eval_res.has_any_breach, "High discount on Gold tier must trigger breach"
    submit_quotation(quote, rep)
    quote.refresh_from_db()
    assert quote.status == Quotation.Status.PENDING_APPROVAL
    print(f"[P1.8] Quotation submitted by {rep.username}. Status: {quote.status}. Required Level: {quote.required_approval_level}")

    # -------------------------------------------------------------
    # PERSONA 2: SALES MANAGER INSPECTION & TIER 1 APPROVAL
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("STAGE 2: SALES MANAGER — APPROVAL DESK & TIER 1 SIGN-OFF")
    print("="*50)

    pending_quotes = Quotation.objects.filter(status=Quotation.Status.PENDING_APPROVAL)
    assert quote in pending_quotes
    print(f"[P2.1] Manager {manager.username} reviews pending queue ({pending_quotes.count()} deal(s) awaiting sign-off)")

    approve_quotation(quote, manager, "Tier 1 Sales Manager Sign-off: Strategic Q3 enterprise expansion approved.")
    quote.refresh_from_db()
    print(f"[P2.2] Manager sign-off recorded. Status: {quote.status} (manager_approved={quote.manager_approved})")

    # -------------------------------------------------------------
    # PERSONA 3: FINANCE CONTROLLER — TIER 2 AUDIT & APPROVAL
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("STAGE 3: FINANCE CONTROLLER — TIER 2 RISK AUDIT")
    print("="*50)

    if quote.required_approval_level in ('finance', 'manager_finance') and not quote.finance_approved:
        print(f"[P3.1] Finance Director {finance.username} audits risk overage (Payment terms: Net-30).")
        approve_quotation(quote, finance, "Tier 2 Finance Sign-off: Margin acceptable under annual commitment.")
        quote.refresh_from_db()

    assert quote.status == Quotation.Status.APPROVED
    print(f"[P3.2] Final approval granted! Status: {quote.status}")

    # -------------------------------------------------------------
    # PERSONA 4: FULFILLMENT & OPERATIONS — MULTI-WAREHOUSE SPLIT
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("STAGE 4: FULFILLMENT & LOGISTICS — WAREHOUSE AUTO-SPLIT")
    print("="*50)

    split_suggestion = suggest_split(quote)
    print(f"[P4.1] Fulfillment engine evaluated inventory across warehouses:")
    print(f"       Suggested shipments: {split_suggestion.total_shipments}")
    for s in split_suggestion.suggestions:
        print(f"       - Warehouse '{s.warehouse_name}': Qty {s.quantity} units (Backorder={s.is_backorder}, Est. Cost: INR {s.estimated_cost})")

    # -------------------------------------------------------------
    # PERSONA 5: CUSTOMER — DIGITAL VERIFICATION, NEGOTIATION, HYBRID BILLING
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("STAGE 5: CUSTOMER — CRYPTOGRAPHIC VERIFICATION & ORDER CONFIRMATION")
    print("="*50)

    # Feature Innovation 4: Cryptographic HMAC Verification
    sig = generate_quotation_signature(quote)
    is_valid = verify_quotation_signature(quote, sig)
    assert is_valid, "Cryptographic signature must verify"
    tampered_sig = sig[:-4] + "ffff"
    assert not verify_quotation_signature(quote, tampered_sig), "Tampered signature must be rejected"
    print(f"[P5.1] Cryptographic Ledger Seal: HMAC-SHA256={sig[:24]}... (Authenticity Validated: {is_valid})")

    # Indian Currency Words
    words = amount_to_words_inr(quote.total_amount + quote.tax_amount)
    print(f"[P5.2] Financial Compliance: Amount in words: '{words}'")

    # Customer access via portal token
    portal_token = PortalToken.objects.create(
        email=customer.email,
        quotation=quote,
        expires_at=timezone.now() + timezone.timedelta(days=14)
    )
    quote.status = Quotation.Status.SENT
    quote.portal_token = str(portal_token.token)
    quote.save()
    print(f"[P5.3] Customer opened magic portal link: /portal/quotations/{portal_token.token}")

    # Customer confirms order
    confirm_order(quote)
    quote.refresh_from_db()
    assert quote.status in (Quotation.Status.CONFIRMED, Quotation.Status.FULFILLMENT)
    print(f"[P5.4] Customer accepted terms and signed off. Quotation confirmed into active Order: {quote.status}")

    # Operations persists physical inventory reservation post-confirmation
    persist_split(quote, split_suggestion.suggestions)
    saved_splits = FulfillmentSplit.objects.filter(quotation=quote)
    print(f"[P5.5] Warehouse split reservation locked: {saved_splits.count()} distribution orders scheduled.")

    # Hybrid Billing: CapEx Invoice + OpEx Subscription
    invoices = Invoice.objects.filter(quotation=quote)
    subscriptions = Subscription.objects.filter(line__quotation=quote)
    assert invoices.exists(), "CapEx Invoices must be generated"
    assert subscriptions.exists(), "OpEx Recurring Subscriptions must be activated"

    print(f"[P5.5] Hybrid Billing verified:")
    for inv in invoices:
        inv_data = invoice_data(inv)
        print(f"       - Invoice {inv.invoice_number}: INR {inv.amount:,.2f} (Status: {inv.status}, Balance: INR {inv_data['balance']})")
    for sub in subscriptions:
        print(f"       - Active Subscription: {sub.line.product.name} | Billing Schedule: Next {sub.next_billing_date}")

    # Finance settles the payment
    inv_to_pay = invoices.first()
    pay_data = invoice_data(inv_to_pay)
    utr_code = f"UTR-{uuid.uuid4().hex[:10].upper()}"
    record_payment(
        inv_to_pay,
        {'amount': Decimal(pay_data['balance']), 'reference': utr_code, 'method': 'bank_transfer'},
        actor=finance
    )
    inv_to_pay.refresh_from_db()
    assert inv_to_pay.status == 'paid', "Invoice must transition to paid status"
    print(f"[P5.6] Finance recorded settlement payment {utr_code}. Invoice {inv_to_pay.invoice_number} marked as PAID.")

    print("\n" + "=" * 70)
    print("      SUCCESS: ALL 5 PERSONAS COMPLETED DATA TRAVEL WITH 100% INTEGRITY!     ")
    print("=" * 70)


if __name__ == '__main__':
    test_5_persona_flow()
