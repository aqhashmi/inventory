# InvoFlow — Invoicing & Inventory Management

A full-stack, multi-tenant invoicing and inventory app built with the Next.js
App Router. It covers two modules end-to-end: **Inventory Management** and
**Invoicing**, plus a reporting **Dashboard** — a focused, QuickBooks/Zoho-style
slice.

## Tech stack

| Concern         | Choice                                            |
| --------------- | ------------------------------------------------- |
| Framework       | Next.js 14 (App Router, Server Components/Actions) |
| Language        | TypeScript (strict)                               |
| Styling         | Tailwind CSS + shadcn/ui (Radix primitives)       |
| Database / ORM  | PostgreSQL + Prisma                               |
| Auth            | NextAuth / Auth.js v5 (Credentials, JWT sessions) |
| Validation      | Zod (shared client + server schemas)              |
| Forms           | React Hook Form                                   |
| Tables          | TanStack Table                                     |
| Charts          | Recharts                                          |
| PDF             | @react-pdf/renderer                               |
| Toasts          | Sonner                                            |

## Features

**Auth & multi-tenancy**
- Email/password sign-up & login; signing up creates an `Organization` and its
  first `OWNER` user together.
- Every tenant row carries an `organizationId`; **all queries are org-scoped**
  and mutations re-scope with `where: { id, organizationId }`.
- Route protection via middleware (`src/middleware.ts`).

**Inventory**
- Product CRUD: SKU, name, description, category, unit/cost price, qty on hand,
  reorder level, unit of measure, tax rate, active flag.
- Stock adjustment log (signed changes with type, reason, before/after balance,
  and who made the change). Low-stock highlighting at/below reorder level.
- Categories CRUD, search/filter/sort, and **CSV import** (upsert by SKU,
  auto-creating categories) with a downloadable template.

**Invoicing**
- Customer CRUD with billing & shipping addresses.
- Invoice builder: pull line items from inventory (auto-fills price + tax) or
  enter custom lines; live subtotal/discount/tax/total.
- Sequential per-org numbering (atomic counter), due dates & payment terms.
- Statuses: Draft → Sent → Paid / Overdue / Cancelled. **Stock is deducted when
  an invoice is finalized** and **restored when it's cancelled or deleted**.
- Record full/partial payments (auto-marks Paid); PDF generation & download.

**Dashboard**
- Summary cards (total revenue, outstanding, paid this month, low-stock count),
  6-month revenue chart, recent invoices, recent stock movements, top sellers.

## Project structure

```
prisma/
  schema.prisma            # models + enums + indexes
  migrations/0_init/       # initial SQL migration
  seed.ts                  # sample org, products, customers, invoices
src/
  middleware.ts            # route protection
  app/
    (auth)/                # login, register (route group)
    (dashboard)/           # dashboard, inventory, invoices, customers,
                           #   categories, settings (protected route group)
    api/
      auth/[...nextauth]/  # Auth.js handler
      invoices/[id]/pdf/   # PDF export (Node runtime)
  components/
    ui/                    # shadcn primitives
    inventory/ invoices/ customers/ dashboard/ settings/ layout/
  lib/
    db.ts                  # Prisma singleton
    auth.ts auth.config.ts # Auth.js (Node + edge-safe split)
    session.ts             # requireOrg() tenant helper
    calculations.ts        # invoice money math (shared client/server)
    csv.ts pdf/            # CSV parsing, PDF document
    actions/               # server actions (all mutations)
    validations/           # Zod schemas
```

## Getting started

### 1. Prerequisites
- Node.js 18.18+ (tested on Node 24)
- A PostgreSQL database. Any works — a free [Supabase](https://supabase.com) or
  [Neon](https://neon.tech) project, or a local install.

### 2. Install
```bash
npm install
```

### 3. Configure environment
Copy the example and fill in your values:
```bash
cp .env.example .env
```
- `DATABASE_URL` / `DIRECT_URL` — your Postgres connection string(s). If your
  provider has a connection pooler (Supabase/Neon), use the pooled URL for
  `DATABASE_URL` and the direct URL for `DIRECT_URL`. Otherwise set both equal.
- `AUTH_SECRET` — generate one with `openssl rand -base64 32`.

### 4. Set up the database
Apply the schema (creates all tables):
```bash
npm run db:migrate        # prisma migrate dev (creates/updates your DB)
# or, against an existing DB:  npx prisma migrate deploy
```

### 5. Seed sample data (optional but recommended)
```bash
npm run db:seed
```
This creates a demo organization with products, customers, and invoices.

**Demo login:**
- Email: `demo@invoflow.app`
- Password: `password123`

### 6. Run
```bash
npm run dev
```
Open http://localhost:3000 — you'll be redirected to the login page. Sign in
with the demo account, or register a new organization.

## Useful scripts
| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | `prisma generate` + production build  |
| `npm run db:migrate`| Create/apply migrations (dev)         |
| `npm run db:seed`   | Seed sample data                      |
| `npm run db:studio` | Open Prisma Studio                    |
| `npm run db:reset`  | Drop, re-migrate, and re-seed         |

## Key design decisions

- **Tenant isolation by convention + `requireOrg()`.** Each request resolves the
  caller's `organizationId` from the JWT session; every read filters by it and
  every write uses `updateMany/deleteMany` scoped by `{ id, organizationId }` so
  a tenant can never touch another tenant's row.
- **Auth split for the edge.** `auth.config.ts` holds the edge-safe config
  (used by middleware); `auth.ts` adds the Credentials provider (bcrypt + Prisma,
  Node only). JWT session strategy is used because Credentials auth needs it.
- **Money math lives in one place** (`src/lib/calculations.ts`) and is reused by
  the invoice form (live preview) and the server actions (authoritative
  persistence), so totals can't drift. Money is stored as `Decimal(12,2)` and
  serialized to numbers at the server/client boundary.
- **Stock is a side effect of invoice lifecycle.** Finalizing deducts stock and
  writes `SALE` adjustments; cancelling/deleting writes `RETURN` adjustments and
  restores it. Only **draft** invoices are editable — finalized invoices are
  immutable to keep the stock ledger consistent. Overselling is allowed (stock
  may go negative for back-orders) and surfaces in inventory.
- **Sequential invoice numbers** are produced by atomically incrementing a
  per-org counter inside the create transaction (race-safe).
- **Server Actions for all mutations**, each validated with Zod; field errors are
  returned to forms and rendered inline. Reads happen in Server Components.

## Notes & limitations
- "Overdue" is a *derived* display status (a Sent invoice past its due date) and
  is not persisted; stored status stays `SENT` until paid/cancelled.
- Logo upload is a URL field (no file storage integration).
- Single user per organization flow on sign-up (the schema supports more).
