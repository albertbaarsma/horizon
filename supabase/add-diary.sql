-- ═══════════════════════════════════════════════════════════════════════════
--  Dagboek — vrije verhalen/entries, los van prestaties en verbeterpunten.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists diary_entries (
  id         bigserial primary key,
  user_id    uuid references profiles(id) on delete cascade,
  date       date not null default ((now() at time zone 'Europe/Amsterdam')::date),
  text       text not null,
  created_at timestamptz default now()
);

create index if not exists diary_entries_user_idx on diary_entries(user_id, date desc, id desc);

alter table diary_entries enable row level security;
do $$ begin
  create policy "own diary_entries" on diary_entries for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
