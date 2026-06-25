# Database setup (Supabase)

This project uses a Supabase-hosted PostgreSQL database, accessed directly via
Prisma. **No secrets are stored in this repo** — connection strings and
passwords live only in your local `.env` (which is gitignored).

## Project

| Field        | Value                              |
| ------------ | ---------------------------------- |
| Provider     | Supabase (PostgreSQL 17)           |
| Project name | `invoflow`                         |
| Project ref  | `alibfgwjbnqaujbskzmx`             |
| Region       | `ap-northeast-2` (Seoul)           |
| Dashboard    | https://supabase.com/dashboard/project/alibfgwjbnqaujbskzmx |

The schema was applied from [`prisma/migrations/0_init`](../prisma/migrations/0_init/migration.sql).

## Connecting Prisma to Supabase

Supabase exposes two connection modes through its pooler. Prisma needs both:

- **`DATABASE_URL`** → Transaction pooler (port **6543**) for the app at runtime.
- **`DIRECT_URL`** → Session pooler (port **5432**) for `prisma migrate`.

Get the strings from the dashboard: **Connect → Connection string**. Reset the
DB password under **Project Settings → Database** if you don't have it.

`.env` (local only — never commit):

```dotenv
DATABASE_URL="postgresql://postgres.alibfgwjbnqaujbskzmx:<PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.alibfgwjbnqaujbskzmx:<PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
AUTH_SECRET="<output of: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
```

## Apply schema & seed

```bash
# If the schema was already applied (e.g. via the Supabase dashboard/MCP),
# mark the migration as applied so Prisma's history stays in sync:
npx prisma migrate resolve --applied 0_init

# Otherwise, apply migrations normally:
npx prisma migrate deploy

# Seed demo data (org, products, customers, invoices):
npm run db:seed
```

Demo login after seeding: `demo@invoflow.app` / `password123`.

## Security note — Row Level Security (RLS)

RLS is currently **disabled** on all tables. This app connects as the database
owner via Prisma and does **not** use the Supabase anon/REST API, so it is
unaffected by RLS. However, Supabase auto-exposes a REST API on the anon key; to
lock that down you can enable RLS (the owner connection still bypasses it):

```sql
ALTER TABLE public."Organization"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StockAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customer"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invoice"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment"         ENABLE ROW LEVEL SECURITY;
```
