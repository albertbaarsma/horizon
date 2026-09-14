-- ═══════════════════════════════════════════════════════════════════════════
--  Herhaaltaken: één losse dag kunnen overslaan zonder de hele herhaling
--  te stoppen. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- recurring_tasks.skip_dates — data's waarop deze herhaling bewust is
-- overgeslagen ("vandaag lukt sportschool niet"). Het herhaalpatroon zelf
-- (recurring_tasks.days) blijft ongemoeid: volgende gelegenheid staat de
-- taak weer gewoon klaar. Geen week_items-rij nodig — de virtuele
-- gelegenheid verschijnt simpelweg niet op een overgeslagen datum.
alter table recurring_tasks add column if not exists skip_dates date[] not null default '{}'::date[];
