-- ═══════════════════════════════════════════════════════════════════════════
--  Zakgeld voor Sam en Robin. allowance_entries is een signed ledger (net als
--  finance_entries/finance_transactions): positief = geld erbij (zakgeld,
--  cadeau), negatief = uitgegeven. Saldo per kind = som van hun entries.
--  allowance_goals zijn spaardoelen met optioneel een link en een streefbedrag.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists allowance_entries (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  child       text not null,
  amount      numeric(10,2) not null,
  description text not null default '',
  date        date not null default ((now() at time zone 'Europe/Amsterdam')::date),
  created_at  timestamptz default now()
);
create index if not exists allowance_entries_user_child_idx on allowance_entries(user_id, child, date desc);

create table if not exists allowance_goals (
  id            bigserial primary key,
  user_id       uuid references profiles(id) on delete cascade,
  child         text not null,
  title         text not null,
  url           text,
  target_amount numeric(10,2),
  achieved      boolean not null default false,
  created_at    timestamptz default now()
);
create index if not exists allowance_goals_user_child_idx on allowance_goals(user_id, child);

alter table allowance_entries enable row level security;
do $$ begin
  create policy "own allowance_entries" on allowance_entries for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

alter table allowance_goals enable row level security;
do $$ begin
  create policy "own allowance_goals" on allowance_goals for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
