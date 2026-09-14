-- ═══════════════════════════════════════════════════════════════════════════
--  projects.horizon — optionele tijdshorizon voor een project, zelfde schaal
--  als een doel (GoalHorizon: nu/wk/6w/kwartaal/jaar/2-4jr/5-9jr/10jr+/ooit).
--  Los van status (activiteit) — horizon is timing. Net als goals.horizon een
--  vrij text-veld, geen check constraint (begrensd door de TS-union). null =
--  nog niet ingedeeld. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table projects add column if not exists horizon text;
