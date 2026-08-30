# Aoi-Rika Finance

An offline-first personal finance tracker, installable as a PWA on phone and laptop, that does the weekly mental math for you: safe-to-spend, spending-pace nudges, a fronted-money/IOU tracker kept separate from your own spending, and multiple named savings goals with projected completion dates.

## Stack

- React + TypeScript + Vite
- Dexie (IndexedDB) as the local source of truth - the app always reads/writes locally first
- Supabase (Postgres + Auth) as the sync backend, via an outbox-style push/pull sync engine
- `vite-plugin-pwa` for installability and offline caching

The app runs fully offline in **local-only mode** with no setup: if Supabase env vars aren't set, all data lives only in the browser's IndexedDB. Add the env vars below to sync across devices.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project's URL + anon key
```

Run `supabase/schema.sql` in your Supabase project's SQL editor to create the tables, indexes, and row-level-security policies.

```bash
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run lint
```

## Data model

See `supabase/schema.sql` for the authoritative schema and `src/lib/types.ts` for the TypeScript mirror. In short:

- **accounts** - your buckets (Payroll / Daily Savings-Expenses / Personal Savings by default, plus any you add), each tagged `income` / `spending` / `savings` / `other`.
- **categories** - Food / Transportation / Shopping by default, extensible.
- **transactions** - the single ledger. Every income, expense, and transfer (including between your own accounts) is one row; amounts are integer centavos.
- **reimbursements** - money-in-transit, tracked separately from your own spending. `owed_to_me` requires a real outflow transaction at creation time; `i_owe` doesn't create a transaction until it's actually paid. Both link to a settlement transaction once paid back, and can be written off if never repaid.
- **savings_goals** + **goal_contributions** - multiple named goals against an account, each contribution a signed amount so one transfer can split across several goals.
- **user_settings** - week start day, currency, and the safety-net basis (auto-computed from trailing spend, or a manual override).

## Calculation logic

`src/lib/calc/` holds the pure functions behind every number the app shows:

- `weekly.ts` - safe-to-spend (account balance minus safety net minus outstanding IOUs you owe) and the plain-language pacing nudges (this week's category spend vs. a day-prorated trailing 4-week average).
- `goals.ts` - goal progress, a projected completion date from actual contribution pace, and a flag for when a goal's required pace would dip into your safety net.
- `balances.ts` / `reimbursements.ts` - account balances and outstanding-reimbursement totals.
