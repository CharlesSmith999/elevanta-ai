# Local setup

## 1. Create Supabase project

Create one Supabase project for Elevanta AI. In its SQL editor, run the migration in `supabase/migrations/202607280001_foundation.sql`.

## 2. Configure environment

Copy `.env.example` to `.env.local` and add the Supabase URL and keys. Never commit this file.

## 3. Install and run

```bash
pnpm install
pnpm dev:web
pnpm dev:api
```

The web preview runs at `http://localhost:5173` and the API health check runs at `http://localhost:3001/health`.

## 4. Initial production setup

- Import the Phase 3 workbook only through the future staging flow; do not import directly into active tables.
- Create the first workspace and Shariq’s admin account.
- Add the agreed Marketing and Sales teams before inviting agents.
- Set Vercel environment variables for the web and API deployments.
