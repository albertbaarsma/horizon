-- ═══════════════════════════════════════════════════════════════════════════
--  Prullenbak voor taken, net als bij doelen. Verwijderen zet deleted_at; de
--  taak blijft bestaan (met zijn project, en dus zijn kleur) tot je hem
--  definitief weggooit.
--
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table tasks add column if not exists deleted_at timestamptz;

create index if not exists tasks_deleted_idx on tasks (user_id, deleted_at);
