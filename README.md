# DealFlow360

**Quote-to-Cash Deal Engine for Enterprise Sales Operations**

Django 5.2 · React 19 · TypeScript 6 · PostgreSQL · Vite 8

---

## What It Does

DealFlow360 manages the full lifecycle of enterprise sales quotations:

1. **Configure** — sales reps build quotations selecting products, variants, discounts, and recurring subscription plans from a tier-based catalog priced in INR.
2. **Price** — a blended discount risk score algorithm detects per-line ceiling breaches and weighted margin erosion across mixed categories.
3. **Approve** — configurable approval chains auto-route deals: low-risk deals approve instantly, medium-risk require Sales Manager review, high-risk require Manager + Finance.
4. **Negotiate** — customers receive a secure magic-link portal to review terms, leave comments, and counter-propose discounts. Counter-offers that breach ceilings auto-trigger re-approval.
5. **Fulfill** — a cost-weighted multi-warehouse splitter allocates inventory, creates backorders for shortages, and tracks shipment through delivery.
6. **Bill** — hybrid invoicing generates one-time invoices for hardware and recurring invoices for subscriptions with proration, cancellation credits, and anchored calendar renewals.
7. **Pay** — idempotent payment recording with duplicate reference protection and concurrent-safe settlement.

---

## Architecture

```
DealFlow360/
├── backend/                      Django 5.2 + DRF + PostgreSQL
│   ├── core/                     User model (5 roles), RBAC, configuration API, reporting, intelligence
│   ├── quotations/               Quotation, lines, products, variants, price lists, discount tiers, approval chains
│   ├── fulfillment/              Warehouses, stock levels, split allocation, backorders, stock receipts
│   ├── billing/                  Subscription plans, invoices, payments, proration, credit notes, upsell rules
│   └── portal/                   Portal tokens, negotiation messages, customer portal auth
├── frontend/                     React 19 + Vite 8 + TypeScript + Tailwind v4
│   └── src/features/             shell, pipeline, quotation-builder, approval, fulfillment, billing,
│                                 dashboard, reports, config, portal-negotiation, workspace
├── docker-compose.yml            PostgreSQL 18 (local development)
└── .env.example                  Environment variable template
```

### Django Apps

| App | Purpose | Key Models |
|---|---|---|
| `core` | Auth, RBAC, config CRUD, reporting, deal intelligence | `User`, `ConfigurationAudit` |
| `quotations` | Deal engine, pricing, approvals | `Customer`, `Product`, `ProductVariant`, `PriceList`, `PriceListItem`, `DiscountTier`, `ApprovalChainRule`, `Quotation`, `QuotationLine`, `ApprovalLog` |
| `fulfillment` | Warehouse management, stock, shipping | `Warehouse`, `StockLevel`, `FulfillmentSplit`, `StockReceipt` |
| `billing` | Subscriptions, invoices, payments | `SubscriptionPlan`, `Subscription`, `Invoice`, `Payment`, `CreditNote`, `SubscriptionCharge`, `UpsellRule` |
| `portal` | Customer-facing negotiation portal | `PortalToken`, `NegotiationMessage` |

### User Roles

| Role | Access |
|---|---|
| `admin` | Full access: configuration, user management, all deals |
| `sales_manager` | All deals, approvals (level 1), discount/approval rule config |
| `finance` | All deals, approvals (level 2), payment recording |
| `sales_rep` | Own deals only, create/edit/submit quotations |
| `customer` | Portal-only access via magic link tokens |

---

## Quick Start

### 1. Start PostgreSQL

```bash
# Copy environment template and fill in your values
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, DJANGO_SECRET_KEY, DEMO_PASSWORD

# Start database
docker compose up -d
```

### 2. Backend

```powershell
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1       # Windows
# source venv/bin/activate        # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Apply migrations
python manage.py migrate

# Seed demonstration data (requires DEMO_PASSWORD env var, min 12 chars)
python manage.py seed_data

# Run development server
python manage.py runserver
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and log in with one of the seeded accounts using the password you set in `DEMO_PASSWORD`.

| Username | Role | Access |
|---|---|---|
| `aarav.sharma` | Sales Rep | Own deals, quotation builder |
| `meera.shah` | Sales Manager | All deals, level-1 approvals |
| `riya.iyer` | Finance | All deals, level-2 approvals, payments |
| `aanand.admin` | Admin | Full access, configuration |

> **Security note**: The seed command only runs when `DJANGO_DEBUG=True` and requires a `DEMO_PASSWORD` environment variable of at least 12 characters. Demo accounts use this password; they are never created with published default credentials.

---

## Five-Minute Demo Walkthrough

1. **Login** as `aarav.sharma` (Sales Rep) → land on Dashboard
2. **Create Quote** → select a Gold-tier customer → add "BusinessBook Pro 14" (hardware, ₹84,900) with 22% discount
3. **Observe risk warning** → discount exceeds the 15% Gold/hardware ceiling → blended risk score rises
4. **Add subscription** → "CloudSuite Business / seat" auto-selects the monthly plan
5. **Submit for approval** → status changes to "Pending Approval"
6. **Switch to `meera.shah`** (Sales Manager) → go to Approvals → review risk breakdown → Approve
7. **Switch to `riya.iyer`** (Finance) → Approve level 2 → quote becomes "Approved"
8. **Generate portal link** → copy the magic-link URL → open in an incognito tab
9. **Customer portal** → review line items → leave a comment → counter-propose 25% discount
10. **Re-approval triggers** → manager and finance re-approve the negotiated terms
11. **Customer confirms** → invoices created (one-time hardware + recurring subscription)
12. **Fulfillment** → accept the auto-split → stock reserved across warehouses, backorder created for shortage
13. **Payment** → record payments against each invoice → quotation moves to "Paid"
14. **Reports** → export CSV/XLSX/PDF of deal performance

---

## API Overview

### Authentication (`/api/auth/`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login/` | JWT token pair (throttled) |
| `POST` | `/api/auth/register/` | Request account (inactive until admin activates) |
| `POST` | `/api/auth/logout/` | Blacklist refresh token |
| `GET` | `/api/auth/me/` | Current user profile |
| `GET` | `/api/auth/users/` | List users (admin/manager/finance) |

### Quotations (`/api/quotations/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/quotations/` | List (scoped by role) / Create draft |
| `GET/PATCH/DELETE` | `/api/quotations/{id}/` | Detail / Update header / Delete draft |
| `GET/POST` | `/api/quotations/{id}/lines/` | List / Add line item |
| `PATCH/DELETE` | `/api/quotations/{id}/lines/{line_id}/` | Update / Remove line |
| `POST` | `/api/quotations/{id}/submit/` | Submit with risk scoring |
| `POST` | `/api/quotations/{id}/approve/` | Advance approval chain |
| `POST` | `/api/quotations/{id}/reject/` | Reject with reason |
| `POST` | `/api/quotations/{id}/return/` | Return to draft for revision |
| `POST` | `/api/quotations/{id}/confirm/` | Confirm and create invoices |
| `GET` | `/api/quotations/{id}/risk-score/` | Risk score breakdown |
| `GET` | `/api/quotations/{id}/logs/` | Approval audit trail |
| `POST` | `/api/quotations/{id}/order-discount/` | Apply uniform discount |
| `GET` | `/api/quotations/pipeline-summary/` | Pipeline KPI aggregates |

### Intelligence (`/api/quotations/{id}/...`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/quotations/{id}/scenarios/` | Pricing scenario comparison (read-only) |
| `GET` | `/api/quotations/{id}/readiness/` | Deal readiness checks |
| `GET/POST` | `/api/quotations/{id}/conversation/` | Internal deal conversation |

### Fulfillment (`/api/fulfillment/`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/fulfillment/{id}/suggest-split/` | Preview warehouse allocation |
| `POST` | `/api/fulfillment/{id}/accept-split/` | Commit split and reserve stock |
| `POST` | `/api/fulfillment/{id}/override-split/` | Manual allocation with validation |
| `POST` | `/api/fulfillment/{id}/consolidate/` | Fill backorders from new stock |
| `POST` | `/api/fulfillment/{id}/shipments/{split_id}/` | Ship / deliver split |

### Billing (`/api/billing/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/billing/{quote_id}/schedule/` | Billing schedule (one-time + recurring) |
| `POST` | `/api/billing/{line_id}/prorate/` | Mid-cycle quantity change with proration |
| `POST` | `/api/billing/{line_id}/cancel/` | Cancel subscription with credit note |
| `GET` | `/api/billing/{line_id}/renew/` | Trigger subscription renewal |
| `GET` | `/api/quotations/{id}/upsell-suggestions/` | Upsell recommendations |

### Invoices & Payments (`/api/invoices/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoices/` | List all invoices |
| `GET` | `/api/invoices/{id}/` | Invoice detail with balance |
| `POST` | `/api/invoices/{id}/payments/` | Record payment (idempotent) |

### Inventory (`/api/inventory/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/inventory/readiness/` | Replenishment recommendations |
| `POST` | `/api/inventory/{stock_id}/receive/` | Record stock receipt (duplicate-safe) |

### Portal (`/api/portal/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/portal/quotations/{token}/` | View quote via magic link |
| `POST` | `/api/portal/quotations/{id}/comment/` | Customer comment |
| `POST` | `/api/portal/quotations/{id}/counter-discount/` | Counter-propose discount |
| `POST` | `/api/portal/quotations/{id}/confirm/` | Customer accept |
| `POST` | `/api/auth/portal/request-magic-link/` | Generate portal token |

### Configuration (`/api/config/{resource}/`)

CRUD for: `products`, `variants`, `customers`, `discounts`, `approvals`, `warehouses`, `stock`, `plans`, `price-lists`, `prices`, `upsell`, `users`

### Reports (`/api/reports/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports/` | Filtered report data (JSON) |
| `GET` | `/api/reports/?export=csv` | CSV export (formula-protected) |
| `GET` | `/api/reports/?export=xlsx` | Excel export (styled) |
| `GET` | `/api/reports/?export=pdf` | PDF report (landscape A4) |
| `GET` | `/api/quotations/{id}/pdf/` | Individual quotation PDF |

---

## Testing

```bash
cd backend
python manage.py test core -v 2 --no-input
```

### Test Coverage (28 tests)

| Test | What It Verifies |
|---|---|
| `test_complete_negotiation_to_cash` | Full lifecycle: submit → approve → portal counter → re-approve → confirm → fulfill → pay |
| `test_rep_cannot_escalate_or_read_other_deals` | Sales rep isolation (IDOR prevention) |
| `test_public_portal_cannot_enumerate_or_mutate` | Unauthenticated portal access blocked |
| `test_token_scope_expiry_and_private_fields` | Token scoping, expiry, cost_price hidden from customer |
| `test_invalid_inputs_and_immutable_approved_terms` | Input validation, approved quotes are immutable |
| `test_signup_never_grants_admin` | Registration cannot escalate to admin role |
| `test_subscription_changes_persist` | Proration, cancellation with credit notes |
| `test_calendar_boundaries` | Feb 29 → Feb 28, Jan 31 → Feb 28 handling |
| `test_configuration_validation` | Config API rejects negative prices, unauthorized access |
| `test_price_tax_and_cost_snapshots` | Line-level snapshots survive catalog changes |
| `test_backend_sets_catalog_prices_and_variant_validation` | Server-side pricing, variant cross-product blocked |
| `test_manual_override_and_rollback` | Manual split with atomic rollback on over-allocation |
| `test_backorder_consolidation_and_dispatch` | Backorder fill, ship, deliver transitions |
| `test_exports_and_csv_formula_protection` | CSV formula injection protection, XLSX/PDF generation |
| `test_renewals_are_idempotent_and_calendar_anchored` | Renewal idempotency, anchor-day calendar math |
| `test_cancellation_credit_reconciles_proration_invoices` | Credits zero out recurring invoice balances |
| `test_customer_account_cannot_enter_internal_workspace` | Customer role blocked from internal APIs |
| `test_invoice_payment_requires_finance_and_rejects_overpayment` | Finance-only payments, overpayment rejection |
| `test_scenarios_match_live_risk_without_changing_terms` | Read-only scenario comparison |
| `test_readiness_and_idempotent_inventory_receipts` | Deal readiness checks, idempotent stock receipts |
| `test_admin_creation_and_configuration_audit` | Superuser defaults to admin, audit trail on config changes |
| `test_finance_cannot_skip_manager_review` | Approval chain ordering enforced |
| `test_signup_requires_activation_and_login_is_throttled` | Inactive until admin activates, login rate limiting |
| `test_proration_rejects_future_effective_dates` | Future proration dates rejected |
| `test_concurrent_inventory_never_over_reserves` | PostgreSQL `SELECT FOR UPDATE` prevents double-reservation |
| `test_concurrent_duplicate_receipts_are_one_payment` | Concurrent identical payments produce exactly one record |
| `test_workspace_reads_with_real_lines` | All read endpoints work with real computed data |
| `test_create_alias_and_header_date_validation` | Create alias endpoint, date validation |

---

## Security

### Implemented Protections

- **JWT**: 15-minute access tokens, 7-day refresh tokens with rotation and blacklisting
- **RBAC**: 5 roles with server-side enforcement on every endpoint
- **Ownership boundaries**: Sales reps can only see/modify their own quotations
- **Portal isolation**: Tokens are scoped to specific quotations, expire, and hide cost data
- **Throttling**: 20 req/min anonymous, 300 req/min authenticated
- **Input validation**: Server-side with DRF serializers, database-level constraints
- **Concurrency**: `SELECT FOR UPDATE` on stock reservation and payment recording
- **CSV formula injection**: Prefixed with `'` to prevent spreadsheet code execution
- **Production guards**: Refuses to start without strong `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` ≥ 16 chars, `USE_SQLITE=0`
- **Security headers**: HSTS, X-Frame-Options DENY, Content-Type nosniff, Referrer-Policy no-referrer
- **Registration**: New accounts are inactive until admin activates them

### Known Limitations

- **Payment recording is simulated**: Payments are recorded manually by the finance role; no real payment gateway integration
- **Email delivery**: Portal magic links are generated but not emailed; the URL must be copied manually
- **Single-tenant**: Designed for a single company workspace; no multi-tenancy
- **No real-time updates**: Frontend polls for data; no WebSocket push notifications
- **No audit log UI**: Configuration audit records exist in the database but are not surfaced in the frontend
- **Browser testing**: No automated E2E browser tests (Playwright/Cypress)

---

## Deployment

### Production Requirements

1. **PostgreSQL** — private network, password ≥ 16 characters
2. **Redis** (optional) — set `REDIS_URL` for shared throttling across workers
3. **Gunicorn** — `gunicorn dealflow360.wsgi -b 127.0.0.1:8000 -w 4`
4. **Reverse proxy** (Caddy/Nginx) — TLS termination, set `TRUST_PROXY=1`
5. **Frontend** — `npm run build` → serve `dist/` as static files
6. **Environment** — see `.env.example` for all required variables

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | Yes | Long random string (≥50 chars in production) |
| `DJANGO_DEBUG` | Yes | `False` in production |
| `POSTGRES_DB` | Yes | Database name |
| `POSTGRES_USER` | Yes | Database user |
| `POSTGRES_PASSWORD` | Yes | Database password (≥16 chars in production) |
| `POSTGRES_HOST` | Yes | Database host |
| `POSTGRES_PORT` | No | Default: 5432 |
| `FRONTEND_URL` | Yes | Frontend origin for CORS |
| `REDIS_URL` | No | Redis URL for distributed throttling |
| `TRUST_PROXY` | No | Set to `1` behind a reverse proxy |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | No | Default: 15 |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | No | Default: 7 |
| `DEMO_PASSWORD` | Dev only | Password for seed data accounts (≥12 chars) |

---

## License

MIT — see [LICENSE](LICENSE).
