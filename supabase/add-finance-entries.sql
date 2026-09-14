-- ═══════════════════════════════════════════════════════════════════════════
--  finance_entries — wie is jou wat schuldig, en jij wie? Eén rij per bedrag,
--  amount is signed: positief = die persoon is jou dit schuldig, negatief =
--  jij bent die persoon dit schuldig. Optellen per persoon geeft de nettostand.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists finance_entries (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  person      text not null,
  amount      numeric(10,2) not null,
  description text not null default '',
  date        date not null default ((now() at time zone 'Europe/Amsterdam')::date),
  settled     boolean not null default false,
  created_at  timestamptz default now()
);
create index if not exists finance_entries_user_idx on finance_entries(user_id);

alter table finance_entries enable row level security;
do $$ begin
  create policy "own finance_entries" on finance_entries for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
