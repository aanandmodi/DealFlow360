"""
Multi-Channel Quotation Dispatch Service for DealFlow360.
Generates pre-formatted WhatsApp and Email payloads, web/app deep-links,
and immutable audit log records without requiring third-party API keys.
"""

import urllib.parse
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from core.verification import generate_quotation_signature
from quotations.models import Quotation, ApprovalLog


def get_quotation_links(quotation):
    """Constructs direct frontend verification and customer negotiation portal URLs."""
    frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    sig = generate_quotation_signature(quotation)
    token = quotation.portal_token or ''
    
    verify_url = f"{frontend_base}/verify/{quotation.quote_number}?sig={sig}"
    if token:
        verify_url += f"&token={token}"
        
    portal_url = f"{frontend_base}/portal/quotations/{token}" if token else verify_url
    pdf_url = f"http://127.0.0.1:8000/api/quotations/{quotation.id}/pdf/?sig={sig}"
    if token:
        pdf_url += f"&token={token}"
        
    return {
        'verify_url': verify_url,
        'portal_url': portal_url,
        'pdf_url': pdf_url,
        'signature_hash': sig,
    }


def clean_phone_number(raw_phone: str) -> str:
    """Strips formatting and ensures standard international/Indian country code."""
    if not raw_phone:
        return ""
    digits = "".join(c for c in raw_phone if c.isdigit())
    if len(digits) == 10:
        return "91" + digits  # Default India code
    return digits


def generate_dispatch_payloads(quotation: Quotation, custom_note: str = "", template_type: str = "standard", recipient_phone: str = "", recipient_email: str = ""):
    """
    Generates ready-to-dispatch messages and direct URLs for WhatsApp & Email.
    Supports templates: 'standard' (Formal Commercial Proposal), 'fast_track' (Executive Review & Confirm), 'urgent' (Limited-time Tier Discount).
    """
    links = get_quotation_links(quotation)
    cust = quotation.customer
    customer_name = cust.name
    customer_company = cust.company or cust.name
    rep_name = quotation.rep.get_full_name() if quotation.rep else "DealFlow360 Sales Desk"
    rep_email = quotation.rep.email if quotation.rep else "sales@dealflow360.com"
    
    net_total = quotation.total_amount
    tax_total = quotation.tax_amount
    grand_total = net_total + tax_total
    currency_str = f"₹ {grand_total:,.2f}"
    validity_str = quotation.valid_until.strftime('%d %b %Y') if quotation.valid_until else "30 Days from Issue"
    
    phone = clean_phone_number(recipient_phone or cust.phone)
    email = recipient_email or cust.email or ""
    
    # ── 1. WhatsApp Template Builder ──
    if template_type == "fast_track":
        wa_header = f"*Fast-Track Commercial Proposal: {quotation.quote_number}*"
        wa_lead = f"Dear *{customer_name}*,\nYour prioritized quotation for *{customer_company}* is prepared for 1-click executive review."
    elif template_type == "urgent":
        wa_header = f"*Special Tier Pricing Offer: {quotation.quote_number}*"
        wa_lead = f"Dear *{customer_name}*,\nWe have applied an exclusive {cust.get_tier_display()} tier discount on your commercial quotation."
    else:
        wa_header = f"*Official Commercial Quotation: {quotation.quote_number}*"
        wa_lead = f"Dear *{customer_name}*,\nThank you for choosing DealFlow360. Here is your official verified quotation for *{customer_company}*."

    wa_lines = [
        wa_header,
        wa_lead,
        "",
        f"*Total Proposal Value:* {currency_str} (incl. GST)",
        f"*Validity Period:* {validity_str}",
        f"*Payment Terms:* {quotation.payment_terms}",
        f"*Account Rep:* {rep_name}",
    ]
    
    if custom_note.strip():
        wa_lines.append(f"\n*Special Note:* {custom_note.strip()}")
        
    wa_lines.extend([
        "",
        "*Review & Confirm Proposal Online:*",
        links['portal_url'],
        "",
        "*Cryptographic Authenticity Verification:*",
        links['verify_url'],
        "",
        "Need any adjustments? Reply directly to this message or request changes on your customer portal.",
    ])
    
    wa_text = "\n".join(wa_lines)
    wa_encoded = urllib.parse.quote(wa_text)
    wa_url = f"https://wa.me/{phone}?text={wa_encoded}" if phone else f"https://wa.me/?text={wa_encoded}"

    # ── 2. Email Template Builder ──
    if template_type == "fast_track":
        email_subject = f"Executive Fast-Track Proposal — Quotation {quotation.quote_number} for {customer_company}"
    elif template_type == "urgent":
        email_subject = f"Special Tier Commercial Terms — Quotation {quotation.quote_number} for {customer_company}"
    else:
        email_subject = f"Commercial Quotation {quotation.quote_number} from DealFlow360 for {customer_company}"

    email_plain = (
        f"Dear {customer_name},\n\n"
        f"Please find the commercial quotation details for {customer_company} below:\n\n"
        f"Quotation Reference: {quotation.quote_number}\n"
        f"Total Proposal Value: {currency_str}\n"
        f"Payment Terms: {quotation.payment_terms}\n"
        f"Validity: {validity_str}\n"
        f"Sales Representative: {rep_name} ({rep_email})\n\n"
        f"{f'Note from sales rep: {custom_note}' if custom_note else ''}\n\n"
        f"Review and negotiate your quotation securely online:\n{links['portal_url']}\n\n"
        f"Verify cryptographic tamper-proof ledger:\n{links['verify_url']}\n\n"
        f"Regards,\n{rep_name}\nDealFlow360 Enterprise Sales"
    )

    mailto_encoded_subject = urllib.parse.quote(email_subject)
    mailto_encoded_body = urllib.parse.quote(email_plain)
    mailto_url = f"mailto:{email}?subject={mailto_encoded_subject}&body={mailto_encoded_body}" if email else f"mailto:?subject={mailto_encoded_subject}&body={mailto_encoded_body}"
    gmail_encoded_to = urllib.parse.quote(email) if email else ""
    gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={gmail_encoded_to}&su={mailto_encoded_subject}&body={mailto_encoded_body}"

    email_html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #2563EB; padding: 24px 32px; color: #ffffff;">
            <div style="font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">DealFlow360</div>
            <div style="font-size: 12px; opacity: 0.85; margin-top: 2px;">Autonomous Enterprise Quote-to-Cash</div>
        </div>
        <div style="padding: 32px;">
            <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Commercial Proposal Prepared for {customer_name}</h2>
            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                We have generated your formal tax quotation <strong>{quotation.quote_number}</strong> with complete pricing breakdowns, catalog specifications, and commercial terms.
            </p>
            {f'<div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; font-size: 12px; color: #1e40af; border-radius: 4px; margin: 16px 0;"><strong>Rep Note:</strong> {custom_note}</div>' if custom_note else ''}
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <table style="width: 100%; font-size: 12px; color: #334155; border-collapse: collapse;">
                    <tr><td style="padding: 6px 0; color: #64748b;">Quotation Number:</td><td style="text-align: right; font-weight: bold; font-family: monospace;">{quotation.quote_number}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b;">Client Account:</td><td style="text-align: right; font-weight: 600;">{customer_company}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b;">Payment Terms:</td><td style="text-align: right;">{quotation.payment_terms}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b;">Validity Expiry:</td><td style="text-align: right;">{validity_str}</td></tr>
                    <tr style="border-top: 1px solid #e2e8f0;"><td style="padding: 10px 0 0 0; font-weight: bold; color: #0f172a;">Grand Total (INR):</td><td style="padding: 10px 0 0 0; text-align: right; font-size: 16px; font-weight: bold; color: #2563EB;">{currency_str}</td></tr>
                </table>
            </div>
            <div style="text-align: center; margin: 28px 0;">
                <a href="{links['portal_url']}" style="background: #2563EB; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block;">
                    Review &amp; Confirm Quotation Online &rarr;
                </a>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
                DealFlow360 Cryptographic Trust Engine &middot; SHA-256 Checksum: <code style="color: #059669;">{links['signature_hash'][:20]}...</code>
            </div>
        </div>
    </div>
    """

    return {
        'quotation_id': quotation.id,
        'quote_number': quotation.quote_number,
        'customer_name': customer_name,
        'customer_company': customer_company,
        'customer_phone': phone,
        'customer_email': email,
        'grand_total_display': currency_str,
        'links': links,
        'whatsapp': {
            'phone': phone,
            'text': wa_text,
            'url': wa_url,
        },
        'email': {
            'to_email': email,
            'subject': email_subject,
            'body_text': email_plain,
            'body_html': email_html,
            'mailto_url': mailto_url,
            'gmail_url': gmail_url,
        }
    }


def execute_dispatch(quotation: Quotation, channel: str, recipient: str, template_type: str, custom_note: str, actor, mark_as_sent: bool = True):
    """
    Executes and records the dispatch event into the audit trail.
    Optionally advances quotation stage to 'sent'.
    """
    channel_name = "WhatsApp" if channel.lower() == "whatsapp" else "Email"
    recipient_clean = recipient or (quotation.customer.phone if channel.lower() == "whatsapp" else quotation.customer.email)
    
    # Advance status if currently in draft or approved
    if mark_as_sent and quotation.status in (Quotation.Status.DRAFT, Quotation.Status.APPROVED):
        quotation.status = Quotation.Status.SENT
        quotation.save(update_fields=['status', 'updated_at'])

    # Create immutable audit log entry
    note = f"Dispatched via {channel_name} to {recipient_clean}. Template: {template_type.replace('_', ' ').title()}."
    if custom_note:
        note += f" Note: \"{custom_note}\""

    ApprovalLog.objects.create(
        quotation=quotation,
        actor=actor if actor and actor.is_authenticated else None,
        action='dispatched',
        note=note,
        role_required=getattr(actor, 'role', 'sales_rep') if actor else 'sales_rep',
    )

    payloads = generate_dispatch_payloads(
        quotation,
        custom_note=custom_note,
        template_type=template_type,
        recipient_phone=recipient if channel.lower() == 'whatsapp' else quotation.customer.phone,
        recipient_email=recipient if channel.lower() == 'email' else quotation.customer.email,
    )

    return {
        'success': True,
        'message': f"Quotation {quotation.quote_number} successfully dispatched via {channel_name}.",
        'quotation_status': quotation.status,
        'quotation_status_display': quotation.get_status_display(),
        'channel': channel_name,
        'recipient': recipient_clean,
        'payloads': payloads,
    }
