# Personal Finance Management System

A full-stack finance tracker built as a learning project for Oracle Autonomous Database (ATP). The app handles double-entry bookkeeping, meaning every transaction has a debit account and a credit account — the same way real accounting works.

The backend is a REST API in Express 5 + TypeScript. The frontend is Vue 3 + TypeScript + Vite. Oracle ATP is the database, connected directly via `oracledb` without an ORM.

---

## What it does

- **Authentication** — register/login with JWT. Passwords hashed with bcrypt.
- **Dashboard** — shows current balance, monthly income, monthly expense, and the 5 most recent transactions. All pulled from live Oracle queries.
- **Transactions** — full CRUD. Creating a transaction inserts a header row in `Transactions` and two rows in `TransactionLines` (one debit, one credit). Deleting cascades to the lines automatically.
- **Analytics & Predictions** — charts for income vs expense over 12 months, expense breakdown by category (donut chart), and a 3-month forecast. The forecast uses Oracle's built-in `REGR_SLOPE` and `REGR_INTERCEPT` aggregate functions — the math runs inside Oracle, not in Node.
- **Offline detection** — the frontend pings `/health` every 30 seconds. If the backend goes down, a banner shows up with a retry button.
- **API access guard** — all `/api/*` routes require a custom `X-App-Request: 1` header. Direct browser navigation to the API URL returns 403.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3, TypeScript, Vite, Pinia, TailwindCSS v4, ApexCharts |
| Backend | Node.js, Express 5, TypeScript, nodemon + ts-node |
| Database | Oracle Autonomous Database (ATP) — Always Free tier |
| Auth | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| Security | helmet, express-rate-limit, custom XSS sanitizer |

---

## Project Structure

```
belajar-oracle/
├── backend/
│   ├── controllers/
│   │   ├── analyticsController.ts   # Oracle REGR_* prediction queries
│   │   ├── authController.ts        # Register / login / JWT
│   │   ├── dashboardController.ts   # Summary stats
│   │   └── expensesController.ts    # Transaction CRUD
│   ├── database/
│   │   ├── schema.sql               # Main DDL (Transactions, Accounts, etc.)
│   │   └── auth_schema.sql          # Users table
│   ├── middleware/
│   │   └── authMiddleware.ts        # JWT verification
│   ├── routes/
│   │   ├── analytics.ts
│   │   ├── auth.ts
│   │   ├── dashboard.ts
│   │   └── expenses.ts
│   ├── db.ts                        # Oracle pool setup + execute wrapper
│   ├── migrate.ts                   # Run schema.sql against Oracle
│   ├── migrateAuth.ts               # Run auth_schema.sql
│   ├── seed.ts                      # Insert fake transactions via faker.js
│   ├── server.ts                    # Express app, middleware order, routes
│   └── .env                         # DB credentials, JWT secret, port
│
└── frontend/
    └── src/
        ├── composables/
        │   └── useBackendStatus.ts  # Health check, shared reactive state
        ├── components/
        │   ├── ExpenseChart.vue
        │   └── OfflineBanner.vue    # Fixed banner when backend is unreachable
        ├── plugins/
        │   └── api.ts               # fetch wrapper, adds X-App-Request header
        ├── router/
        │   └── index.ts
        ├── stores/
        │   ├── auth.ts              # Pinia: token, user, login/register actions
        │   └── finance.ts           # Pinia: dashboard summary, monthly expenses
        └── views/
            ├── Analytics.vue        # Charts + Oracle prediction
            ├── Dashboard.vue        # Overview page
            ├── Login.vue
            ├── Register.vue
            └── Transactions.vue     # CRUD table + modal form
```

---

## Database Schema

The schema uses double-entry bookkeeping. Every transaction has two `TransactionLines` — one debit and one credit.

```
Currencies        → currency codes (USD, IDR, EUR)
AccountTypes      → Asset, Liability, Equity, Revenue, Expense
Categories        → Food, Transport, Rent, etc.
Accounts          → chart of accounts (linked to AccountType)
Transactions      → transaction header (date, description, status)
TransactionLines  → debit/credit lines per transaction
Budgets           → budget by account or category
RecurringSchedules → recurring transaction templates
Users             → app authentication
```

Example: recording a food expense
```
Transactions row:  description="Lunch at warung", date=2026-05-11, status=POSTED
TransactionLine 1: account=Food Expense (type 5), debit_amount=50000, credit_amount=0
TransactionLine 2: account=Main Bank Account (type 1), debit_amount=0, credit_amount=50000
```

---

## Setup

### 1. Oracle Cloud

1. Create an **Autonomous Transaction Processing (ATP)** instance on [Oracle Cloud Free Tier](https://cloud.oracle.com/db/atp).
2. Go to **DB Connection → Download Wallet**, extract the zip somewhere.
3. Set `TNS_ADMIN` in your environment to point to that folder.

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
DB_USER=ADMIN
DB_PASSWORD=YourPassword
TNS_ADMIN=C:\path\to\wallet
JWT_SECRET=your_random_secret_here
FRONTEND_URL=http://localhost:5173
```

Run migrations then seed:
```bash
npm run migrate       # creates all tables from schema.sql
npm run migrate:auth  # creates Users table
npm run seed          # inserts 500 fake transactions
```

Start dev server:
```bash
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:5000/api`. Override with:
```env
# frontend/.env
VITE_API_URL=http://localhost:5000/api
```

---

## API Endpoints

All `/api/*` routes require the header `X-App-Request: 1`. The frontend adds this automatically. Authenticated routes also need `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Backend health check |
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Get JWT token |
| GET | `/api/dashboard/summary` | Yes | Balance, income, expense, recent transactions |
| GET | `/api/expenses` | Yes | List transactions (last 100) |
| POST | `/api/expenses` | Yes | Create transaction |
| PUT | `/api/expenses/:id` | Yes | Update description/date/reference |
| DELETE | `/api/expenses/:id` | Yes | Delete transaction + lines |
| GET | `/api/expenses/accounts` | Yes | List accounts for dropdown |
| GET | `/api/expenses/monthly` | Yes | Monthly expense totals |
| GET | `/api/analytics/chart` | Yes | 12-month data + Oracle regression prediction |
| GET | `/api/analytics/breakdown` | Yes | Expense by category this month |

---

## Prediction Logic

The `/api/analytics/chart` endpoint uses Oracle SQL's `REGR_SLOPE`, `REGR_INTERCEPT`, and `REGR_R2` aggregate functions on 12 months of historical expense data. The Node.js controller then applies `y = slope * x + intercept` to generate 3 months of forward predictions.

```sql
-- simplified version of what runs inside Oracle
WITH merged AS (
  -- monthly expense totals with row numbers as x-axis
  SELECT TO_CHAR(transaction_date, 'YYYY-MM') AS month,
         ROW_NUMBER() OVER (ORDER BY ...) AS rn,
         SUM(debit_amount) AS expense
  FROM ...
),
regression AS (
  SELECT REGR_SLOPE(expense, rn)     AS slope,
         REGR_INTERCEPT(expense, rn) AS intercept,
         REGR_R2(expense, rn)        AS r_squared
  FROM merged
)
SELECT m.*, r.slope, r.intercept, r.r_squared
FROM merged m, regression r
```

R² value is shown in the UI as model confidence. Higher = more predictable spending pattern.

---

## Security Notes

- All `/api/*` routes check for `X-App-Request: 1` header. Without it, the server returns 403.
- CORS is restricted to `FRONTEND_URL` only.
- Rate limit: 100 requests per 15 minutes per IP on all API routes.
- Input sanitization: custom middleware escapes `<` and `>` in request bodies (compatible with Express 5, unlike `xss-clean` which breaks on Express 5's read-only `req.body`).
- `express-mongo-sanitize` was intentionally removed — same reason, incompatible with Express 5.

---

## Known Limitations

- **Amount is immutable after creation** — updating a transaction only changes description, date, and reference number. Changing the amount would require voiding and re-creating (proper accounting behavior, but not implemented in UI yet).
- **Single currency** — all transactions are recorded in USD. Multi-currency tables exist in schema but aren't used.
- **No user-scoped accounts** — the chart of accounts is global, not per-user. For a single-user app this is fine.
- Seeding 500 transactions takes about 60 seconds due to Oracle ATP network latency (each insert is a round trip). Batch inserts would be faster but the seed script runs infrequently so it's fine.
