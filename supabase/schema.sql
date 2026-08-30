-- Aoi-Rika finance tracker: Supabase schema
-- Run this in the Supabase SQL editor for a fresh project.

create extension if not exists "pgcrypto";

-- Every table follows the same sync-friendly shape:
--   id uuid (client-generated so it's stable across offline writes)
--   user_id -> auth.users
--   updated_at (sync watermark)
--   deleted_at (soft delete / tombstone, so deletes replicate too)

create table if not exists accounts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text, -- e.g. BPI, GoTyme, Maya, Cash - free text, optional
  kind text not null check (kind in ('income', 'spending', 'savings', 'other')),
  starting_balance bigint not null default 0, -- centavos
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists merchants (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null, -- free text: Restaurant, Grocery, Online Shop, Subscription, Grab Food, or anything the user types
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount bigint not null check (amount > 0), -- centavos, always positive; direction comes from from/to
  occurred_at timestamptz not null default now(),
  from_account_id uuid references accounts(id),
  to_account_id uuid references accounts(id),
  category_id uuid references categories(id),
  merchant_id uuid references merchants(id), -- expenses only: which establishment
  note text,
  is_reimbursement boolean not null default false,
  reimbursement_id uuid, -- FK added below, after reimbursements exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_accounts_check check (
    (type = 'income' and from_account_id is null and to_account_id is not null) or
    (type = 'expense' and from_account_id is not null and to_account_id is null) or
    (type = 'transfer' and from_account_id is not null and to_account_id is not null)
  )
);

create table if not exists reimbursements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('owed_to_me', 'i_owe')),
  counterparty_name text not null,
  amount bigint not null check (amount > 0), -- centavos, original amount
  description text,
  status text not null default 'outstanding' check (status in ('outstanding', 'settled', 'written_off')),
  created_transaction_id uuid references transactions(id),
  settlement_transaction_id uuid references transactions(id),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table transactions
  add constraint transactions_reimbursement_fk
  foreign key (reimbursement_id) references reimbursements(id);

create table if not exists savings_goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_id uuid not null references accounts(id),
  target_amount bigint not null check (target_amount > 0), -- centavos
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists goal_contributions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references savings_goals(id) on delete cascade,
  transaction_id uuid not null references transactions(id) on delete cascade,
  amount bigint not null, -- centavos, signed: positive = contribution, negative = withdrawal for the goal
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists user_settings (
  id uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  week_start_day smallint not null default 1, -- 0=Sun .. 6=Sat, default Monday
  currency text not null default 'PHP',
  safety_net_auto_months numeric not null default 1.0,
  safety_net_override_amount bigint, -- centavos; null = use auto calculation
  allowance_amount bigint, -- centavos; null = no allowance pacing configured
  allowance_period text not null default 'weekly' check (allowance_period in ('weekly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for the sync watermark pull (per-user, changed-since queries)
create index if not exists idx_accounts_user_updated on accounts(user_id, updated_at);
create index if not exists idx_categories_user_updated on categories(user_id, updated_at);
create index if not exists idx_merchants_user_updated on merchants(user_id, updated_at);
create index if not exists idx_transactions_user_updated on transactions(user_id, updated_at);
create index if not exists idx_reimbursements_user_updated on reimbursements(user_id, updated_at);
create index if not exists idx_goals_user_updated on savings_goals(user_id, updated_at);
create index if not exists idx_contributions_user_updated on goal_contributions(user_id, updated_at);

-- Row Level Security: every row is only visible/writable by its owner
alter table accounts enable row level security;
alter table categories enable row level security;
alter table merchants enable row level security;
alter table transactions enable row level security;
alter table reimbursements enable row level security;
alter table savings_goals enable row level security;
alter table goal_contributions enable row level security;
alter table user_settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['accounts','categories','merchants','transactions','reimbursements','savings_goals','goal_contributions','user_settings']
  loop
    execute format('create policy "%1$s_owner_select" on %1$s for select using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_owner_insert" on %1$s for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_owner_update" on %1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_owner_delete" on %1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
