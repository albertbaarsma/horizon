-- ═══════════════════════════════════════════════════════════════════════════
--  sort_order op tasks/week_items/goals — projects had dit al. Eén functie
--  (lib/reorder.ts) berekent de nieuwe volgorde na een sleep, overal
--  hetzelfde: Projecten (Secties + Horizon), Taken (Kanban/Lijst/Horizon),
--  Doelen, en Week (per dag). Bestaande rijen krijgen 0 — dat is prima, de
--  eerste keer slepen in een groep herindexeert toch alles binnen die groep.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table tasks       add column if not exists sort_order integer not null default 0;
alter table week_items  add column if not exists sort_order integer not null default 0;
alter table goals       add column if not exists sort_order integer not null default 0;
