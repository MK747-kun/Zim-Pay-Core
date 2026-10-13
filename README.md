```markdown
# ⚡ zim-pay-core

> **Unified Payment Routing, FX Rate-Slippage Lock, and ACID Double-Entry Reconciliation Gateway for Zimbabwe (USD & ZiG).**

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1.svg?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://docker.com)

---

## 📸 Executive Dashboard Preview


```

┌──────────────────────────────────────────────────────────────────────────────────┐
│  ZIM-PAY-CORE v1.0.4-PROD               RBZ Rate: 1 USD = 26.8500 ZiG [Locked]   │
├──────────────────────────────────────────────────────────────────────────────────┤
│  SETTLED USD VAULT         SETTLED ZIG VAULT        RATE LOCK GUARANTEE          │
│  $14,250.80                ZiG 382,450.00           1 USD = 26.8500 ZiG          │
│  Available: $165.00        Gold-Backed              TTL: 10m window | +250 bps   │
├──────────────────────────────────────────────────────────────────────────────────┤
│  ACTIVE PAYMENT RAILS MONITOR                       END-OF-DAY RECONCILIATION    │
│  • EcoCash USSD Push     [2400ms] OPERATIONAL       Settled USD:    $165.00      │
│  • InnBucks QR           [950ms]  OPERATIONAL       Settled ZiG:    ZiG 850.00   │
│  • Zimswitch ZIPIT       [1200ms] OPERATIONAL       Slippage Loss:  $0.00        │
│  • NetOne OneMoney       [4800ms] DEGRADED          [DOWNLOAD EOD PDF STATEMENT] │
└──────────────────────────────────────────────────────────────────────────────────┘

```

---

## 📌 Problem & Solution

### The Problem
Merchants and online vendors operating in Zimbabwe face significant friction:
1. **Payment System Fragmentation:** Customers pay across competing channels (EcoCash, InnBucks, Zimswitch ZIPIT, OneMoney, O'mari, cards) requiring merchants to manually check multiple dashboards or accounts.
2. **FX Currency Volatility:** Parallel market fluctuations between USD and ZiG during multi-step checkout flows lead to exchange rate slippage and arbitrage losses.
3. **MNO USSD Downtime:** Mobile network operator timeouts often cause cart abandonments during peak transaction hours.
4. **Manual Bookkeeping:** Reconciling dual-currency balances without a double-entry ledger leads to balance discrepancies and auditing headaches.

### The Solution
`zim-pay-core` unifies these payment channels into a single open-core backend engine and embedded React checkout modal:
- **10-Minute FX Rate Lock:** Locks exchange rates at checkout initiation with configurable spread (+250 bps) and auto-rejection if market variance exceeds slippage tolerance.
- **Dynamic Rail Failover:** Automatically presents backup rails (e.g., InnBucks Express QR or ZIPIT interbank details) if a primary MNO experience latency spikes (>2500ms).
- **Double-Entry Ledger:** ACID-compliant ledger recording every credit, debit, escrow holds, and platform fee breakdown.
- **Automated Messaging:** Dispatches instant WhatsApp receipts via Meta Cloud API and delivers cryptographically stamped daily PDF reconciliation statements to merchants via Resend API.

---

## 🏗️ Architecture & Component Flow


```

```
                           ┌───────────────────────────┐
                           │  Merchant Frontend / PWA │
                           └─────────────┬─────────────┘
                                         │ HTTPS / REST
                                         ▼
                           ┌───────────────────────────┐
                           │     FastAPI Core Engine   │
                           └──────┬─────────────┬──────┘
                                  │             │
          ┌───────────────────────┘             └────────────────────────┐
          ▼                                                              ▼

```

┌───────────────────────────┐                                  ┌───────────────────────────┐
│ PostgreSQL (ACID Ledger)  │                                  │   Celery Async Worker     │
├───────────────────────────┤                                  ├───────────────────────────┤
│ • merchants               │                                  │ • Meta WhatsApp Cloud API │
│ • exchange_rates          │                                  │ • Resend PDF Email Engine │
│ • transactions            │                                  │ • Webhook Retry Queue     │
│ • ledger_entries          │                                  └─────────────┬─────────────┘
└───────────────────────────┘                                                │
▼
┌───────────────────────────┐
│  Redis Broker / KeyStore  │
└───────────────────────────┘

```

---

## 🚀 Quickstart Guide (Docker Compose)

The fastest way to spin up `zim-pay-core` locally (including PostgreSQL, Redis, Celery, Backend API, and Frontend Dashboard) is using Docker Compose.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24.0+)
- [Git](https://git-scm.com/)

### 1. Clone Repository & Setup Environment
```bash
git clone [https://github.com/your-username/zim-pay-core.git](https://github.com/your-username/zim-pay-core.git)
cd zim-pay-core
cp .env.example .env

```

### 2. Launch Services

```bash
docker-compose up --build -d

```

### 3. Verify Health

* **Merchant Admin Dashboard:** `http://localhost:5173`
* **FastAPI Documentation (Swagger):** `http://localhost:8000/docs`
* **Health Check Endpoint:** `http://localhost:8000/health`

---

## 🛠️ Manual Installation (Local Development)

### Backend Setup (FastAPI)

1. **Navigate to backend & create virtual environment:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

```


2. **Install dependencies:**
```bash
pip install -r requirements.txt

```


3. **Initialize Database Migrations:**
```bash
python -m app.db.init_db

```


4. **Start API Server:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

```


5. **Start Celery Worker (in a separate terminal):**
```bash
celery -A app.workers.celery_app worker --loglevel=info

```



### Frontend Setup (React + Vite)

1. **Navigate to frontend & install packages:**
```bash
cd frontend
npm install

```


2. **Start Vite development server:**
```bash
npm run dev

```



---

## ⚙️ Environment Configuration (`.env`)

Create a `.env` file in the root directory:

```env
# Server Configuration
PROJECT_NAME="zim-pay-core"
ENVIRONMENT="development"
SECRET_KEY="super-secret-production-key-change-me"
API_V1_STR="/api/v1"

# Database Configuration
POSTGRES_SERVER="localhost"
POSTGRES_PORT="5432"
POSTGRES_USER="zimpay"
POSTGRES_PASSWORD="zimpay_password"
POSTGRES_DB="zimpay_ledger"
DATABASE_URL="postgresql://zimpay:zimpay_password@localhost:5432/zimpay_ledger"

# Redis Cache & Celery Queue
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_URL="redis://localhost:6379/0"

# RBZ Interbank & Exchange Rate Defaults
DEFAULT_BASE_CURRENCY="USD"
DEFAULT_TARGET_CURRENCY="ZIG"
DEFAULT_INTERBANK_RATE=26.2000
DEFAULT_SPREAD_BPS=250
RATE_LOCK_TTL_SECONDS=600

# WhatsApp Cloud API (Meta Developer Console)
WHATSAPP_PHONE_NUMBER_ID="109283749281723"
WHATSAPP_BUSINESS_ACCOUNT_ID="392019283749201"
WHATSAPP_ACCESS_TOKEN="EAAG..."

# Email Dispatcher (Resend API)
RESEND_API_KEY="re_123456789_abcdefg"
SENDER_EMAIL="receipts@yourdomain.co.zw"

```

---

## 📂 Project Directory Structure

```text
zim-pay-core/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── checkout.py        # Charge initiation & rate locks
│   │   │       │   ├── webhooks.py        # MNO notification webhooks
│   │   │       │   ├── reconciliation.py  # Double-entry ledger queries
│   │   │       │   └── messaging.py       # WhatsApp/Email dispatch rules
│   │   ├── core/
│   │   │   ├── config.py                  # App environment variables
│   │   │   └── security.py                # Webhook HMAC verification
│   │   ├── db/
│   │   │   ├── base.py                    # SQLAlchemy ORM models
│   │   │   └── init_db.py                 # Initial seed & table creation
│   │   ├── services/
│   │   │   ├── rate_guard.py              # FX lock & slippage protection
│   │   │   ├── failover_engine.py         # MNO latency monitor & fallback
│   │   │   └── ledger_service.py          # ACID journal entry creation
│   │   └── workers/
│   │       ├── celery_app.py              # Task queue configuration
│   │       └── tasks.py                   # Async WhatsApp & Email dispatchers
│   ├── tests/                             # Pytest unit & integration suites
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ZimPayModal.tsx            # Embedded multi-currency checkout
│   │   │   ├── RateLockTimer.tsx          # Real-time TTL countdown ring
│   │   │   ├── RailMonitorCard.tsx        # Live latency & failover visualizer
│   │   │   └── AuditCertificate.tsx       # EOD stamped PDF view
│   │   ├── pages/
│   │   │   └── Dashboard.tsx              # Executive Obsidian/Amber UI
│   │   ├── services/
│   │   │   └── api.ts                     # Axios client & WebSocket streams
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── schema.sql                             # Raw PostgreSQL DDL file
└── README.md

```

---

## 💻 API & SDK Integration Examples

### 1. Initiate Multi-Currency Checkout (Python Backend API)

`POST /api/v1/checkout/create`

**Request Body:**

```json
{
  "merchant_id": "mch_harare_prime_01",
  "amount": 15.50,
  "currency": "USD",
  "customer_phone": "+263773998877",
  "customer_email": "rudo@example.co.zw",
  "preferred_provider": "ECOCASH"
}

```

**Response (201 Created):**

```json
{
  "checkout_session_id": "cs_live_984105a8",
  "status": "PENDING",
  "locked_fx_rate": 26.8500,
  "equivalent_zig_amount": 416.18,
  "rate_lock_expires_at": "2026-10-13T11:28:00Z",
  "assigned_rail": "ECOCASH",
  "fallback_rails_available": ["INNBUCKS", "ZIPIT"]
}

```

### 2. Embed Checkout Component (React Frontend SDK)

```tsx
import React from 'react';
import { ZimPayCheckout } from 'zim-pay-core-react';

export const StorefrontCheckout = () => {
  return (
    <ZimPayCheckout amount="{15.50}" apiKey="zpk_live_8f39b201a4e56789" currency="USD" customerPhone="+263773998877" onSuccess="{(transaction)"> {
        console.log('Payment Settled:', transaction.reference);
        alert(`Receipt dispatched to ${transaction.customer_phone} via WhatsApp!`);
      }}
      onFailoverTriggered={(fallbackRail) => {
        console.warn(`Primary MNO delayed. Switched to ${fallbackRail}`);
      }}
    />
  );
};

```

---

## 🗄️ PostgreSQL Database Schema (DDL)

```sql
-- 1. Merchants Table
CREATE TABLE merchants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(128) UNIQUE NOT NULL,
    webhook_url VARCHAR(512),
    notification_email VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(32) NOT NULL,
    balance_usd NUMERIC(18, 4) DEFAULT 0.0000,
    balance_zig NUMERIC(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Exchange Rates & Slippage Locks (10-Minute TTL)
CREATE TABLE exchange_rates (
    id VARCHAR(64) PRIMARY KEY,
    base_currency VARCHAR(8) NOT NULL,
    target_currency VARCHAR(8) NOT NULL,
    rate NUMERIC(18, 6) NOT NULL,
    spread_bps INT DEFAULT 250,
    slippage_tolerance_pct NUMERIC(5, 2) DEFAULT 2.00,
    locked_rate_ttl_seconds INT DEFAULT 600,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Transactions Table (Dynamic Fallback Routing Enabled)
CREATE TABLE transactions (
    id VARCHAR(64) PRIMARY KEY,
    checkout_session_id VARCHAR(128) NOT NULL,
    merchant_id VARCHAR(64) REFERENCES merchants(id),
    provider VARCHAR(32) NOT NULL, -- 'ECOCASH' | 'INNBUCKS' | 'ZIPIT' | 'ONEMONEY'
    fallback_provider VARCHAR(32),
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(8) NOT NULL,   -- 'USD' | 'ZIG'
    rate_applied NUMERIC(18, 6) NOT NULL,
    status VARCHAR(32) NOT NULL,    -- 'SUCCESS' | 'FALLBACK_TRIGGERED' | 'FAILED'
    customer_phone VARCHAR(32) NOT NULL,
    customer_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ACID Double-Entry Ledger Table
CREATE TABLE ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) REFERENCES transactions(id),
    merchant_id VARCHAR(64) REFERENCES merchants(id),
    account_type VARCHAR(32) NOT NULL, -- 'ESCROW_HOLD' | 'MERCHANT_SETTLEMENT' | 'PLATFORM_FEE'
    debit NUMERIC(18, 4) DEFAULT 0.0000,
    credit NUMERIC(18, 4) DEFAULT 0.0000,
    currency VARCHAR(8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

```

---

## 🧪 Running Unit & Integration Tests

Execute backend test suites for rate locking calculations, double-entry balance verification, and webhook signature verification:

```bash
cd backend
pytest -v --cov=app tests/

```

To run frontend component tests:

```bash
cd frontend
npm run test

```

---

## 📄 License

This project is open-source software licensed under the [MIT License](https://www.google.com/search?q=LICENSE).

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing new failover rail'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

```

```
