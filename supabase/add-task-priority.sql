-- ═══════════════════════════════════════════════════════════════════════════
--  Taakprioriteit — los van 'urgent' (dat is een simpele vlag). priority is een
--  cijfer 0-5: 0 = geen prioriteit gezet, hoger = belangrijker. Bepaalt de
--  sortering in Taken en Dag (hoogste eerst, daarna de bestaande volgorde).
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table tasks add column if not exists priority integer not null default 0;
alter table tasks drop constraint if exists tasks_priority_check;
alter table tasks add constraint tasks_priority_check check (priority between 0 and 5);
