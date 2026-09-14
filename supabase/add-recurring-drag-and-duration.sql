-- ═══════════════════════════════════════════════════════════════════════════
--  Herhaaltaken: verplaatsbaar maken + duur voor urenberekening.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. week_items.moved_from — als een herhaling deze week naar een andere dag
--    gesleept wordt, onthoudt dit van welke dag hij kwam. Daarmee kan het
--    weekoverzicht de originele dag overslaan (geen dubbele weergave), terwijl
--    het herhaalpatroon (recurring_tasks.days) onaangeroerd blijft: volgende
--    week staat de taak weer op zijn vaste dag.
alter table week_items add column if not exists moved_from date;
create index if not exists week_items_moved_from_idx on week_items(user_id, recur_id, moved_from);

-- 2. recurring_tasks.duration_min — geschatte duur per keer, voor het
--    urenoverzicht per week (hoeveel tijd kosten mijn routines?).
alter table recurring_tasks add column if not exists duration_min int;
