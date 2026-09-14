-- ═══════════════════════════════════════════════════════════════════════════
--  Gebruik meten: welke tabs en knoppen gebruik je echt, en wat blijft liggen?
--
--  Bewust karig: alleen een sleutel van wat je opende en hoe lang. Geen
--  taaknamen, geen dagboektekst, geen IP, geen derde partij. Alles blijft in je
--  eigen database, achter dezelfde regel als de rest: je ziet alleen je eigen
--  rijen.
--
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists usage_events (
  id         bigserial primary key,
  user_id    uuid references profiles(id) on delete cascade,
  -- 'tab' = tabblad bekeken, 'feature' = onderdeel gebruikt
  kind       text not null,
  -- sleutel van het tabblad of onderdeel, bijv. 'week' of 'controle-paneel'
  target     text not null,
  -- alleen bij 'tab': hoe lang hij openstond, in seconden
  seconds    int,
  created_at timestamptz default now()
);

create index if not exists usage_events_user_idx on usage_events(user_id, created_at desc);
create index if not exists usage_events_target_idx on usage_events(user_id, kind, target);

alter table usage_events enable row level security;
do $$ begin
  create policy "own usage_events" on usage_events for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Meten mag altijd uit. Standaard aan, want zonder meting geen verbetering —
-- maar het blijft jouw keuze.
alter table profiles add column if not exists usage_tracking boolean default true;

-- Waar de app opent, en welke tabs je niet wil zien. Zo kan een suggestie uit
-- de meting ook echt toegepast worden.
alter table profiles add column if not exists start_tab text;
alter table profiles add column if not exists hidden_tabs text[] default '{}';
