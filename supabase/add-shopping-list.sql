-- ═══════════════════════════════════════════════════════════════════════════
--  shopping_items — een simpel boodschappenlijstje: tekst + afgevinkt.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists shopping_items (
  id         bigserial primary key,
  user_id    uuid references profiles(id) on delete cascade,
  text       text not null,
  done       boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists shopping_items_user_idx on shopping_items(user_id);

alter table shopping_items enable row level security;
do $$ begin
  create policy "own shopping_items" on shopping_items for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
