-- ═══════════════════════════════════════════════════════════════════════════
--  Startgesprek voor nieuwe gebruikers. Aparte vlaggen naast onboarding_done,
--  zodat de bestaande rondleiding en dit startgesprek elkaar niet in de weg
--  zitten. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table profiles add column if not exists setup_done boolean default false;
alter table profiles add column if not exists setup_step int default 0;

-- Bestaande gebruikers hoeven het startgesprek niet meer te doen.
update profiles set setup_done = true where setup_done is not true and created_at < now();
