-- ═══════════════════════════════════════════════════════════════════════════
--  tasks.horizon — optionele tijdshorizon voor een taak, zelfde schaal als een
--  project/doel (GoalHorizon: nu/doorlopend/wk/6w/kwartaal/jaar/2-4jr/5-9jr/
--  10jr+/ooit). Los van status (activiteit) — horizon is timing. Net als
--  projects.horizon een vrij text-veld, geen check constraint (begrensd door
--  de TS-union). null = nog niet ingedeeld. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table tasks add column if not exists horizon text;
