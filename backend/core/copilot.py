"""
AI Deal Copilot — Role-aware RAG conversational assistant for the DealFlow360 workspace.
Powered by Groq Cloud with strict database-level role privacy, full workspace navigation
and tab knowledge, and native Indian Currency (INR / Lakhs / Crores) financial intelligence.
"""
import os
import json
import re
import urllib.request
import urllib.error
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from core.permissions import IsInternalUser
from core.access import scoped_quotes
from quotations.models import Quotation, QuotationLine, Customer, Product, ApprovalLog
from portal.models import NegotiationMessage
from billing.models import Invoice, Subscription, Payment
from fulfillment.models import Warehouse, StockLevel


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def format_inr_number(amount) -> str:
    """
    Formats a numeric value using the Indian numbering comma grouping: ₹12,34,567.00
    """
    try:
        val = Decimal(str(amount))
    except Exception:
        return "₹0.00"

    is_neg = val < 0
    val = abs(val)
    int_part = int(val)
    dec_part = f"{val - int_part:.2f}"[1:]

    s = str(int_part)
    if len(s) <= 3:
        formatted = s
    else:
        last3 = s[-3:]
        rest = s[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        formatted = ",".join(groups) + "," + last3

    sign = "-" if is_neg else ""
    return f"{sign}₹{formatted}{dec_part}"


def format_inr_short(amount) -> str:
    """
    Formats a numeric value into friendly Indian currency terms (Crores, Lakhs, Thousands).
    Examples:
      13310000 -> ₹1.33 Crores
      1006250  -> ₹10.06 Lakhs
      45000    -> ₹45,000
    """
    try:
        val = float(amount)
    except Exception:
        return "₹0"

    sign = "-" if val < 0 else ""
    abs_val = abs(val)

    if abs_val >= 10_000_000:
        cr = abs_val / 10_000_000
        return f"{sign}₹{cr:.2f} Crores"
    elif abs_val >= 100_000:
        lakh = abs_val / 100_000
        return f"{sign}₹{lakh:.2f} Lakhs"
    elif abs_val >= 1_000:
        return f"{sign}₹{int(abs_val):,}"
    else:
        return format_inr_number(val).replace(".00", "")


def format_inr_display(amount) -> str:
    """
    Combines Indian denomination with exact rupee figure:
    e.g. "₹10.06 Lakhs (₹10,06,250.00)" or "₹1.33 Crores (₹1,33,10,000.00)"
    """
    short_str = format_inr_short(amount)
    num_str = format_inr_number(amount)
    if "Crores" in short_str or "Lakhs" in short_str:
        return f"{short_str} ({num_str})"
    return num_str


# Comprehensive System Architecture & Tab Navigation Knowledge Base
SYSTEM_TABS_AND_FEATURES = {
    "Overview / Dashboard (/dashboard)": {
        "route": "/dashboard",
        "purpose": "Executive KPI overview and sales velocity command center.",
        "key_metrics": [
            "Active Pipeline Value in INR (Lakhs/Crores)",
            "Won Revenue Bookings in INR",
            "Win Rate Percentage",
            "Average Deal Size in INR",
            "Stalled Deals count (> 14 days idle)",
            "Deal conversion stages (Draft -> Pending -> Approved -> Sent -> Won)",
        ],
        "actions": ["Filter by date range", "View sales rep performance leaderboard", "Quick jump to quotes"],
    },
    "Quotations & Pipeline (/quotations and /quotations/list)": {
        "route": "/quotations",
        "purpose": "Core deal pipeline tracking across both Kanban Funnel and Tabular List views.",
        "pipeline_stages": [
            "draft: Rep building deal, line items being added",
            "pending_approval: Submitted, awaiting Manager or Finance approval",
            "approved: Management approved, ready for customer dispatch",
            "sent: Dispatched to customer via WhatsApp or Chrome Gmail",
            "under_negotiation: Customer active in portal, counter-discounts requested",
            "confirmed: Customer accepted and digitally signed terms",
            "fulfillment: Multi-warehouse shipment allocation & distribution orders locked",
            "invoiced: Milestone or subscription invoice generated",
            "paid: Payment settled via NEFT/RTGS/UPI with bank UTR number",
            "rejected / cancelled / expired: Terminated deals",
        ],
        "core_features": {
            "Quotation Builder (/quotations/new and /quotations/:id)": (
                "Configure deals with CapEx hardware, OpEx SaaS recurring subscriptions, and Services. "
                "Real-time calculations for Gross Value, Discount %, 18% GST Tax, Net Payable in INR, "
                "Profit Margin %, and Blended Risk Score. Auto-determines approval level: "
                "'automatic' (discount <= 5%), 'manager' (5-15%), 'manager_finance' (> 15% or credit overage)."
            ),
            "Multi-Channel Quotation Dispatcher ('Dispatch' button)": (
                "Instant zero-friction quotation delivery. Generates 1-click WhatsApp deep links "
                "(wa.me/91XXXXXXXXXX) and Google Chrome Gmail compose links (mail.google.com/mail/?view=cm) "
                "with 3 enterprise templates (Standard Commercial Proposal, Fast-Track Executive, Urgent Tier Discount). "
                "Includes quote summary, net INR amount in Lakhs, and the magic customer portal link."
            ),
            "Smart Bulk CSV Importer ('Bulk Import CSV' button)": (
                "Mass quote/line item upload with pre-flight schema validation against live database. "
                "Canonical CSV columns: customer_name, customer_email, sku, quantity, unit_price, discount_pct, payment_terms, notes. "
                "Automatically detects recurring SaaS subscription items, verifies stock availability, checks discount ceilings, "
                "and commits batch quotations atomically with zero merge flaws."
            ),
            "Cryptographic Verification & Audit Portal (/verify/:quoteNumber)": (
                "Public verification certificate. Validates authenticity using HMAC-SHA256 digital signature "
                "to prevent invoice tampering or price manipulation. Generates live QR code, formal Indian Rupee "
                "currency words conversion (e.g. 'Eleven Lakh Eighty Seven Thousand Three Hundred Seventy Five Rupees Only'), "
                "and printable commercial ledger certificate."
            ),
        },
    },
    "Approval Desk (/approvals and /approvals/:id)": {
        "route": "/approvals",
        "access": "Restricted to Sales Managers, Finance Controllers, and Admins.",
        "purpose": "Dual-tier commercial risk and discount governance desk.",
        "workflow": (
            "Tier 1 (Sales Manager): Required for discounts 5%-15% or low margin deals. "
            "Tier 2 (Finance Controller): Required for discounts > 15%, margin < 15%, or Net-60/90 credit risk. "
            "Includes line-item margin audit, risk factor breakdown, and mandatory audit log with approval/rejection reasons."
        ),
    },
    "Fulfillment & Logistics (/fulfillment)": {
        "route": "/fulfillment",
        "access": "Sales Managers, Finance Controllers, Admins.",
        "purpose": "Intelligent multi-warehouse inventory routing and split shipment orchestration.",
        "features": [
            "Automated 'Suggest Split' engine balances orders across Indian fulfillment hubs (Mumbai, Delhi NCR, Bengaluru).",
            "Backorder detection when warehouse inventory is insufficient.",
            "Freight estimation and delivery timeline calculation.",
            "'Accept Split' locks warehouse distribution orders; 'Override Split' allows manual warehouse adjustments.",
        ],
    },
    "Inventory & Warehouses (/inventory)": {
        "route": "/inventory",
        "access": "Admins, Sales Managers, Finance.",
        "purpose": "Real-time stock level monitoring across all warehouse locations with minimum reorder threshold (< 10 units) alerts.",
    },
    "Subscriptions & Billing (/subscriptions)": {
        "route": "/subscriptions",
        "purpose": "SaaS recurring subscription lifecycle and recurring revenue management.",
        "features": [
            "Manages recurring plans (CloudSuite Business, CRM Pro, Analytics Add-on).",
            "Billing cycles: Monthly, Quarterly, Annual with automated next-billing schedule.",
            "Mid-term seat proration engine (/api/billing/<id>/prorate/) calculating exact day-level INR proration adjustments.",
            "Subscription pausing, resuming, and termination workflows.",
        ],
    },
    "Invoices & Payments (/invoices)": {
        "route": "/invoices",
        "purpose": "Commercial invoicing and cash flow settlement control.",
        "features": [
            "Invoices auto-generated upon customer quote confirmation.",
            "Statuses: Draft, Sent, Paid, Overdue.",
            "Settlement payment recording via NEFT, RTGS, UPI, and Bank Transfer with official UTR reference numbers.",
        ],
    },
    "Deal Health & Analytics (/deal-health)": {
        "route": "/deal-health",
        "purpose": "Predictive deal risk analytics, stalled deals detection (> 14 days idle), slippage forecasts, and margin anomaly monitoring.",
    },
    "Reports & Analytics (/reports)": {
        "route": "/reports",
        "purpose": "Category-wise revenue distribution in INR, sales rep performance leaderboard, discount variance report, and gross margin audits.",
    },
    "Catalog & Governance Rules (/config)": {
        "route": "/config",
        "access": "Sales Managers and Admins.",
        "purpose": "Product SKU configuration, base pricing, category tax rules (18% GST default), discount ceiling tiers, and credit limit governance.",
    },
    "Customer Magic Negotiation Portal (/portal/quotations/:token)": {
        "route": "/portal/quotations/:token",
        "access": "Zero-friction public magic link for external corporate clients (Tata, Infosys, Reliance, etc.).",
        "purpose": "Interactive client workspace for counter-discount requests, line-item review, real-time negotiation chat, and 1-click digital sign-off.",
    },
    "AI Deal Copilot (Alt + C)": {
        "route": "Slide-over drawer accessible from any page",
        "purpose": "Role-aware RAG enterprise copilot providing live deal intelligence, daily priorities, and feature guidance in native Indian currency.",
    },
}


def build_role_context(user) -> dict:
    """
    Constructs a comprehensive, database-backed RAG context payload tailored specifically
    to the requesting user's role, complete with Indian currency (INR / Lakhs / Crores) metrics,
    full product catalogs, customer directories, warehouse stock, and system tab knowledge.
    """
    role = getattr(user, 'role', 'sales_rep')
    now = timezone.now()
    today = timezone.localdate()

    context = {
        'user_info': {
            'name': user.get_full_name() or user.username,
            'role': role,
            'role_title': role.replace('_', ' ').title(),
            'currency': 'INR (Indian Rupee, ₹)',
            'current_time': now.strftime('%Y-%m-%d %H:%M:%S IST'),
            'current_date': str(today),
        },
        'system_tabs_and_features': SYSTEM_TABS_AND_FEATURES,
    }

    # Common Catalog Reference (Products & Warehouses)
    products = list(Product.objects.all().order_by('name'))
    context['product_catalog'] = [
        {
            'sku': p.sku,
            'name': p.name,
            'category': p.category,
            'base_price_inr': format_inr_display(p.base_price),
            'cost_price_inr': format_inr_display(p.cost_price),
            'is_subscription': p.is_subscription,
            'tax_pct': float(p.tax_pct),
        } for p in products
    ]

    warehouses = list(Warehouse.objects.all())
    stock_levels = list(StockLevel.objects.select_related('product', 'warehouse').all())
    context['warehouses'] = [
        {
            'id': w.id,
            'name': w.name,
            'location': w.location,
            'shipping_cost_weight': float(w.shipping_cost_weight),
        } for w in warehouses
    ]
    context['low_stock_alerts'] = [
        {
            'product': sl.product.name,
            'sku': sl.product.sku,
            'warehouse': sl.warehouse.name,
            'current_stock': sl.in_stock,
            'threshold': sl.reorder_point or 10,
            'status': 'CRITICAL LOW STOCK' if sl.in_stock <= 5 else 'BELOW REORDER POINT',
        } for sl in stock_levels if sl.in_stock < (sl.reorder_point or 10)
    ]

    # Customers Reference
    customers = list(Customer.objects.all().order_by('name'))
    context['customer_directory'] = [
        {
            'name': c.name,
            'email': c.email,
            'phone': c.phone,
            'company': c.company,
            'tier': c.tier,
            'address': str(c.address) if c.address else '',
        } for c in customers
    ]

    # 1. SALES REP SCOPE
    if role == 'sales_rep':
        my_quotes = list(scoped_quotes(user).select_related('customer', 'rep').prefetch_related('lines__product').order_by('-created_at'))

        drafts = [q for q in my_quotes if q.status == 'draft']
        pending_review = [q for q in my_quotes if q.status == 'pending_approval']
        approved_ready_to_send = [q for q in my_quotes if q.status == 'approved']
        in_negotiation = [q for q in my_quotes if q.status in ('sent', 'under_negotiation')]
        won_deals = [q for q in my_quotes if q.status in ('confirmed', 'fulfillment', 'invoiced', 'paid')]

        rep_quote_ids = [q.id for q in my_quotes]
        recent_messages = list(NegotiationMessage.objects.filter(
            quotation_id__in=rep_quote_ids, author_type='customer'
        ).select_related('quotation', 'quotation__customer').order_by('-created_at')[:8])

        total_pipeline_val = sum((q.total_amount for q in my_quotes if q.status not in ('rejected', 'cancelled')), Decimal(0))
        won_val = sum((q.total_amount for q in won_deals), Decimal(0))

        context['role_summary'] = {
            'scope_description': 'Personal Sales Portfolio (Rep Isolated Privacy)',
            'my_total_quotes': len(my_quotes),
            'my_total_quotes_count': len(my_quotes),
            'my_pipeline_value': float(total_pipeline_val),
            'my_pipeline_value_inr': format_inr_display(total_pipeline_val),
            'my_won_value': float(won_val),
            'my_won_bookings_inr': format_inr_display(won_val),
            'drafts_count': len(drafts),
            'pending_review_count': len(pending_review),
            'pending_approval_count': len(pending_review),
            'approved_ready_to_send_count': len(approved_ready_to_send),
            'approved_ready_to_dispatch_count': len(approved_ready_to_send),
            'in_negotiation_count': len(in_negotiation),
            'won_deals_count': len(won_deals),
        }

        context['my_quotations'] = [
            {
                'quote_id': q.id,
                'quote_number': q.quote_number,
                'customer': q.customer.name,
                'status': q.status,
                'status_label': q.get_status_display(),
                'net_amount_inr': format_inr_display(q.total_amount),
                'gross_amount_inr': format_inr_display(q.subtotal + q.tax_amount),
                'discount_pct': f"{q.blended_discount_percent}%",
                'margin_pct': f"{float(q.margin_pct):.1f}%",
                'payment_terms': q.payment_terms,
                'approval_level': q.required_approval_level,
                'manager_approved': q.manager_approved,
                'finance_approved': q.finance_approved,
                'created_date': str(q.created_at.date()),
                'items_count': q.lines.count(),
                'products': [line.product.name for line in q.lines.all()[:3]],
            } for q in my_quotes
        ]

        context['priorities'] = {
            'p0_critical_immediate_actions': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'value_inr': format_inr_display(q.total_amount),
                    'action': 'Approved by management! Dispatch immediately to customer via WhatsApp or Chrome Gmail using Quotation Dispatcher.',
                } for q in approved_ready_to_send
            ] + [
                {
                    'quote_number': m.quotation.quote_number,
                    'customer': m.quotation.customer.name,
                    'action': f'Customer counter-offer/message received: "{m.message}". Counter discount requested: {m.counter_discount_percent}%. Respond in Customer Portal.',
                } for m in recent_messages
            ],
            'p1_high_priority_drafts': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'value_inr': format_inr_display(q.total_amount),
                    'action': 'Draft quotation created. Finalize line items and submit for approval.',
                } for q in drafts
            ],
            'p2_negotiation_and_follow_ups': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'value_inr': format_inr_display(q.total_amount),
                    'status': q.get_status_display(),
                    'valid_until': str(q.valid_until) if q.valid_until else 'N/A',
                    'action': 'Quotation with customer. Follow up on portal review and closing.',
                } for q in in_negotiation
            ],
        }

    # 2. SALES MANAGER SCOPE
    elif role == 'sales_manager':
        all_quotes = list(Quotation.objects.select_related('customer', 'rep').prefetch_related('lines__product').order_by('-created_at'))
        pending_mgr = [q for q in all_quotes if q.status == 'pending_approval' and not q.manager_approved]
        high_risk = [q for q in all_quotes if float(q.blended_risk_score) >= 5.0 and q.status in ('draft', 'pending_approval', 'under_negotiation')]

        stalled_date = today - timezone.timedelta(days=14)
        stalled = [q for q in all_quotes if q.created_at.date() <= stalled_date and q.status in ('draft', 'sent', 'under_negotiation')]

        total_pipe = sum((q.total_amount for q in all_quotes if q.status not in ('rejected', 'cancelled')), Decimal(0))
        won_val = sum((q.total_amount for q in all_quotes if q.status in ('confirmed', 'fulfillment', 'invoiced', 'paid')), Decimal(0))

        context['role_summary'] = {
            'scope_description': 'Team Commercial Operations, Margins & Approval Desk',
            'team_total_pipeline_inr': format_inr_display(total_pipe),
            'team_won_bookings_inr': format_inr_display(won_val),
            'pending_manager_approvals_count': len(pending_mgr),
            'high_risk_deals_count': len(high_risk),
            'stalled_deals_count': len(stalled),
        }

        context['all_quotations'] = [
            {
                'quote_number': q.quote_number,
                'customer': q.customer.name,
                'sales_rep': q.rep.get_full_name() if q.rep else 'Unassigned',
                'status': q.status,
                'status_label': q.get_status_display(),
                'net_amount_inr': format_inr_display(q.total_amount),
                'discount_pct': f"{q.blended_discount_percent}%",
                'margin_pct': f"{float(q.margin_pct):.1f}%",
                'risk_score': float(q.blended_risk_score),
                'required_level': q.required_approval_level,
                'manager_approved': q.manager_approved,
                'created_date': str(q.created_at.date()),
            } for q in all_quotes
        ]

        context['priorities'] = {
            'p0_urgent_manager_approvals': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'sales_rep': q.rep.get_full_name() if q.rep else 'Unassigned',
                    'value_inr': format_inr_display(q.total_amount),
                    'discount_pct': f"{q.blended_discount_percent}%",
                    'margin_pct': f"{float(q.margin_pct):.1f}%",
                    'risk_score': float(q.blended_risk_score),
                    'action': f"Sign-off required on Approval Desk (/approvals/{q.id}). Blended discount: {q.blended_discount_percent}%.",
                } for q in pending_mgr
            ],
            'p1_margin_risk_alerts': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'sales_rep': q.rep.get_full_name() if q.rep else 'Unassigned',
                    'value_inr': format_inr_display(q.total_amount),
                    'risk_score': float(q.blended_risk_score),
                    'margin_pct': f"{float(q.margin_pct):.1f}%",
                    'action': "Discount ceiling exceeded or low margin. Review pricing structure.",
                } for q in high_risk
            ],
            'p2_stalled_deals_pipeline': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'sales_rep': q.rep.get_full_name() if q.rep else 'Unassigned',
                    'days_idle': (today - q.created_at.date()).days,
                    'value_inr': format_inr_display(q.total_amount),
                    'action': f"Deal idle for {(today - q.created_at.date()).days} days. Nudge sales rep to re-engage client.",
                } for q in stalled
            ],
        }

    # 3. FINANCE CONTROLLER SCOPE
    elif role == 'finance':
        all_quotes = list(Quotation.objects.select_related('customer', 'rep').order_by('-created_at'))
        pending_fin = [q for q in all_quotes if q.status == 'pending_approval' and q.required_approval_level == 'manager_finance' and not q.finance_approved]

        invoices = list(Invoice.objects.select_related('quotation__customer').order_by('-created_at'))
        unpaid_invoices = [inv for inv in invoices if inv.status in ('draft', 'sent', 'overdue')]
        overdue_invoices = [inv for inv in invoices if inv.status == 'overdue' or (inv.due_date and inv.due_date < today and inv.status != 'paid')]
        paid_invoices = [inv for inv in invoices if inv.status == 'paid']

        subscriptions = list(Subscription.objects.select_related('line__quotation__customer').order_by('-start_date'))

        total_receivables = sum((inv.amount for inv in unpaid_invoices), Decimal(0))
        total_overdue = sum((inv.amount for inv in overdue_invoices), Decimal(0))
        total_collected = sum((inv.amount for inv in paid_invoices), Decimal(0))

        context['role_summary'] = {
            'scope_description': 'Finance Controller, Invoicing, Receivables & Risk Sign-offs',
            'pending_finance_approvals_count': len(pending_fin),
            'unpaid_invoices_count': len(unpaid_invoices),
            'overdue_invoices_count': len(overdue_invoices),
            'total_outstanding_receivables_inr': format_inr_display(total_receivables),
            'total_overdue_receivables_inr': format_inr_display(total_overdue),
            'total_collected_cashflow_inr': format_inr_display(total_collected),
            'active_subscriptions_count': len(subscriptions),
        }

        context['invoices_ledger'] = [
            {
                'invoice_number': inv.invoice_number,
                'customer': inv.quotation.customer.name,
                'amount_inr': format_inr_display(inv.amount),
                'status': inv.status,
                'due_date': str(inv.due_date),
                'is_overdue': inv.due_date and inv.due_date < today and inv.status != 'paid',
                'quote_number': inv.quotation.quote_number,
            } for inv in invoices
        ]

        context['active_subscriptions'] = [
            {
                'customer': sub.line.quotation.customer.name if (sub.line and sub.line.quotation and sub.line.quotation.customer) else 'Enterprise Client',
                'product_plan': sub.plan,
                'quantity_seats': float(sub.quantity),
                'unit_price_inr': format_inr_display(sub.unit_price),
                'recurring_amount_inr': format_inr_display(sub.unit_price * sub.quantity),
                'next_billing_date': str(sub.next_billing_date),
                'status': sub.status,
            } for sub in subscriptions
        ]

        context['priorities'] = {
            'p0_finance_overage_approvals': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'value_inr': format_inr_display(q.total_amount),
                    'discount_pct': f"{q.blended_discount_percent}%",
                    'action': f"Tier-2 Finance sign-off required on Approval Desk (/approvals/{q.id}). High discount or credit overage.",
                } for q in pending_fin
            ],
            'p1_overdue_collections': [
                {
                    'invoice_number': inv.invoice_number,
                    'customer': inv.quotation.customer.name,
                    'amount_inr': format_inr_display(inv.amount),
                    'due_date': str(inv.due_date),
                    'action': 'Invoice overdue. Record payment settlement or trigger collection reminder.',
                } for inv in overdue_invoices
            ],
        }

    # 4. ADMIN SCOPE
    else:
        all_quotes = list(Quotation.objects.select_related('customer', 'rep').order_by('-created_at'))
        won = [q for q in all_quotes if q.status in ('confirmed', 'fulfillment', 'invoiced', 'paid')]
        pending = [q for q in all_quotes if q.status == 'pending_approval']
        invoices = list(Invoice.objects.select_related('quotation__customer').all())
        unpaid = [inv for inv in invoices if inv.status in ('draft', 'sent', 'overdue')]

        total_pipe = sum((q.total_amount for q in all_quotes if q.status not in ('rejected', 'cancelled')), Decimal(0))
        total_won = sum((q.total_amount for q in won), Decimal(0))
        total_rec = sum((inv.amount for inv in unpaid), Decimal(0))

        context['role_summary'] = {
            'scope_description': 'System Superuser & Operations Audit (Full Company Access)',
            'total_quotes_count': len(all_quotes),
            'total_pipeline_value_inr': format_inr_display(total_pipe),
            'total_won_bookings_inr': format_inr_display(total_won),
            'total_outstanding_receivables_inr': format_inr_display(total_rec),
            'global_pending_approvals_count': len(pending),
            'low_stock_alerts_count': len(context['low_stock_alerts']),
        }

        context['all_quotations'] = [
            {
                'quote_number': q.quote_number,
                'customer': q.customer.name,
                'sales_rep': q.rep.get_full_name() if q.rep else 'Unassigned',
                'status': q.status,
                'status_label': q.get_status_display(),
                'net_amount_inr': format_inr_display(q.total_amount),
                'discount_pct': f"{q.blended_discount_percent}%",
                'margin_pct': f"{float(q.margin_pct):.1f}%",
                'approval_level': q.required_approval_level,
                'created_date': str(q.created_at.date()),
            } for q in all_quotes
        ]

        context['priorities'] = {
            'p0_critical_company_bottlenecks': [
                {
                    'quote_number': q.quote_number,
                    'customer': q.customer.name,
                    'status': q.get_status_display(),
                    'value_inr': format_inr_display(q.total_amount),
                    'action': f"Approval queue item pending resolution (Required level: {q.required_approval_level}).",
                } for q in pending
            ],
            'p1_inventory_replenishment': [
                {
                    'product': item['product'],
                    'warehouse': item['warehouse'],
                    'stock': item['current_stock'],
                    'action': "Stock below minimum threshold. Initiate warehouse replenishment or reallocate.",
                } for item in context['low_stock_alerts']
            ],
        }

    return context


def format_workspace_markdown_context(ctx: dict) -> str:
    """
    Transforms the rich context dictionary into compact, token-efficient,
    high-density structured markdown for the LLM prompt.
    Avoids key repetition to preserve context tokens and prevent rate limit errors.
    """
    lines = []
    lines.append(f"USER CONTEXT: {ctx['user_info']['name']} | Role: {ctx['user_info']['role_title']} | Currency: INR (₹)")

    rs = ctx.get('role_summary', {})
    summary_parts = [f"{k}={v}" for k, v in rs.items() if not isinstance(v, (list, dict))]
    lines.append(f"FINANCIAL SUMMARY: {', '.join(summary_parts)}")

    lines.append("\n=== SYSTEM TABS & NAVIGATION FEATURES KNOWLEDGE BASE ===")
    for tab_name, data in ctx.get('system_tabs_and_features', {}).items():
        lines.append(f"• Tab: '{tab_name}' (Route: {data.get('route', 'N/A')})")
        lines.append(f"  Purpose: {data.get('purpose', '')}")
        if 'core_features' in data:
            for feat_title, feat_detail in data['core_features'].items():
                lines.append(f"  - Sub-Feature '{feat_title}': {feat_detail}")

    quotes = ctx.get('my_quotations', ctx.get('all_quotations', []))
    if quotes:
        lines.append(f"\n=== LIVE QUOTATIONS IN DATABASE ({len(quotes)} deals) ===")
        for q in quotes:
            rep_info = f" | Rep: {q.get('sales_rep')}" if 'sales_rep' in q else ""
            lines.append(
                f"• {q['quote_number']}: Customer='{q['customer']}'{rep_info} | Status={q.get('status_label', q.get('status'))} "
                f"| Net={q['net_amount_inr']} | Disc={q['discount_pct']} | Margin={q['margin_pct']} | Level={q.get('approval_level', q.get('required_level', 'auto'))}"
            )

    prods = ctx.get('product_catalog', [])
    if prods:
        lines.append(f"\n=== PRODUCT CATALOG ({len(prods)} products) ===")
        for p in prods:
            sub_tag = "OpEx Recurring Subscription" if p['is_subscription'] else "CapEx Hardware / Service"
            lines.append(f"• {p['name']} (SKU: {p['sku']}): Base Price={p['base_price_inr']} | Cat={p['category']} | Type={sub_tag} | Tax={p['tax_pct']}% GST")

    custs = ctx.get('customer_directory', [])
    if custs:
        lines.append(f"\n=== CUSTOMER DIRECTORY ({len(custs)} accounts) ===")
        for c in custs:
            lines.append(f"• {c['name']} (Tier: {c['tier'].title()}) | Email={c['email']} | Phone={c['phone']} | Co={c['company']}")

    whs = ctx.get('warehouses', [])
    if whs:
        lines.append(f"\n=== FULFILLMENT WAREHOUSES ({len(whs)} hubs) ===")
        for w in whs:
            lines.append(f"• Warehouse Hub: {w['name']} (Location: {w['location']})")

    alerts = ctx.get('low_stock_alerts', [])
    if alerts:
        lines.append("\n=== LOW STOCK ALERTS ===")
        for a in alerts:
            lines.append(f"• [LOW STOCK WARNING] {a['product']} at {a['warehouse']}: Stock={a['current_stock']} units (Threshold: {a['threshold']})")

    invs = ctx.get('invoices_ledger', [])
    if invs:
        lines.append(f"\n=== INVOICES & RECEIVABLES ({len(invs)} invoices) ===")
        for inv in invs[:10]:
            lines.append(f"• Invoice {inv['invoice_number']}: Customer='{inv['customer']}' | Amount={inv['amount_inr']} | Status={inv['status']} | Due={inv['due_date']}")

    subs = ctx.get('active_subscriptions', [])
    if subs:
        lines.append(f"\n=== ACTIVE RECURRING SUBSCRIPTIONS ({len(subs)} contracts) ===")
        for s in subs:
            lines.append(f"• Sub: Customer='{s['customer']}' | Plan='{s['product_plan']}' | Seats={s['quantity_seats']} | MRR={s['recurring_amount_inr']} | NextBill={s['next_billing_date']}")

    return "\n".join(lines)


def call_groq_api(messages: list) -> str:
    """Executes chat completion against Groq endpoint with automatic model fallback."""
    api_key = os.getenv('GROQ_API_KEY', '')
    if not api_key:
        try:
            from pathlib import Path
            from dotenv import load_dotenv
            load_dotenv(Path(__file__).resolve().parent.parent / '.env')
            api_key = os.getenv('GROQ_API_KEY', '')
        except Exception:
            pass
    configured_model = os.getenv('GROQ_MODEL', 'qwen/qwen3.8-27b')

    candidate_models = [
        configured_model,
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-120b',
        'qwen/qwen3.6-27b',
        'openai/gpt-oss-20b',
    ]
    seen = set()
    models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

    last_error = ""
    for model_name in models_to_try:
        payload = {
            'model': model_name,
            'messages': messages,
            'temperature': 0.2,
            'max_tokens': 1800,
        }

        req = urllib.request.Request(
            GROQ_API_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DealFlow360-Copilot/1.0',
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data['choices'][0]['message']['content'].strip()
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='ignore')
            last_error = f"HTTP {e.code}: {error_body[:180]}"
            continue
        except Exception as e:
            last_error = str(e)
            continue

    return f"AI Copilot service temporarily unavailable ({last_error})"


@api_view(['POST'])
@permission_classes([IsInternalUser])
def deal_copilot_chat(request):
    """
    Main AI Deal Copilot conversational RAG endpoint.
    Accepts user question, injects strictly role-scoped live data, enforces domain guardrails,
    provides complete system tab navigation guidance, and formats all financial figures in native Indian currency (INR / Lakhs / Crores).
    """
    user_query = request.data.get('message', '').strip()
    chat_history = request.data.get('history', [])

    if not user_query:
        return Response({'detail': 'Please provide a message or question.'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Build rich live role-scoped context
    role_context = build_role_context(request.user)
    role_name = getattr(request.user, 'role', 'sales_rep')
    workspace_text = format_workspace_markdown_context(role_context)

    # 2. System Prompt with strict Indian Currency, System Tab Knowledge, and Data Privacy guardrails
    system_prompt = f"""You are "DealFlow360 AI Deal Copilot", the master enterprise AI assistant for the DealFlow360 Quote-to-Cash operations workspace.
You are currently assisting: {request.user.get_full_name() or request.user.username} (Role: {role_name.replace('_', ' ').upper()}).

================================================================================
CRITICAL RULE 1: MANDATORY INDIAN CURRENCY TERMS & NUMBERING (INR / ₹)
================================================================================
- You MUST ALWAYS express ALL monetary values, deal amounts, prices, revenues, discounts, invoices, receivables, and quotas in INDIAN CURRENCY TERMS (INR / ₹) and the INDIAN NUMBERING SYSTEM.
- Format rules:
  • Values >= ₹1,00,00,000 (1 Crore): Format as "₹X.XX Crores" (e.g., "₹1.33 Crores (₹1,33,10,000)")
  • Values >= ₹1,00,000 (1 Lakh) and < ₹1 Crore: Format as "₹X.XX Lakhs" (e.g., "₹10.06 Lakhs (₹10,06,250)")
  • Values < ₹1,00,000: Format with Indian commas (e.g., "₹45,000" or "₹3,500")
- STRICTLY PROHIBITED: NEVER use US Dollars ($), Euros (€), Millions (M), or Billions (B). Any use of Western millions/billions is a violation.

================================================================================
CRITICAL RULE 2: SYSTEM TABS, PAGES & FEATURE EXPERTISE
================================================================================
You possess complete knowledge of all tabs, features, workflows, and buttons in DealFlow360:
1. Overview / Dashboard (/dashboard): Executive KPIs, pipeline value in Lakhs/Crores, won revenue, win rate %, conversion funnel.
2. Quotations & Pipeline (/quotations - Kanban, /quotations/list - List):
   - 12 Stages: Draft -> Pending Approval -> Approved -> Sent -> Under Negotiation -> Confirmed -> Fulfillment -> Invoiced -> Paid.
   - Quotation Builder (/quotations/new): CapEx hardware, OpEx recurring SaaS subscriptions, services, 18% GST tax, profit margin %, risk scores, auto approval tier routing.
   - Multi-Channel Dispatcher ('Dispatch' button): 1-click WhatsApp deep link (wa.me) and Google Chrome Gmail compose link with 3 enterprise templates.
   - Smart Bulk CSV Importer ('Bulk Import CSV' button): Pre-flight CSV validator against live products & customers, automatic subscription mapping, atomic commit.
   - Cryptographic Verification & Audit Portal (/verify/:quoteNumber): HMAC-SHA256 digital signature, anti-counterfeit QR code, Indian Rupee currency words conversion.
3. Approval Desk (/approvals and /approvals/:id): Dual-tier sign-off for Sales Managers (Tier 1) and Finance Controllers (Tier 2).
4. Fulfillment & Logistics (/fulfillment): Automated multi-warehouse split engine across Mumbai, Delhi NCR, and Bengaluru hubs ('Suggest Split', 'Accept Split', 'Override Split').
5. Inventory (/inventory): Live stock levels across warehouses, reorder thresholds (< 10 units).
6. Subscriptions (/subscriptions): Recurring SaaS subscriptions, billing schedules (Monthly/Quarterly/Annual), mid-term seat proration engine (/api/billing/<id>/prorate/).
7. Invoices & Payments (/invoices): Generated upon confirmation, status tracking, payment settlements (NEFT, RTGS, UPI, Bank Transfer with UTR numbers).
8. Deal Health (/deal-health): Stalled deals (>14 days), slippage forecasts, margin anomaly alerts.
9. Reports (/reports): Category revenue distribution in INR, sales rep performance leaderboard, discount variance.
10. Catalog & Rules (/config): Manage product catalog, discount tier policies, margin floors.
11. Customer Magic Portal (/portal/quotations/:token): Zero-friction public client workspace for counter-discounts, negotiation chat, and digital sign-off.
12. AI Deal Copilot (Alt + C): Slide-over drawer conversational assistant.

When a user asks how to do something or where a feature is, provide clear, step-by-step guidance referencing the exact Tab name, URL route, and button names.

================================================================================
CRITICAL RULE 3: DOMAIN BOUNDARY & ROLE-BASED DATA PRIVACY
================================================================================
- DOMAIN BOUNDARY: ONLY answer questions related to DealFlow360, sales deals, quotations, customers, products, approvals, fulfillment, billing, and operational priorities.
  If asked about unrelated topics (trivia, coding, recipes, weather), politely decline: "I am your DealFlow360 Deal Copilot. I can only assist with your sales deals, approvals, quotes, and dashboard operations."
- ROLE-BASED PRIVACY:
  • SALES REP: Can ONLY see their assigned quotations and customer negotiations. Do NOT disclose other sales reps' individual performance or company-wide gross profit margins.
  • SALES MANAGER: Focus on the manager approval queue, margin breach risks, stalled deals, and team pipeline.
  • FINANCE: Focus on Tier-2 overage sign-offs, overdue receivables, invoices, and cash-flow collections.
  • ADMIN: System-wide KPI rollups, stock integrity, global bottlenecks.

================================================================================
CRITICAL RULE 4: TODAY'S WORK & PRIORITY INQUIRIES
================================================================================
- When asked "what is today's work?", "status of today", or "which work in priority?", organize your response clearly into clean tiers:
  • **P0 — Critical / Immediate Action**
  • **P1 — High Priority Follow-ups**
  • **P2 — Routine Tracking**
- Always cite exact Quotation numbers (e.g. `IN-2026-1108` or `Q-E2E-453063`), Customer names, and exact amounts in Indian Currency (Lakhs/Crores).
- DO NOT use unicode emojis in your text. Keep all formatting professional, clean, and corporate.

LIVE WORKSPACE CONTEXT:
{workspace_text}
"""

    # 3. Assemble messages
    messages = [{'role': 'system', 'content': system_prompt}]

    # Append recent chat history (up to last 6 turns)
    if isinstance(chat_history, list):
        for msg in chat_history[-6:]:
            if isinstance(msg, dict) and msg.get('role') in ('user', 'assistant') and msg.get('content'):
                messages.append({'role': msg['role'], 'content': msg['content']})

    messages.append({'role': 'user', 'content': user_query})

    # 4. Call Groq API
    ai_response = call_groq_api(messages)

    # 5. Extract referenced quotation numbers for quick-action navigation pills in UI
    referenced_quotes = []
    # Find all quote numbers in ai_response using regex
    found_quote_numbers = set(re.findall(r'(?:IN-\d{4}-\d{4}|Q-[A-Za-z0-9-]+)', ai_response))
    all_q_candidates = role_context.get('my_quotations', role_context.get('all_quotations', []))
    for q in all_q_candidates:
        q_num = q.get('quote_number')
        if q_num and q_num in found_quote_numbers:
            if q_num not in [r['quote_number'] for r in referenced_quotes]:
                referenced_quotes.append({
                    'id': q.get('quote_id'),
                    'quote_number': q_num,
                    'customer': q.get('customer'),
                })

    priorities = role_context.get('priorities', {})
    urgent_count = len(priorities.get('p0_critical_immediate_actions',
                       priorities.get('p0_urgent_manager_approvals',
                       priorities.get('p0_finance_overage_approvals',
                       priorities.get('p0_critical_company_bottlenecks', [])))))
    high_count = len(priorities.get('p1_high_priority_drafts',
                     priorities.get('p1_margin_risk_alerts',
                     priorities.get('p1_overdue_collections',
                     priorities.get('p1_inventory_replenishment', [])))))

    return Response({
        'reply': ai_response,
        'role': role_name,
        'role_title': role_name.replace('_', ' ').title(),
        'referenced_quotes': referenced_quotes,
        'priorities_summary': {
            'urgent_count': urgent_count,
            'high_count': high_count,
        },
        'timestamp': timezone.now().isoformat(),
    })
