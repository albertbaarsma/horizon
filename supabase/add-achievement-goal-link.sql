-- ═══════════════════════════════════════════════════════════════════════════
--  Achievements koppelen aan doelen — zodat een gehaald doel automatisch een
--  achievement wordt, met een label (bv. "Kwartaaldoel") dat getoond kan worden.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table achievements add column if not exists source text;
alter table achievements add column if not exists ref_id text;
alter table achievements add column if not exists label text;

create index if not exists achievements_source_ref_idx on achievements(user_id, source, ref_id);
