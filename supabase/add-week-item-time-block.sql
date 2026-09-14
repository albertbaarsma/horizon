-- ═══════════════════════════════════════════════════════════════════════════
--  week_items.time_block toevoegen
--  De app-code (WeekItem.time_block, addWeekItem, "over 5 minuten"-meldingen,
--  getimede dagplanning) gebruikt deze kolom al, maar hij ontbrak in productie —
--  getimede items werden daardoor stil niet opgeslagen. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table week_items add column if not exists time_block text;
