-- ═══════════════════════════════════════════════════════════════════════════
--  mood_entries: schaal verbreden van -3..+3 naar -10..+10, en een 'source'
--  kolom erbij — zodat een AI-inschatting (op basis van het dagboek) te
--  onderscheiden is van wat je zelf hebt ingevuld. Bestaande rijen blijven
--  geldig: ze vallen gewoon binnen de nieuwe, ruimere schaal.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table mood_entries drop constraint if exists mood_entries_mood_check;
alter table mood_entries add constraint mood_entries_mood_check check (mood between -10 and 10);

alter table mood_entries add column if not exists source text default 'manual';
alter table mood_entries drop constraint if exists mood_entries_source_check;
alter table mood_entries add constraint mood_entries_source_check check (source in ('manual', 'ai'));
