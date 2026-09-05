# DealFlow360 — Repo Architecture

Two top-level folders, exactly as you described. `reference/` never gets touched by the app itself — it's context only, for the AI IDE and for humans. `DealFlow360/` is the actual buildable project, split into `backend/` (Django 5 + DRF + PostgreSQL) and `frontend/` (React 18 + TS + Vite + Tailwind/shadcn + TanStack Query + Recharts), matching the locked tech stack and the 3-way app-boundary split (A = `quotations`, B = `fulfillment`/`billing`, C = `portal`/`core`).

```
project-root/
│
├── reference/                              # Context only — never imported by code
│   ├── DealFlow360_Context_PersonA.md
│   ├── DealFlow360_Context_PersonB.md
│   ├── DealFlow360_Context_PersonC.md
│   ├── shared_schema_whiteboard.md         # Hour-0 output: ER sketch agreed by all 3
│   └── api_contracts.md                    # Hour-0 output: upsell-suggestions shape, etc.
│
└── DealFlow360/
    │
    ├── docker-compose.yml                  # Postgres only — one command, identical DB for all 3 laptops
    ├── .env.example                        # Shared env template (DB creds, JWT secret, ports)
    ├── README.md                           # Setup instructions + architecture diagram + demo note
    │
    ├── backend/                            # Django 5 + Django REST Framework
    │   ├── manage.py
    │   ├── requirements.txt                # django, djangorestframework, psycopg2-binary,
    │   │                                    # djangorestframework-simplejwt, django-cors-headers,
    │   │                                    # reportlab (bonus PDF/XLS export, build last)
    │   ├── pytest.ini / conftest.py         # optional, if you add tests
    │   │
    │   ├── dealflow360/                     # Django project config (shared, no owner — coordinate changes)
    │   │   ├── __init__.py
    │   │   ├── settings.py                 # INSTALLED_APPS lists every app below
    │   │   ├── urls.py                     # root router: includes each app's urls.py under /api/...
    │   │   ├── asgi.py
    │   │   └── wsgi.py
    │   │
    │   ├── core/                            # Person C — shared base: User/Role model, permissions, auth
    │   │   ├── models.py                   # User, Role
    │   │   ├── admin.py
    │   │   ├── permissions.py              # role-based DRF permission classes, reused by every app
    │   │   ├── serializers.py
    │   │   ├── views.py                    # JWT login/refresh, magic-link endpoints
    │   │   ├── urls.py
    │   │   └── migrations/
    │   │
    │   ├── quotations/                      # Person A — Core Deal Engine
    │   │   ├── models.py                   # Quotation, QuotationLine, DiscountTier, ApprovalChain, ApprovalLog
    │   │   ├── admin.py                    # registers A2–A7 config models in Django Admin
    │   │   ├── serializers.py
    │   │   ├── services/
    │   │   │   └── risk_score.py           # blended discount risk score algorithm (section 1.5)
    │   │   ├── views.py                    # quotation CRUD, approval state machine endpoints
    │   │   ├── urls.py
    │   │   └── migrations/
    │   │
    │   ├── fulfillment/                     # Person B (you)
    │   │   ├── models.py                   # Warehouse, StockLevel, FulfillmentSplit
    │   │   ├── admin.py                    # Warehouse/StockLevel config (A4)
    │   │   ├── serializers.py
    │   │   ├── services/
    │   │   │   └── auto_split.py           # warehouse auto-split algorithm
    │   │   ├── views.py                    # suggest-split / accept-split / override-split
    │   │   ├── urls.py
    │   │   └── migrations/
    │   │
    │   ├── billing/                         # Person B (you)
    │   │   ├── models.py                   # SubscriptionPlan, SubscriptionLine, UpsellRule
    │   │   ├── admin.py                    # SubscriptionPlan config (A5), UpsellRule config (A6)
    │   │   ├── serializers.py
    │   │   ├── services/
    │   │   │   ├── proration.py            # subscription proration logic
    │   │   │   └── upsell.py               # upsell ranking heuristic
    │   │   ├── views.py                    # schedule / prorate / upsell-suggestions
    │   │   ├── urls.py
    │   │   └── migrations/
    │   │
    │   └── portal/                          # Person C — Customer Portal, Dashboard
    │       ├── models.py                   # PortalSession/magic-link tokens, negotiation change-requests
    │       ├── admin.py
    │       ├── serializers.py
    │       ├── services/
    │       │   └── anomaly.py              # discount-anomaly + stalled-deal detection (B9)
    │       ├── views.py                    # negotiation endpoints, dashboard aggregation endpoints
    │       ├── urls.py
    │       └── migrations/
    │
    └── frontend/                            # React 18 + TypeScript + Vite
        ├── package.json                     # react, react-dom, typescript, vite, tailwindcss,
        │                                    # @tanstack/react-query, recharts, shadcn/ui deps
        ├── vite.config.ts
        ├── tsconfig.json
        ├── tailwind.config.js
        ├── postcss.config.js
        ├── index.html
        │
        └── src/
            ├── main.tsx                     # React root + QueryClientProvider
            ├── App.tsx
            ├── router.tsx                   # routes for B1 shell + all screens below
            │
            ├── api/                         # plain fetch clients, one file per backend app
            │   ├── client.ts                # base fetch wrapper (JWT header, base URL)
            │   ├── quotations.ts
            │   ├── fulfillment.ts
            │   ├── billing.ts
            │   └── portal.ts
            │
            ├── hooks/                       # TanStack Query hooks, one per API file above
            │   ├── useQuotations.ts
            │   ├── useFulfillment.ts
            │   ├── useBilling.ts
            │   └── usePortal.ts
            │
            ├── components/
            │   └── ui/                      # shadcn/ui generated components (button, dialog, table…)
            │
            ├── features/                    # one folder per screen, matches B1–B9 ownership
            │   ├── shell/                   # Person C — B1 top nav (Quotations, Pipeline, Reload Data)
            │   ├── pipeline/                # Person C — B2 Kanban quotation list
            │   ├── quotation-builder/       # Person A — B3, hosts the embedded Upsell panel below
            │   ├── approval/                # Person A — B4 discount approval screen
            │   ├── upsell-panel/            # Person B (you) — B5, embeds inside quotation-builder/
            │   ├── fulfillment/             # Person B (you) — B6 warehouse split screen
            │   ├── billing/                 # Person B (you) — B7 subscription & billing screen
            │   ├── portal-negotiation/      # Person C — B8 customer portal (separate restricted view)
            │   └── dashboard/               # Person C — B9 deal health & anomaly dashboard (Recharts)
            │
            ├── lib/
            │   ├── queryClient.ts
            │   └── utils.ts
            │
            └── styles/
                └── globals.css              # Tailwind base + shadcn theme tokens
```

### How this maps to ownership
- **You never create files under `backend/quotations/`, `backend/portal/`, `backend/core/`, or `frontend/src/features/{shell,pipeline,quotation-builder,approval,portal-negotiation,dashboard}/`** — those are Person A's and C's app boundaries.
- Your buildable surface is exactly `backend/fulfillment/`, `backend/billing/`, and `frontend/src/features/{fulfillment,billing,upsell-panel}/`.
- `upsell-panel/` is the one folder that physically ships inside someone else's screen (`quotation-builder/` imports and renders it) — coordinate the import path and prop shape with Person A once you build it.
- `dealflow360/settings.py` (INSTALLED_APPS) and the root `urls.py` are shared config files everyone edits — small additions only, and a fast PR glance before merging, since this is the one file all three of you will touch.
