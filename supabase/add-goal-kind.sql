-- ═══════════════════════════════════════════════════════════════════════════
--  Hobbydoelen naast 'echte' doelen. Een hobbydoel is een doel — het mag
--  afgevinkt worden en levert een prestatie op — maar het hoort niet mee te
--  tellen in je voortgangscijfer. Anders verwatert "66% van mijn doelen
--  gehaald" zodra je een spel wil uitspelen.
--
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table goals add column if not exists kind text not null default 'doel';

-- Alleen de twee soorten die de app kent
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'goals_kind_check') then
    alter table goals add constraint goals_kind_check check (kind in ('doel', 'hobby'));
  end if;
end $$;

create index if not exists goals_kind_idx on goals (user_id, kind);
