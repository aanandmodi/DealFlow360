# DealFlow360 — Master Project Context (AI Handoff Optimized)

> **Purpose**: Give this file to any AI to instantly understand the complete DealFlow360 project, architecture, active code state, database schema, API contracts, and resolved edge cases with minimal token usage.

---

## 1. Project Overview
- **Name**: DealFlow360 — Self-Governing Enterprise Revenue Operations & CPQ Engine
- **Hackathon Context**: 18-hour sprint, team of 3. Evaluated on real-time business logic, policy enforcement, UX responsiveness, and end-to-end flow.
- **Repository Root**: `d:\Projects\DealFlow360\DealFlow360`
- **Git Remote**: `https://github.com/aanandmodi/DealFlow360.git` (`main` branch)
- **Primary Contributor / Author**: `aanandmodi` (`aanandmodi09@gmail.com`)

---

## 2. Tech Stack (LOCKED & IMPLEMENTED)
- **Backend**: Python 3.11+ / Django 5.x / Django REST Framework
- **Database**: SQLite (dev fallback, fully seeded) / PostgreSQL 15+ (docker-compose ready)
- **Auth**: SimpleJWT (Bearer token for internal users) + Tokenized Magic Link (for customer portal)
- **Frontend**: React 18 / TypeScript / Vite / Tailwind CSS / Lucide React / TanStack Query
- **Architecture Principle**: Synchronous REST APIs only (no WebSockets). Fast, predictable polling and query invalidation.

---

## 3. Team Responsibilities & Current Completion Status

| Role | Contributor | Django Apps | Frontend Routes / Features | Status |
|---|---|---|---|---|
| **Person A** | `aanandmodi` (You) | `quotations` | `/quotations/new`, `/quotations/:id`, `/approvals`, `/approvals/:id` | **100% COMPLETE** |
| **Person B** | Abhishek-Ag-1112 | `fulfillment`, `billing` | `/fulfillment`, `/subscriptions`, `/invoices`, `<UpsellPanel>` | **100% COMPLETE** |
| **Person C** | Programmer-NITIN | `portal`, `core` | `/dashboard`, `/quotations` (Kanban), `/deal-health`, `/portal/quotations/:token` | **100% COMPLETE** |
| **Integration** | `aanandmodi` | All 5 apps | Dual-compatible models, clean migrations, Windows seed fix, unified API client | **100% COMPLETE** |

---

## 4. Entity-Relationship & Unified Data Models

All models are harmonized with **dual-compatible properties and aliases** to prevent breakage across any person's frontend or backend conventions.

### A. `core` App (`backend/core/models.py`)
- **`User`**: Custom user inheriting `AbstractUser`.
  - Fields: `role` (`admin`, `sales_manager`, `finance`, `sales_rep`, `customer`), `phone`, `avatar_url`.
  - Auth: JWT token generation on `/api/auth/login/` and `/api/auth/refresh/`.

### B. `quotations` App (`backend/quotations/models.py`)
- **`Customer`**:
  - Fields: `name`, `company`, `email`, `phone`, `address`, `tier` (`bronze`, `silver`, `gold`), `user` (FK to User, optional).
- **`Product`**:
  - Fields: `name`, `sku`, `category` (`hardware`, `services`, `software`, `subscriptions`), `base_price`, `unit`, `tax_pct`, `is_subscription`, `is_active`, `description`.
  - Related: `variants` (`ProductVariant` with attributes e.g. RAM, Storage).
- **`PriceList` & `PriceListItem`**: Customer tier-specific base price overrides (e.g. Gold gets 5% discount).
- **`DiscountTier`**:
  - Ceilings per `tier` and `category` via `max_discount_pct`.
  - Dual compatibility: Aliased property `max_discount_percent`.
- **`ApprovalChainRule` (aliased as `ApprovalChain`)**:
  - Threshold ranges (`min_over_pct`, `max_over_pct`), `requires_manager` (bool), `requires_finance` (bool).
- **`Quotation`**:
  - Fields: `quote_number`, `customer` (FK), `rep` (FK), `status` (`draft`, `pending_approval`, `approved`, `rejected`, `confirmed`, `sent`, `under_negotiation`), `blended_risk_score`, `manager_approved`, `finance_approved`, `payment_terms`, `portal_token`, `notes`, `valid_until`.
  - Dual Compatibility Properties:
    - `sales_rep` $\leftrightarrow$ `rep`
    - `total_amount` $\leftrightarrow$ `total`
    - `gross_total`, `subtotal`, `tax_amount`, `total_discount`, `margin_pct`
    - `approval_level_display`, `status_display`
- **`QuotationLine`**:
  - Fields: `quotation` (FK), `product` (FK), `qty`, `unit_price`, `discount_pct`, `line_limit_pct`, `is_subscription`, `description`.
  - Dual Compatibility Properties:
    - `quantity` $\leftrightarrow$ `qty`
    - `discount_percent` $\leftrightarrow$ `discount_pct`
    - `net_price`, `gross_total`, `discount_amount`, `line_total`, `tax_amount`, `category_name`
- **`ApprovalLog`**:
  - Audit trail of actions (`submitted`, `approved`, `rejected`, `returned`), `actor` (FK), `role_required`, `note`.

### C. `fulfillment` App (`backend/fulfillment/models.py`)
- **`Warehouse`**: `name`, `location`, `shipping_cost_weight`.
- **`StockLevel`**: `warehouse` (FK), `product` (FK), `in_stock`, `reserved`, `available` (property).
- **`FulfillmentSplit`**: `quotation` (FK), `warehouse` (FK), `product` (FK), `qty`, `status` (`suggested`, `accepted`, `overridden`), `promised_ship_date`, `estimated_cost`.

### D. `billing` App (`backend/billing/models.py`)
- **`SubscriptionPlan`**: `name`, `product` (FK), `cycle` (`monthly`, `quarterly`, `yearly`), `price`, `active`.
- **`Invoice`**: `quotation` (FK), `invoice_number`, `type` (`one_time`, `recurring`), `amount`, `status` (`draft`, `sent`, `paid`, `overdue`), `due_date`.
- **`Payment`**: `invoice` (FK), `amount`, `method` (`credit_card`, `bank_transfer`, `ach`), `reference`, `paid_at`.
- **`UpsellRule`**: `product` (FK), `suggested_product` (FK), `min_margin_pct`, `is_promoted`.

### E. `portal` App (`backend/portal/models.py`)
- **`NegotiationMessage`**: `quotation` (FK), `author_type` (`rep`, `customer`), `author_name`, `message`, `counter_discount_percent`, `line_ref` (FK to line, optional).
- **`PortalToken`**: `token`, `email`, `quotation` (FK), `expires_at`, `used`.

---

## 5. Core Algorithms & Business Logic

### A. Blended Discount Risk Score Engine (`backend/quotations/services/risk_score.py`)
```python
total_weighted_overage = 0
total_order_value = 0
worst_line_over = 0
has_any_breach = False

for line in quotation.lines:
    ceiling = DiscountTier[customer.tier, product.category].max_discount_pct ?? 5.0%
    overage = max(0, line.discount_percent - ceiling)
    line_val = line.quantity * line.unit_price
    
    if overage > 0:
        has_any_breach = True
        worst_line_over = max(worst_line_over, overage)
        total_weighted_overage += overage * (line_val / 100)
    total_order_value += line_val

# Blended score balances volume-weighted excess with maximum single line breach
blended_risk_score = ((total_weighted_overage / total_order_value * 100) + worst_line_over) / 2

# Routing Rules
if blended_risk_score == 0 and not has_any_breach:
    auto_approve -> 'approved'
elif blended_risk_score <= 10.0:
    requires 'sales_manager'
else:
    requires 'sales_manager' + 'finance'
```

### B. Multi-Warehouse Auto-Split Allocation (`backend/fulfillment/views.py`)
- Iterates over quotation hardware lines against available warehouse inventory (`in_stock - reserved`).
- Evaluates warehouse proximity and `shipping_cost_weight`.
- Prioritizes single-shipment complete fulfillment; if unavailable, splits across warehouses with minimal cost.
- Flags remaining balance as `is_backorder: true` and calculates consolidated backorder fulfillment dates.

### C. Hybrid Billing & Proration Calculation (`backend/billing/views.py`)
- Splits quotation items into **One-Time CapEx** (hardware + installation services) and **Recurring OpEx** (subscriptions/licenses).
- Calculates exact daily prorated charges on mid-cycle subscription tier upgrades or seat changes:
  $$\text{Proration Charge} = \frac{\Delta \text{Price}}{\text{Days in Month}} \times \text{Days Remaining}$$

---

## 6. Complete API Surface (Verified Active)

### Authentication & Portal
- `POST /api/auth/login/` — SimpleJWT authentication (returns `user`, `tokens.access`, `tokens.refresh`)
- `GET  /api/auth/me/` — Current logged-in user profile
- `POST /api/auth/portal/request-magic-link/` — Requests customer portal magic link
- `POST /api/auth/portal/verify/` — Validates magic link token

### Quotations & Approvals (Person A)
- `GET  /api/quotations/` — List quotations (dual format: returns raw array or `{ count, results }`)
- `POST /api/quotations/create/` or `POST /api/quotations/` — Create new quotation
- `GET  /api/quotations/<pk>/` — Quotation detail with lines and logs
- `POST /api/quotations/<pk>/lines/` — Add line item
- `DELETE /api/quotations/<pk>/lines/<line_id>/` — Delete line item
- `POST /api/quotations/<pk>/submit/` — Trigger blended risk scoring and submit for approval
- `POST /api/quotations/<pk>/approve/` — Approve quotation (Manager / Finance)
- `POST /api/quotations/<pk>/reject/` — Reject quotation with reason
- `POST /api/quotations/<pk>/return/` — Return quotation to draft with feedback
- `POST /api/quotations/<pk>/confirm/` — Confirm approved quotation for fulfillment
- `GET  /api/quotations/<pk>/risk-score/` — Breakdown of risk score, per-line ceilings, and overage
- `GET  /api/quotations/<pk>/logs/` — Full audit trail of quotation actions
- `GET  /api/quotations/discount-tiers/` — Discount tier ceilings catalog
- `GET  /api/quotations/pipeline-summary/` — Pipeline metrics for KPI cards
- `GET  /api/customers/` — Customers catalog
- `GET  /api/products/` — Products catalog with variants and active status

### Fulfillment & Inventory (Person B)
- `POST /api/fulfillment/<quotation_id>/suggest-split/` — Greedy multi-warehouse split suggestion
- `POST /api/fulfillment/<quotation_id>/accept-split/` — Lock and commit warehouse allocation
- `POST /api/fulfillment/<quotation_id>/override-split/` — Manual logistics override

### Billing & Subscriptions (Person B)
- `GET  /api/billing/<quotation_id>/schedule/` — Split schedule into one-time vs recurring invoices
- `POST /api/billing/<line_id>/prorate/` — Mid-cycle upgrade proration calculator
- `POST /api/billing/<line_id>/cancel/` — Cancel subscription line with credit note
- `GET  /api/quotations/<quotation_id>/upsell-suggestions/` — High-margin cross-sell rules

### Customer Portal Negotiation (Person C)
- `GET  /api/portal/quotations/<token>/` — Public tokenized magic-link quotation inspection
- `POST /api/portal/quotations/<pk>/comment/` — Post line-item negotiation comment
- `POST /api/portal/quotations/<pk>/counter-discount/` — Submit counter-offer discount %
- `POST /api/portal/quotations/<pk>/confirm/` — Customer formal digital acceptance

### Deal Health & Executive Analytics (Person C)
- `GET  /api/dashboard/summary/` — High-level revenue operations metrics
- `GET  /api/dashboard/stalled-deals/` — Deals idle >14 days without customer activity
- `GET  /api/dashboard/anomalies/` — Unusually high discounts or margin erosion outliers
- `GET  /api/dashboard/slippage/` — Fulfillment depot delivery delay forecasts

---

## 7. Key Bug Fixes & Architectural Gotchas

1. **Dual Response Unwrapping (`frontend/src/api/quotations.ts`)**:
   - DRF endpoints return direct arrays for Kanban/Dashboard speed.
   - All frontend API clients (`quotationsApi.list`, `fetchQuotations`, `fetchProducts`, `fetchCustomers`) inspect the response:
     `Array.isArray(res) ? res : (res?.results || [])`.
2. **Safe Decimal Parsing in React**:
   - DRF outputs Decimals as strings. Always wrap with `Number(val || 0)` before executing `.toFixed()`.
3. **Cross-app Seed Script**:
   - `backend/core/management/commands/seed_data.py` is the single source of truth for demo data.
   - Contains 100% ASCII text to prevent Windows PowerShell character encoding errors.
4. **Embedded Upsell Component**:
   - Person B's `<UpsellPanel>` is embedded inside Person A's `QuotationBuilderPage.tsx` lines 530–542.
   - Wired to lookup `prod.base_price` and dispatch `addLineMutation.mutate(...)`.

---

## 8. Demo Accounts & Execution

### Dev Servers
```powershell
# Backend (Django)
cd d:\Projects\DealFlow360\DealFlow360\backend
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000

# Frontend (Vite)
cd d:\Projects\DealFlow360\DealFlow360\frontend
npm run dev
```

### Pre-Seeded Demo Credentials
| Role | Username | Password | Notes |
|---|---|---|---|
| **System Admin** | `admin` | `admin123` | Full superuser access |
| **Sales Manager** | `elena.vance` | `pass123` | Reviews & approves high-risk deals |
| **Finance Officer** | `michael.shah` | `pass123` | Second-tier signoff for high risk |
| **Sales Rep** | `marcus.ross` | `pass123` | Creates quotes, triggers CPQ engine |
| **Customer Portal** | *No password required* | Magic Token URL: `http://localhost:5173/portal/quotations/27dd27b7-13df-4864-b8f1-6db82ee9bef0` |
