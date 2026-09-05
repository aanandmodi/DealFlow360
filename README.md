# DealFlow360

**Autonomous Deal Engine for Enterprise Revenue Operations**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Django 5.0](https://img.shields.io/badge/django-5.0-green.svg)](https://www.djangoproject.com/)
[![React 18](https://img.shields.io/badge/react-18.3-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL 15](https://img.shields.io/badge/postgresql-15+-336791.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Abstract

**DealFlow360** is a self-governing revenue operations platform designed to automate and enforce governance across the quote-to-cash lifecycle. It prevents margin slippage through a proprietary **Blended Discount Risk Score** algorithm, balances multi-warehouse fulfillment based on real-time stock levels, unifies one-time hardware purchases and recurring subscription billing on a single order, and replaces slow negotiation emails with an interactive, live **Customer Negotiation Portal** with automated re-approval triggers.

---

## Key Capabilities

- **Intelligent Discount Governance**: Evaluates quotations using a multi-dimensional blended risk scoring algorithm that detects per-line ceiling breaches and cumulative margin erosion across mixed categories.
- **Dynamic Multi-Tier Approvals**: Auto-routes deals based on risk profiles: instant auto-approval for low risk, Sales Manager sign-off for medium risk, and dual Sales Manager + Finance Controller approval for high-risk deals.
- **Enterprise CPQ Quotation Builder**: Real-time margin calculation, live discount constraint feedback, catalog search, and inline summary cards with running totals.
- **Multi-Warehouse Auto-Split Fulfillment**: Real-time inventory evaluation that intelligently splits orders across fulfillment nodes (e.g., East Coast, West Coast, Backorder) to maximize delivery speed and minimize logistics cost.
- **Hybrid Billing & Mid-Cycle Proration**: Unifies one-time capital expenditures with monthly/annual SaaS recurring schedules, supporting mid-cycle co-terming and proration.
- **Interactive Customer Negotiation Portal**: Secure tokenized portal where enterprise clients inspect line items, leave feedback, and counter-propose pricing or quantities. Breaches automatically re-enter the approval pipeline.
- **Deal Health & Anomaly Analytics**: Pipeline monitoring tracking deal velocity, discount anomalies, approval bottlenecks, and margin health.

---

## System Architecture

```mermaid
graph TB
    subgraph ClientLayer["🖥️ Frontend Presentation Layer (React 18 + Vite + TypeScript)"]
        UI_Dash["Dashboard & Pipeline<br/>(Deal Health, KPIs, Recharts)"]
        UI_CPQ["CPQ Quotation Builder<br/>(Real-time Margins, Inline Validation)"]
        UI_Appr["Approval Management<br/>(Multi-tier Review Queue & Logs)"]
        UI_Port["Customer Negotiation Portal<br/>(Live Counter-offers & Sign-off)"]
        UI_Ops["Fulfillment & Billing Ops<br/>(Warehouse Splits, Invoices)"]
    end

    subgraph SecurityLayer["🔐 API Gateway & Security Layer"]
        AuthGW["Django REST Framework API Gateway"]
        JWT["JWT Authentication & RBAC Engine<br/>(Sales Rep, Sales Manager, Finance, Admin, Customer)"]
    end

    subgraph ServiceLayer["⚙️ Modular Business Logic Services (Django 5)"]
        subgraph CoreApp["core Service"]
            Svc_User["User & RBAC Service"]
            Svc_Catalog["Product Catalog & Tier Engine"]
        end

        subgraph QuotationsApp["quotations Service (Core Deal Engine)"]
            Svc_CPQ["Quotation Lifecycle Manager"]
            Svc_Risk["Blended Risk Score Calculator"]
            Svc_Appr["Approval State Machine"]
        end

        subgraph FulfillmentApp["fulfillment Service"]
            Svc_WH["Multi-Warehouse Splitter"]
            Svc_Stock["Stock Level & Backorder Manager"]
        end

        subgraph BillingApp["billing Service"]
            Svc_Sub["Hybrid Billing Engine"]
            Svc_Prorate["Proration & Upsell Heuristics"]
        end

        subgraph PortalApp["portal Service"]
            Svc_Negot["Customer Portal & Counter Negotiation"]
            Svc_Audit["Audit Trail & Activity Logger"]
        end
    end

    subgraph DataLayer["💾 Data Persistence Layer"]
        DB[(PostgreSQL 15 Database)]
    end

    ClientLayer -->|HTTPS / JSON REST API| AuthGW
    AuthGW --> JWT
    JWT --> ServiceLayer
    ServiceLayer -->|Django ORM Queries| DB
```

---

## End-to-End Product & Deal Flow

The complete journey of an enterprise deal from creation to fulfillment and revenue recognition:

```mermaid
flowchart TD
    Start([🚀 Opportunity Identified]) --> Step1[1. Sales Rep Selects Customer & Tier]
    Step1 --> Step2[2. Configure Quote Items in CPQ Builder]
    Step2 --> Step3[3. Set Line Quantities & Custom Discounts]
    
    Step3 --> RiskCalc{{"⚡ Blended Discount Risk Algorithm"}}
    RiskCalc -->|Discount ≤ Tier Ceiling| LowRisk["🟢 Low Risk (Score < 30)<br/>Instant / Auto-Approved"]
    RiskCalc -->|Exceeds Tier Ceiling| MedRisk["🟡 Medium Risk (Score 30-59)<br/>Requires Sales Manager Review"]
    RiskCalc -->|Severe Breach / Heavy Leakage| HighRisk["🔴 High Risk (Score ≥ 60)<br/>Requires Manager + Finance Review"]

    LowRisk --> ReadyToSend[Quote Approved & Ready]
    MedRisk --> MgrReview{Sales Manager Review}
    HighRisk --> MgrReview

    MgrReview -->|Approved| FinCheck{Finance Approval Required?}
    MgrReview -->|Return for Edit| Step2
    MgrReview -->|Rejected| DealLost([❌ Deal Rejected])

    FinCheck -->|Yes| FinReview{Finance Director Review}
    FinCheck -->|No| ReadyToSend

    FinReview -->|Approved| ReadyToSend
    FinReview -->|Return for Edit| Step2
    FinReview -->|Rejected| DealLost

    ReadyToSend --> Step4[4. Dispatch Magic Link to Customer Portal]
    Step4 --> CustomerAction{Customer Action in Portal}

    CustomerAction -->|Accepts Terms| DealWon[5. Customer Digitally Signs Quote]
    CustomerAction -->|Counter-Offers Discount/Qty| CounterCheck{Counter Breaches Approval Limits?}
    CustomerAction -->|Declines| DealLost

    CounterCheck -->|Within Allowed Delta| SalesRepAck[Sales Rep Accepts Counter]
    CounterCheck -->|Exceeds Threshold| ReApprove["🔄 Auto Re-Enter Approval Queue<br/>(Status: under_negotiation)"]
    ReApprove --> MgrReview
    SalesRepAck --> DealWon

    DealWon --> SplitEngine{{"📦 Multi-Warehouse Allocation Engine"}}
    SplitEngine --> AutoSplit[Auto-Split Order Across WH-East / WH-West / Backorder]
    
    AutoSplit --> BillingEngine{{"💳 Hybrid Billing Engine"}}
    BillingEngine --> GenInvoice[Generate One-Time Hardware Invoice]
    BillingEngine --> GenSub[Initiate Recurring SaaS Subscription & Proration Schedule]
    
    GenInvoice & GenSub --> ClosedWon([🎉 Closed-Won: Revenue Recognized])
```

---

## User Flow & Multi-Role Interaction Journey

Demonstrating the collaborative sequence between Sales Rep, Deal Engine, Management, Finance, Customer, and Operations:

```mermaid
sequenceDiagram
    autonumber
    actor Rep as 👤 Sales Rep (Elena)
    actor App as 💻 DealFlow360 Engine
    actor Mgr as 👔 Sales Manager (M. Shah)
    actor Fin as 📊 Finance Director (R. Iyer)
    actor Cust as 🏢 Enterprise Customer
    actor Ops as 📦 Fulfillment & Billing

    Rep->>App: 1. Create Quotation for Customer (Gold Tier)
    Rep->>App: 2. Add Hardware (18% discount) + Enterprise SaaS
    App-->>Rep: 3. Instant Warning: Hardware discount exceeds 15% ceiling! Risk Score: 68 (HIGH)
    Rep->>App: 4. Submit quotation with business justification
    
    App->>Mgr: 5. Notification: High-Risk Quote queued for review
    Mgr->>App: 6. Review margin analysis and approve Level-1
    App->>Fin: 7. Forward to Level-2 Finance queue
    Fin->>App: 8. Approve Level-2 discount exception
    
    App-->>Rep: 9. Status: APPROVED (Approval chain complete)
    Rep->>App: 10. Generate customer portal magic link
    App->>Cust: 11. Dispatch invitation with secure access token
    
    Cust->>App: 12. Open live portal & review pricing breakdown
    Cust->>App: 13. Submit counter-proposal (+10 hardware units, extra 2% discount)
    App-->>Mgr: 14. Evaluate delta -> Threshold exceeded -> Triggers re-approval
    Mgr->>App: 15. Approve negotiated counter-offer
    Cust->>App: 16. Accept & digitally sign quotation
    
    App->>Ops: 17. Trigger multi-warehouse auto-split (Warehouse East: 70%, Warehouse West: 30%)
    App->>Ops: 18. Generate invoice & recurring subscription schedule
    Ops-->>App: 19. Orders dispatched & invoices finalized
    App-->>Rep: 20. Update Deal Health Dashboard: CLOSED-WON
```

---

## Quotation Lifecycle & Data State Machine

State transitions governed by the core state engine with strict rollback rules:

```mermaid
stateDiagram-v2
    [*] --> Draft : Create Quotation

    Draft --> Draft : Add/Edit Lines & Margin Calculations
    Draft --> PendingApproval : Submit (Discount Ceiling Breached)
    Draft --> Approved : Submit (Within Tier Ceilings / Score < 30)

    state PendingApproval {
        [*] --> ManagerReview
        ManagerReview --> FinanceReview : Manager Approved (Score ≥ 60)
        ManagerReview --> RejectedState : Manager Rejection
        ManagerReview --> Draft : Return for Revision
        FinanceReview --> ApprovedState : Finance Approved
        FinanceReview --> RejectedState : Finance Rejection
        FinanceReview --> Draft : Return for Revision
    }

    PendingApproval --> Approved : All Approvers Signed Off
    PendingApproval --> Draft : Returned for Revisions
    PendingApproval --> Rejected : Terminated

    Approved --> SentToCustomer : Generate Customer Portal Link
    SentToCustomer --> UnderNegotiation : Customer Counter-Offer
    SentToCustomer --> Accepted : Customer Digital Signature
    SentToCustomer --> Cancelled : Expired / Customer Declines

    UnderNegotiation --> PendingApproval : Counter Exceeds Threshold (Re-Approval Trigger)
    UnderNegotiation --> Accepted : Sales Rep & Manager Accept Counter
    UnderNegotiation --> SentToCustomer : Revised Quote Resubmitted

    Accepted --> FulfillmentAndBilling : Contract Executed
    
    state FulfillmentAndBilling {
        [*] --> WarehouseSplit : Evaluate Inventory Levels
        WarehouseSplit --> OrdersDispatched : Primary / Secondary Warehouse Split
        OrdersDispatched --> Invoiced : One-Time Hardware Line Items
        OrdersDispatched --> SubscriptionActive : Recurring SaaS Proration Schedule
    }

    FulfillmentAndBilling --> ClosedWon : Fully Dispatched & Invoiced
    ClosedWon --> [*]
    Rejected --> [*]
    Cancelled --> [*]
```

---

## Data Communication & Entity-Relationship Model

```mermaid
erDiagram
    USER {
        uuid id PK
        string username
        string email
        string role "SALES_REP | SALES_MGR | FINANCE | ADMIN"
        boolean is_active
    }

    CUSTOMER {
        uuid id PK
        string company_name
        string tier "BRONZE | SILVER | GOLD | PLATINUM"
        string contact_email
        decimal credit_limit
    }

    PRODUCT_CATEGORY {
        uuid id PK
        string name "Hardware | Software | Services"
        string code
    }

    PRODUCT {
        uuid id PK
        uuid category_id FK
        string sku
        string name
        decimal list_price
        decimal base_cost
        string billing_type "ONE_TIME | RECURRING"
        string recurrence "MONTHLY | ANNUAL"
    }

    DISCOUNT_CEILING_TIER {
        uuid id PK
        string customer_tier
        uuid category_id FK
        decimal max_rep_discount
        decimal manager_approval_ceiling
        decimal finance_approval_ceiling
    }

    QUOTATION {
        uuid id PK
        string quote_number
        uuid customer_id FK
        uuid created_by FK
        string status "DRAFT | PENDING | APPROVED | PORTAL | WON"
        decimal subtotal
        decimal total_discount_amount
        decimal total_amount
        decimal blended_risk_score
        string risk_level "LOW | MEDIUM | HIGH"
        datetime valid_until
        datetime created_at
    }

    QUOTATION_LINE {
        uuid id PK
        uuid quotation_id FK
        uuid product_id FK
        integer quantity
        decimal unit_price
        decimal discount_percent
        decimal line_total
        decimal margin_percent
        boolean breaches_ceiling
    }

    APPROVAL_CHAIN {
        uuid id PK
        uuid quotation_id FK
        integer step_number
        string required_role "SALES_MGR | FINANCE"
        uuid assigned_to FK
        string status "PENDING | APPROVED | REJECTED"
        datetime acted_at
    }

    APPROVAL_LOG {
        uuid id PK
        uuid quotation_id FK
        uuid actor_id FK
        string action "SUBMIT | APPROVE | REJECT | REVISE"
        text comments
        datetime timestamp
    }

    WAREHOUSE {
        uuid id PK
        string code "WH-EAST | WH-WEST | WH-CENTRAL"
        string name
        string location
    }

    STOCK_LEVEL {
        uuid id PK
        uuid warehouse_id FK
        uuid product_id FK
        integer available_qty
        integer reserved_qty
    }

    CUSTOMER ||--o{ QUOTATION : "requests"
    USER ||--o{ QUOTATION : "creates"
    PRODUCT_CATEGORY ||--o{ PRODUCT : "categorizes"
    PRODUCT_CATEGORY ||--o{ DISCOUNT_CEILING_TIER : "governs"
    PRODUCT ||--o{ QUOTATION_LINE : "referenced_in"
    QUOTATION ||--|{ QUOTATION_LINE : "contains"
    QUOTATION ||--o{ APPROVAL_CHAIN : "requires"
    QUOTATION ||--o{ APPROVAL_LOG : "audited_by"
    USER ||--o{ APPROVAL_LOG : "records"
    WAREHOUSE ||--o{ STOCK_LEVEL : "stocks"
    PRODUCT ||--o{ STOCK_LEVEL : "stocked_in"
```

---

## Directory Structure

```
DealFlow360/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── dealflow360/                   # Django project configuration
│   │   ├── settings.py                # Installed apps, DB, JWT, CORS
│   │   ├── urls.py                    # Root API router
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── core/                          # User Auth, Roles, Products, Customers
│   │   ├── models.py                  # User, Role, ProductCategory, Product, Customer
│   │   ├── serializers.py
│   │   ├── views.py                   # JWT Auth, Catalog endpoints
│   │   ├── urls.py
│   │   └── admin.py
│   ├── quotations/                    # Core Quotation Engine & Risk Scoring
│   │   ├── models.py                  # Quotation, LineItems, DiscountTiers, ApprovalChain
│   │   ├── services/
│   │   │   └── risk_score.py          # Blended Discount Risk Algorithm
│   │   ├── serializers.py
│   │   ├── views.py                   # CRUD, Submit, Approve, Reject, Return
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── management/commands/
│   │       └── seed_data.py           # Demo users, products, rules seed
│   ├── fulfillment/                  # Multi-Warehouse Auto-Split & Stock
│   │   ├── models.py                  # Warehouse, StockLevel, SplitOrder
│   │   └── ...
│   ├── billing/                      # Subscriptions, Proration, Upsell
│   │   ├── models.py                  # SubscriptionPlan, Invoices, Proration
│   │   └── ...
│   └── portal/                       # Customer Negotiation Portal
│       ├── models.py                  # PortalToken, CounterOffers
│       └── ...
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── router.tsx                 # Client routing & protected routes
│       ├── types.ts                   # Unified TypeScript interfaces
│       ├── api/                       # API clients with JWT injection
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   └── quotations.ts
│       ├── lib/                       # Utilities & React Query client
│       │   ├── utils.ts
│       │   └── queryClient.ts
│       ├── styles/
│       │   └── globals.css            # Dark mode tokens & base styles
│       └── features/
│           ├── shell/                 # Navigation, App Shell, Login, Dashboard
│           ├── pipeline/              # Quotation Pipeline List & Filters
│           ├── quotation-builder/     # CPQ Builder with live risk & margin cards
│           ├── approval/              # Approval Review Queue & Detail Page
│           ├── fulfillment/           # Warehouse Split & Allocation
│           ├── billing/               # Invoicing & Subscription Schedules
│           └── portal/                # Customer Negotiation Portal Screen
├── reference/                         # System diagrams, specifications, progress
│   ├── CONTEXT.md                     # Platform specification & data models
│   ├── PROGRESS.md                    # Feature status & changelog
│   ├── DealFlow360_Architecture.md    # Architectural boundaries
│   ├── DealFlow360_Product_Flow.svg   # 18-stage Product Flow Vector
│   └── DealFlow360_Product_Flow.png   # Product Flow Hi-Res Image
├── docker-compose.yml                 # PostgreSQL 15 service definition
├── .env.example                       # Environment configuration template
├── .gitignore
└── README.md
```

---

## Core Algorithm: Blended Discount Risk Score

The core innovation of DealFlow360 is the **Blended Discount Risk Score**. Rather than relying on simple order-level discount averages, DealFlow360 analyzes individual line items against customer-tier matrices and evaluates cumulative margin slippage:

### Algorithm Breakdown

1. **Per-Line Ceiling Matrix**:
   Each product category has an allowable discount limit per customer tier:
   | Customer Tier | Hardware Max Discount | Software Max Discount | Services Max Discount |
   |---|---|---|---|
   | **Platinum** | 20% | 35% | 15% |
   | **Gold** | 15% | 25% | 10% |
   | **Silver** | 10% | 20% | 5% |
   | **Bronze** | 5% | 10% | 0% |

2. **Hard Line Breach Detection**:
   Any single line exceeding its category ceiling by $> 5\%$ immediately flags the quotation for mandatory Sales Manager approval, regardless of overall deal profitability.

3. **Value-Weighted Margin Leakage**:
   Calculates the weighted excess discount relative to line item revenue:
   $$\text{Weighted Leakage} = \sum_{i=1}^N \left( \frac{\text{Line Total}_i}{\text{Quote Total}} \times \max(0, \text{Discount}_i - \text{Ceiling}_i) \right)$$

4. **Composite Risk Classification**:
   - **Score $0 - 29$ (Low Risk)**: Within permissible bounds. Instant approval.
   - **Score $30 - 59$ (Medium Risk)**: Requires Level-1 sign-off by **Sales Manager**.
   - **Score $60 - 100$ (High Risk)**: Requires dual sign-off: Level-1 **Sales Manager** followed by Level-2 **Finance Director**.

---

## Setup & Installation

### Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher (`npm` 9+)
- **Docker & Docker Compose** (for PostgreSQL)

---

### Step 1: Start PostgreSQL via Docker

```bash
# From the repository root
docker-compose up -d
```

Verify the database container is healthy:
```bash
docker ps
```

---

### Step 2: Backend Setup (Django 5 + DRF)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Apply migrations
python manage.py migrate

# Seed catalog, discount tiers, and demo users
python manage.py seed_data

# Run Django development server
python manage.py runserver
```

The backend will be running at `http://localhost:8000/`.

---

### Step 3: Frontend Setup (React + Vite + TypeScript)

```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will be available at `http://localhost:5173/`.

---

## Seed Accounts & Access Points

| Portal / Screen | URL | Description |
|---|---|---|
| **Frontend Web App** | `http://localhost:5173` | Main DealFlow360 Single-Page Application |
| **Backend REST API** | `http://localhost:8000/api/` | DRF browsable API root |
| **Django Admin Panel** | `http://localhost:8000/admin/` | Direct database administration |

### Demo Credentials

| Role | Username | Password | Permissions & Views |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Full superuser access across all apps & admin panel |
| **Sales Rep** | `elena.vance` | `demo123` | Create quotes, CPQ builder, view pipeline |
| **Sales Manager** | `m.shah` | `demo123` | Approve/Reject Tier-1 discounts, view team pipeline |
| **Finance Director** | `r.iyer` | `demo123` | High-risk Tier-2 approval, financial margin audits |

---

## API Documentation

### Authentication (`/api/auth/`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/login/` | Obtain JWT access and refresh token pair | No |
| `POST` | `/api/auth/refresh/` | Refresh expired access token | No |
| `GET` | `/api/auth/me/` | Fetch active user profile and role | Yes (JWT) |
| `GET` | `/api/auth/products/` | Product catalog with base pricing | Yes (JWT) |
| `GET` | `/api/auth/customers/` | Customer list with tier metadata | Yes (JWT) |

### Quotations & Approvals (`/api/quotations/`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/quotations/` | List all quotations with risk filters | Yes (JWT) |
| `POST` | `/api/quotations/` | Create a new quotation draft | Yes (JWT) |
| `GET` | `/api/quotations/{id}/` | Detailed quotation view with lines & chain | Yes (JWT) |
| `PATCH` | `/api/quotations/{id}/` | Update quote header (customer, notes) | Yes (JWT) |
| `POST` | `/api/quotations/{id}/lines/` | Add line item to draft | Yes (JWT) |
| `PATCH` | `/api/quotations/{id}/lines/{line_id}/` | Update quantity or discount on a line | Yes (JWT) |
| `DELETE`| `/api/quotations/{id}/lines/{line_id}/` | Remove line item from draft | Yes (JWT) |
| `POST` | `/api/quotations/{id}/submit/` | Submit quote; runs blended risk algorithm | Yes (JWT) |
| `POST` | `/api/quotations/{id}/approve/` | Sign off on approval step (Manager / Finance) | Yes (JWT) |
| `POST` | `/api/quotations/{id}/reject/` | Reject quotation with rejection notes | Yes (JWT) |
| `POST` | `/api/quotations/{id}/return/` | Return quotation to rep for revision | Yes (JWT) |
| `GET` | `/api/quotations/{id}/risk-score/` | Diagnostic breakdown of risk metrics | Yes (JWT) |

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
