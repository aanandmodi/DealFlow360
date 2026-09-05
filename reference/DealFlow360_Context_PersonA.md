# DealFlow360 — Shared Project Context (identical for all 3 team members)

> Give this file to your AI IDE first, in every session, before your individual assignment section at the bottom. It contains the full picture so your IDE understands how your piece fits into the whole system — even the parts you're not building.

## 0. What this hackathon is
- Odoo-style hackathon; **judges are Odoo developers**. Problem statements are modeled closely on real Odoo modules (Accounting, HR & Payroll, Sales). We picked **DealFlow360** (Sales Operations) from three options.
- **Duration: 18 hours. Team of 3.**
- Goal: not a quote-to-invoice toy — a "self-governing deal engine" that enforces discount discipline, reacts to real inventory, mixes one-time and recurring billing on one order, and lets the customer negotiate live instead of over email.

## 1. Product Requirements (condensed from the official problem statement)

### 1.1 Key outcomes the judges expect to see
1. Sales rep builds a quotation → it auto-routes for the correct approval based on discount and customer tier
2. Rep gets live upsell/cross-sell suggestions with real-time margin impact while building the quote
3. Order auto-splits across warehouses based on stock, with manual override
4. A single order mixes one-time products and recurring subscription lines with correct proration and billing schedules
5. Dashboard shows deal health, stalled quotes, and discount anomalies in real time
6. Customer can view and negotiate the quotation directly from a portal, no email back-and-forth

### 1.2 User roles (all 5 — know these even if you're not building all of them)
- **Sales Rep** — builds quotations, applies discounts, adds upsell items, tracks approval/fulfillment
- **Sales Manager/Approver** — reviews/approves quotations over threshold, configures tiers/chains, monitors deal health
- **Finance/Ops User** — second-level approvals for high-risk discounts, manages fulfillment splits/backorders, reconciles billing
- **Customer (Portal User)** — views quotation, requests changes/counters a discount, confirms with one click
- **Admin** — backend config (products, price lists, discount tiers, warehouses, subscription plans), platform-wide analytics

### 1.3 Backend configuration modules (A1–A7)
- **A1 Auth** — internal users sign up/log in with standard creds; customers log in via magic link or email+password on the portal; after login, internal users reach backend config + sales workspace
- **A2 Product & Price List** — Product: Name, Category, Price, Unit, Tax, Description; Variants: Attribute/Values/Extra price; Price Lists: customer-tier-based pricing, currency-specific rules
- **A3 Discount Tier & Approval Chain** — ceilings per customer tier (e.g. Bronze ≤5%, Silver ≤10%, Gold ≤15%) AND per product category (some categories get more discretion than others); approval chain config decides which discount range needs Manager-only vs. Manager-then-Finance; **when a quote mixes categories with different ceilings, compute a blended risk score and route to the highest required level**; every approval/rejection/edit is logged with user, timestamp, reason
- **A4 Warehouse & Fulfillment** — create/manage warehouses; configure stock levels + replenishment rules per warehouse; shipping-cost weighting used by the auto-split logic to minimize number of shipments
- **A5 Subscription/Recurring Plans** — monthly/quarterly/yearly plans attached to products/services; proration rules for mid-cycle quantity/plan changes; cancellation + partial refund rules
- **A6 Upsell/Cross-sell Rules** (optional/bonus depth) — product pairings from historical co-purchase data; promoted products rank higher; minimum margin thresholds so only healthy-margin suggestions surface
- **A7 Reporting & Dashboard config** — dashboard + reporting menu; export PDF/XLS; filters: Period, Sales Team/Rep, Approval Status, Product/Category

### 1.4 Frontend / rep workspace screens (B1–B9)
- **B1 Sales Workspace top nav** — Quotations, Pipeline; actions: Reload Data, Go to Back-end, Close Workspace
- **B2 Quotation List / Pipeline (Kanban)** — cards show customer, amount, stage (e.g. "Acme Corp, Draft"); selecting opens the Quotation Builder
- **B3 Quotation Builder** — pick products across categories (Hardware/Services/Subscriptions), adjust quantities, apply line- or order-level discounts, view order lines with totals + a **live margin indicator**; confirm → approval, or straight to fulfillment if no approval needed
- **B4 Discount Approval screen** — shows blended risk score, approval steps list (Sales Manager, and Finance only if required); reviewer can approve/reject/return for revision; confirmation screen writes a full audit trail entry
- **B5 Upsell/Cross-sell panel** — shown alongside the cart while building a quote; ranked suggestions from co-purchase history + active promotions; shows suggested product, margin delta if added, promotion tag; buttons "Add to Quote" / "Dismiss"; margin indicator updates immediately after adding
- **B6 Fulfillment & Warehouse Split screen** — recommended split based on live stock; shows warehouse name, quantity fulfilled from each, estimated shipment count/cost; buttons "Accept Suggested Split" / "Manual Override"; auto "Consolidate Remaining Backorder" prompt if stock arrives mid-fulfillment
- **B7 Subscription & Billing screen** — one-time and recurring lines shown separately; upcoming billing schedule for recurring lines; handles mid-cycle proration on quantity change; cancel/modify subscription controls trigger automatic partial refund or credit note
- **B8 Customer Portal Negotiation screen** — **separate, restricted view**, not a relabeled internal screen; shows quotation + status (Sent/Under Negotiation/Confirmed); line-level comment/change-request tool; counter-discount proposal field; buttons "Submit Request" / "Confirm Quotation"; **on confirm, if final terms exceed approval thresholds, the quote automatically re-enters the approval flow from B4 — otherwise it goes straight to fulfillment**
- **B9 Deal Health & Anomaly Dashboard** — stalled deals (inactive beyond a configured number of days), discount anomaly alerts (a discount well above a rep's historical average), delivery-promise slippage indicators; clicking an alert opens the related quotation; an automated nudge/escalation action can be triggered from an alert

### 1.5 Understanding the Blended Discount Risk Score (the signature mechanic — everyone should understand this cold)
Different product categories have different discount ceilings even for the same customer tier. Example: a Gold customer is normally allowed up to 15%, but within one order, Hardware might allow up to 15% while Services only allow up to 10% (thinner margins). If a rep gives 12% on a Hardware line (fine, under its 15% ceiling) but 18% on a Service line (8 points over its own 10% ceiling), **that one line flags the whole quotation for approval** — even though 15% "sounds fine" for a Gold customer overall. It's "blended" because the score also catches the case where *no single line* is badly over, but many lines are each a little over (2 points here, 3 there) — added together that's real margin leakage the per-line check alone would miss. The score decides **who** needs to review (Manager only, or Manager + Finance) so managers aren't stuck reviewing every quote by hand, and it stops a rep from staying technically within every line limit while still over-discounting the order overall.

### 1.6 Complete end-to-end flow
Rep logs in → Admin has configured products/price lists/discount tiers/approval chains/warehouses/subscription plans → Rep opens workspace, creates a quotation for a customer → adds products, applies discounts, reviews upsell suggestions → if discount/blended risk exceeds threshold, quote auto-routes for approval (Manager, then Finance if required) → once approved (or immediately if no approval needed), system suggests a warehouse fulfillment split → order may include recurring subscription lines generating a billing schedule alongside any one-time invoice → customer gets the quotation link, negotiates via the portal → if terms change beyond thresholds during negotiation, quote automatically re-enters the approval flow → once confirmed, order proceeds to fulfillment and billing → Manager watches the Deal Health dashboard throughout to catch stalled/risky deals early.

### 1.7 The "Quick Test Flow" (this is effectively the acceptance test / demo script)
1. Sign up/log in; set up a discount tier, a warehouse, a subscription plan
2. Create a quotation, add a product line with a discount higher than normally allowed
3. Confirm the quotation automatically asks for manager approval, without the rep requesting it manually
4. While building the quote, accept one upsell suggestion and confirm the order total/margin update immediately
5. Get the quotation approved; confirm stock is pulled from the correct warehouse, splitting across two warehouses if needed
6. Confirm a one-time product and a recurring subscription on the same order are billed correctly and separately
7. Open the customer portal, request a bigger discount as the customer, confirm the quote auto-returns for approval
8. Confirm the order, record a payment, confirm invoice status updates correctly

If all 8 steps work, the core flow is solid — this is your definition of "done" for the demo.

### 1.8 Deliverables
- Working backend + frontend, populated with sample seed data
- 5-minute live demo covering ≥2 full end-to-end flows
- One-page architecture diagram (data model + how modules connect)
- Short note on what you'd build next with more time

## 2. Tech Stack (locked — do not deviate, no experimental tech)

| Layer | Choice | Why |
|---|---|---|
| Backend language | Python 3.11+ | Odoo itself is Python — judges read this instantly |
| Backend framework | Django 5 + Django REST Framework | Django's ORM/migrations map closely to how Odoo devs think about models |
| Database | PostgreSQL 15+ (required) | Same engine Odoo runs on |
| Backend config screens | Django Admin (customized) | Covers A2–A7 (Products, Price Lists, Discount Tiers, Warehouses, Subscription Plans) almost for free |
| Auth | djangorestframework-simplejwt for internal users; simple token/magic-link model for the customer portal | Standard, no experimental auth flow |
| Frontend | React 18 + TypeScript + Vite | Fast dev loop, no SSR complexity we don't need |
| Styling | Tailwind CSS + shadcn/ui | No ramp-up time |
| Frontend data layer | TanStack Query (React Query) + plain fetch | No Redux/complex state management needed |
| Charts | Recharts | Simple, no learning curve |
| "Live" updates | Plain synchronous API calls on every cart change — **no WebSockets/SSE** | Unnecessary risk for an 18-hour build |
| Local DB consistency | docker-compose running only the Postgres service | One command gives all 3 laptops an identical DB |
| PDF/XLS export | reportlab / plain CSV — bonus only, build last if time remains | Not core to the demo |

## 3. Team & Ownership (vertical slices — full models→API→UI per domain, own Django app each, to minimize merge conflicts)

- **Person A — Core Deal Engine**: Django app `quotations`. Owns Quotation, QuotationLine, DiscountTier, ApprovalChain, ApprovalLog models; the blended risk score algorithm; the approval state machine (Draft → Pending Approval → Approved/Rejected → Confirmed); Quotation Builder UI (B3); Discount Approval UI (B4).
- **Person B — Fulfillment, Billing & Upsell**: Django apps `fulfillment`, `billing`. Owns Warehouse, StockLevel, SubscriptionPlan, BillingSchedule models; the warehouse auto-split algorithm + backorder consolidation; subscription proration logic; the upsell/cross-sell suggestion endpoint; Fulfillment & Warehouse Split UI (B6); Subscription & Billing UI (B7); Upsell panel (B5, which embeds inside Person A's Quotation Builder page — the two of you share the API contract for this).
- **Person C — Portal, Dashboard, Auth & App Shell**: Django app `portal`, plus Django Admin customization for the A2–A7 config models (Products, Price Lists, Warehouses, Subscription Plans, Discount Tiers). Owns the customer negotiation portal (B8, a genuinely separate restricted view, wired to re-trigger Person A's approval flow on threshold breach); the Deal Health & Anomaly Dashboard (B9); Auth (JWT + magic link); the React app shell/navigation (B1); the Quotation List/Pipeline Kanban view (B2).

**Shared integration contract (agree at Hour 0, do not change mid-hackathon):**
`GET /api/quotations/{id}/upsell-suggestions/` — Person B builds it, Person A's Quotation Builder calls it to render the panel from 1.4/B5.

## 4. Git Workflow
- `main` is always demo-able — nothing broken merges in
- One feature branch per person per sub-task (`feat/a-risk-score`, `feat/b-warehouse-split`, `feat/c-portal-auth`, …)
- **Model ownership boundary = Django app boundary** — Person A only migrates `quotations`, B only `fulfillment`/`billing`, C only `portal`/`core`. This is what prevents Django migration conflicts.
- Small, frequent commits, short-lived branches, merge at every checkpoint below (not once at the end)
- Rotate PR review — even a 2-minute glance before merge catches broken imports before `main` breaks
- Shared `.env.example` and one `docker-compose.yml` (Postgres only), committed at Hour 0

## 5. Hour-by-Hour Timeline (18 hours total)

| Phase | Hours | What happens | Who |
|---|---|---|---|
| 0 — Kickoff | 0:00–1:00 | Lock MVP scope; create repo/branch rules/docker-compose Postgres; whiteboard shared schema; agree upsell API contract stub | All 3 |
| 1 — Foundation models | 1:00–2:00 | A pushes core models fast (User/Role, Customer+tier, Product, PriceList, bare Quotation); B scaffolds Warehouse/SubscriptionPlan skeletons; C scaffolds JWT auth + Django Admin registration + React router shell/login | A leads, B+C parallel |
| 2 — Sync #1 | 2:00–2:15 | Pull `main`, resolve early migration conflicts | All 3 |
| 3 — Deep build 1 | 2:15–4:00 | Core models/APIs for each vertical slice | Independently |
| 4 — Sync #2 | 4:00–4:15 | Merge, resolve conflicts while small | All 3 |
| 5 — Deep build 2 | 4:15–6:00 | A: risk score + approval workflow. B: warehouse split algorithm. C: portal auth + negotiation screen skeleton | Independently |
| 6 — Sync #3 | 6:00–6:15 | Merge to `main` | All 3 |
| 7 — Deep build 3 | 6:15–8:00 | A: Quotation Builder UI. B: proration logic + Upsell endpoint. C: Dashboard skeleton + Kanban pipeline view | Independently |
| 8 — Sync #4 | 8:00–8:15 | Merge to `main` | All 3 |
| 9 — Mid-point integration test | 8:15–9:30 | Run the full flow once: quote → discount → auto-approval-route → fulfillment split → billing → portal negotiation; fix breaks now | All 3 together |
| 10 — Feature completion | 9:30–13:00 | Wire Upsell panel into Quotation Builder (A+B), connect Dashboard to live data (C), fulfillment/billing UI polish (B), approval screen polish (A) | Independently, hourly check-ins |
| 11 — Feature freeze & merge | 13:00–14:00 | Everything merges to `main`; bug fixes only from here | All 3 |
| 12 — Quick Test Flow validation | 14:00–14:45 | Run the exact 8-step flow from section 1.7, confirm each step visibly works | All 3 |
| 13 — Bug bash + seed data | 14:45–16:00 | Cross-test each other's flows; fix demo-breaking bugs only; load realistic seed data (Gold/Silver/Bronze customers, Hardware vs. Service products with different ceilings, 2 warehouses, 1–2 subscription products) | All 3 |
| 14 — Demo prep | 16:00–17:00 | Write 5-min demo script (≥2 flows), draft the 1-page architecture diagram, draft "what's next" note, rehearse | All 3 |
| 15 — Buffer & submission | 17:00–18:00 | Fix only demo-breaking bugs, final README, submit, 15 min pure buffer | All 3 |

## 6. MVP Cuts (agreed at Hour 0 — do not gold-plate)
**Build fully:** blended risk score with ≥2 categories at different ceilings; two-warehouse auto-split with manual override; one recurring + one one-time line on the same order with correct proration; customer counter-discount → automatic re-approval.
**Simplify:** upsell suggestions = simple co-purchase + margin-threshold rule, not a trained model; dashboard anomaly detection = discount > rep's historical average + threshold, not a real anomaly model. **Skip entirely:** multi-currency (explicitly a bonus in the spec, not a requirement). **Defer unless time remains:** PDF/XLS export, bulk email, fine-grained permission edge cases beyond visibly distinct roles in the UI.

---

# 7. YOUR ASSIGNMENT — Person A: Core Deal Engine (Quotations, Discounts, Approvals)

Everything above this line is identical in all three teammates' files. This section is yours only.

### Your Django app: `quotations`

### Your models (concrete starting schema)
- `Quotation` — id, customer (FK Contact), sales_rep (FK User), status (Draft / PendingApproval / Approved / Rejected / Confirmed / UnderNegotiation), created_at, updated_at, blended_risk_score (float), required_approval_level (None / Manager / Manager+Finance)
- `QuotationLine` — id, quotation (FK), product (FK), quantity, unit_price, discount_percent, line_margin (computed)
- `DiscountTier` — id, name (Bronze/Silver/Gold), max_discount_percent
- `CategoryDiscountCeiling` — id, product_category (FK), max_discount_percent
- `ApprovalChain` — id, min_overage_threshold, max_overage_threshold, requires_finance (bool)
- `ApprovalLog` — id, quotation (FK), approver (FK User), action (approve/reject/return), reason (text), timestamp

### Your core algorithm — Blended Discount Risk Score
For each line: compare its `discount_percent` against its category's `max_discount_percent` (fall back to the customer's tier ceiling if no category-specific ceiling exists). Compute per-line overage = `max(0, discount_percent - ceiling)`. Sum overages across all lines (or another aggregate you can defend — e.g. weighted by line value) into `blended_risk_score`. Map score ranges to `required_approval_level` using `ApprovalChain` thresholds. **Any single line breaching its own ceiling should trigger approval even if the order-level average looks fine** — see section 1.5 above for the worked example. Log every submission's computed score for the audit trail.

### Your APIs
- `POST /api/quotations/` — create
- `POST /api/quotations/{id}/lines/` — add line
- `PATCH /api/quotations/{id}/lines/{line_id}/` — edit qty/discount, returns updated line_margin
- `POST /api/quotations/{id}/submit/` — computes blended_risk_score, sets required_approval_level, transitions status
- `POST /api/quotations/{id}/approve/` — advances through approval chain, writes ApprovalLog
- `POST /api/quotations/{id}/reject/` / `POST /api/quotations/{id}/return/`
- `GET /api/quotations/{id}/risk-score/` — for the Approval screen to display the breakdown

### Your UI
- **Quotation Builder (B3):** product picker across categories, qty +/-, line- and order-level discount inputs, running totals, **live margin indicator** that recalculates on every change (call your own API synchronously — no websockets), a slot in the layout for Person B's Upsell panel (B5), "Confirm" button that calls `/submit/`
- **Discount Approval screen (B4):** shows blended_risk_score and which lines caused it, approval steps list (Manager, +Finance if required), Approve/Reject/Return buttons, confirmation view showing the audit trail entry that was just written

### Your phase focus (from the shared timeline)
Hour 1–2: Quotation/QuotationLine/DiscountTier models pushed fast so B & C can build on top. Hour 4:15–6: risk score algorithm + approval state machine. Hour 6:15–8: Quotation Builder UI. Hour 9:30–13: wire in Person B's upsell panel, polish Approval screen. Hour 14: help validate Quick Test Flow steps 2, 3, 5, 7 (discount / approval / confirm) end to end.
