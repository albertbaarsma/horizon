-- ═══════════════════════════════════════════════════════════════════════════
--  Prullenbak voor doelen — soft-delete i.p.v. direct verwijderen.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table goals add column if not exists deleted_at timestamptz;
create index if not exists goals_deleted_idx on goals(user_id, deleted_at);
