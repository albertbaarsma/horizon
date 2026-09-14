-- ═══════════════════════════════════════════════════════════════════════════
--  Vaste plekken in de 3D-weergave.
--
--  De indeling wordt deterministisch berekend uit de boom (visie → gebied →
--  doel/project → taak), dus zonder rij hier staat een knoop altijd al op
--  dezelfde plek. Deze tabel bewaart alléén wat jij zelf hebt aangepast:
--  een knoop die je hebt versleept, of een tak die je hebt dichtgeklapt.
--  Leeg = de berekende indeling. Een rij wissen = terug naar die plek.
--
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists graph_layout (
  user_id    uuid not null references profiles(id) on delete cascade,
  -- Knoop-id uit lib/graph-layout.ts: 'v-visie', 'c-<cat>', 'g-<goal>',
  -- 'p-<project>', 't-<task>'. Bewust tekst en geen foreign key: knopen komen
  -- uit vijf verschillende tabellen, en een verdwenen knoop mag hier gerust
  -- een weesrij achterlaten — die wordt simpelweg genegeerd.
  node_id    text not null,
  x          double precision,
  y          double precision,
  z          double precision,
  collapsed  boolean not null default false,
  updated_at timestamptz default now(),
  primary key (user_id, node_id)
);

create index if not exists graph_layout_user_idx on graph_layout(user_id);

alter table graph_layout enable row level security;

drop policy if exists "own graph_layout" on graph_layout;
create policy "own graph_layout" on graph_layout for all using (auth.uid() = user_id);
