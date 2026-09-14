-- ═══════════════════════════════════════════════════════════════════════════
--  week_items.starred toevoegen — items een ster geven in de weekplanning.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table week_items add column if not exists starred boolean default false;
