-- ═══════════════════════════════════════════════════════════════════════════
--  Deadlines voor taken en projecten (goals had al `deadline`), plus
--  original_deadline op alle drie — de allereerste ooit gezette deadline,
--  zodat je kunt zien of en hoeveel een deadline is verschoven. Zie
--  lib/deadline-horizon.ts voor hoe een deadline de horizon automatisch
--  aanstuurt. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table tasks    add column if not exists deadline date;
alter table tasks    add column if not exists original_deadline date;
alter table projects add column if not exists deadline date;
alter table projects add column if not exists original_deadline date;
alter table goals    add column if not exists original_deadline date;
