-- ═══════════════════════════════════════════════════════════════════════════
--  Doelen krijgen dezelfde diepte als projecten: Result, Why/Purpose, vrije
--  notities, een HTML-visualisatievak, en een hoofd/sub-relatie. Levensgebieden
--  (categories) krijgen een vrij notitieveld.
--
--  Alles optioneel — een doel dat alleen een tekst heeft blijft prima geldig.
--  parent_id verwijst naar een ander doel (zelfde tabel); verdwijnt het
--  hoofddoel, dan wordt parent_id van het subdoel gewoon leeg (geen rare FK-fout).
--
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

alter table goals add column if not exists result text;
alter table goals add column if not exists why text;
alter table goals add column if not exists notes text;
alter table goals add column if not exists html_content text;
alter table goals add column if not exists parent_id integer references goals(id) on delete set null;

create index if not exists goals_parent_idx on goals(parent_id);

alter table categories add column if not exists notes text;
