-- ═══════════════════════════════════════════════════════════════════════════
--  finance_transactions — regels uit maandelijkse bankafschriften (PDF-upload,
--  AI-geëxtraheerd en gecategoriseerd). amount is signed: positief = inkomen,
--  negatief = uitgave. Los van finance_entries (dat is de "wie is wie
--  schuldig"-ledger, dit is de bank-transactiegeschiedenis). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists finance_transactions (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  date        date not null,
  description text not null default '',
  amount      numeric(10,2) not null,
  category    text not null default 'Overig',
  source      text,
  created_at  timestamptz default now()
);
create index if not exists finance_transactions_user_date_idx on finance_transactions(user_id, date desc);

alter table finance_transactions enable row level security;
do $$ begin
  create policy "own finance_transactions" on finance_transactions for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
