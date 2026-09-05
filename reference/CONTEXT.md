# DealFlow360 — Condensed Project Context (AI Handoff Optimized)

> **Purpose**: Give this file to any AI to instantly understand the project. Minimal tokens, maximum signal.

## What Is This?
Enterprise "self-governing deal engine" for an Odoo-style hackathon. 18 hours, team of 3. Judges are Odoo developers.

## Core Value Props
1. Quotation → auto-routes for approval based on discount + customer tier
2. Live upsell/cross-sell with real-time margin impact
3. Auto warehouse split based on stock
4. Mixed one-time + recurring subscription billing with proration
5. Real-time deal health dashboard
6. Customer portal for live quotation negotiation

## Tech Stack (LOCKED)
- **Backend**: Python 3.11+ / Django 5 / DRF / PostgreSQL 15+
- **Auth**: simplejwt (internal) + magic-link (portal)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query + Recharts
- **No WebSockets** — synchronous API calls only
- **DB**: Postgres via docker-compose

## Team Split (Django app boundaries = ownership boundaries)
| Person | Django Apps | Frontend Features | Key Responsibilities |
|--------|-----------|-------------------|---------------------|
| A | `quotations` | `quotation-builder/`, `approval/` | Quotation CRUD, blended risk score, approval state machine |
| B | `fulfillment`, `billing` | `fulfillment/`, `billing/`, `upsell-panel/` | Warehouse split, subscription proration, upsell engine |
| C | `portal`, `core` | `shell/`, `pipeline/`, `portal-negotiation/`, `dashboard/` | Auth, app shell, customer portal, deal health dashboard |

## Data Model (Core Entities)
```
User (core) ←→ Role
Customer (core) — name, tier(Bronze/Silver/Gold), email, company
Product (core) — name, sku, category(Hardware/Services/Warranty/Subscription), base_price, unit, tax_rate
PriceList (core) — name, tier, rules[]

DiscountTier (quotations) — name, max_discount_percent
CategoryDiscountCeiling (quotations) — category × tier → max_discount_percent
ApprovalChain (quotations) — overage_range → requires_finance?
Quotation (quotations) — customer, rep, status(Draft→PendingApproval→Approved→Rejected→Confirmed→UnderNegotiation), blended_risk_score, required_approval_level
QuotationLine (quotations) — quotation, product, qty, unit_price, discount_percent, line_total
ApprovalLog (quotations) — quotation, approver, action, reason, timestamp

Warehouse (fulfillment) — name, location
StockLevel (fulfillment) — warehouse × product → quantity, reorder_point
FulfillmentSplit (fulfillment) — quotation, warehouse, product, qty_fulfilled

SubscriptionPlan (billing) — name, interval, price
BillingSchedule (billing) — subscription, next_billing, amount
UpsellRule (billing) — source_product, target_product, margin_threshold, promotion_tag
```

## Key Algorithm: Blended Risk Score
```
for each line in quotation:
    ceiling = CategoryDiscountCeiling[line.product.category, customer.tier]
              ?? DiscountTier[customer.tier].max_discount_percent
    overage = max(0, line.discount_percent - ceiling)
    if overage > 0: has_breach = True
    weighted_overage += overage * line.line_total

blended_risk_score = weighted_overage / total_order_value
if has_breach OR blended_risk_score > threshold:
    route to approval (Manager, +Finance if above finance threshold)
```

## Approval State Machine
```
Draft → [submit] → PendingApproval → [approve] → Approved → [confirm] → Confirmed
                  → [reject] → Rejected
                  → [return] → Draft
Confirmed → [customer_negotiates] → UnderNegotiation → [re-submit] → PendingApproval
```

## API Contracts (Shared)
```
GET  /api/quotations/{id}/upsell-suggestions/  — Person B builds, Person A's UI calls
POST /api/quotations/                          — Person A
POST /api/quotations/{id}/lines/               — Person A
PATCH /api/quotations/{id}/lines/{line_id}/    — Person A
POST /api/quotations/{id}/submit/              — Person A (computes risk score)
POST /api/quotations/{id}/approve/             — Person A
POST /api/quotations/{id}/reject/              — Person A
POST /api/quotations/{id}/return/              — Person A
GET  /api/quotations/{id}/risk-score/          — Person A

POST /api/fulfillment/{quotation_id}/suggest-split/  — Person B
POST /api/fulfillment/{quotation_id}/accept-split/   — Person B
POST /api/billing/subscriptions/                      — Person B
GET  /api/billing/schedule/{subscription_id}/         — Person B

POST /api/portal/negotiate/{quotation_id}/            — Person C
GET  /api/portal/quotation/{token}/                   — Person C
GET  /api/dashboard/deal-health/                      — Person C
POST /api/auth/login/                                 — Person C
POST /api/auth/refresh/                               — Person C
```

## User Roles
- **Sales Rep** — builds quotes, applies discounts, tracks approvals
- **Sales Manager** — reviews/approves quotes, configures tiers
- **Finance/Ops** — second-level approvals, manages fulfillment
- **Customer (Portal)** — views quote, negotiates, confirms
- **Admin** — backend config (products, prices, tiers, warehouses)

## Quick Test Flow (Demo Script)
1. Login → setup discount tier + warehouse + subscription plan
2. Create quote → add product with over-threshold discount
3. Verify auto-routing to manager approval
4. Accept upsell → verify immediate total/margin update
5. Approve → verify warehouse stock split
6. Verify one-time + recurring billed correctly
7. Customer portal → request bigger discount → auto re-approval
8. Confirm → record payment → verify invoice update

## Design System
- Dark slate shell (#0F172A), enterprise blue primary (#2563EB)
- Inter font for UI, JetBrains Mono for numbers/money
- Data-dense tables (36px rows), 1px borders, subtle shadows
- Status chips: Emerald=approved, Amber=pending, Rose=high-risk, Indigo=active
