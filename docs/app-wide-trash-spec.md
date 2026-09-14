# App-wide prullenbak — ontwerp-spec

Doel: overal in de app waar je iets kunt verwijderen (taken, projecten, week-items,
herhaaltaken, doelen) moet dat **herstelbaar** zijn via een centrale prullenbak,
i.p.v. direct en definitief weg te zijn. Doelen (`goals`) hebben dit al — zie
[goals-trash-referentie](#referentie-al-gebouwd-goals) hieronder als bouwpatroon.

## 1. Datamodel — zelfde patroon overal: `deleted_at`

Voor elke tabel die dit nog niet heeft:

```sql
alter table tasks        add column if not exists deleted_at timestamptz;
alter table projects     add column if not exists deleted_at timestamptz;
alter table week_items   add column if not exists deleted_at timestamptz;
alter table recurring_tasks add column if not exists deleted_at timestamptz;

create index if not exists tasks_deleted_idx        on tasks(user_id, deleted_at);
create index if not exists projects_deleted_idx     on projects(user_id, deleted_at);
create index if not exists week_items_deleted_idx   on week_items(user_id, deleted_at);
create index if not exists recurring_deleted_idx    on recurring_tasks(user_id, deleted_at);
```

Toepassen via `node scripts/migrate.mjs <bestand>.sql`.

**Let op `week_items`**: heeft al `deleted_at`-achtige semantiek niet, maar wél cascaderende
gevolgen — een verwijderd `project` zet gekoppelde taken/week-items nu op `proj_id: null`
(zie `onDeleted` in ProjectsView/DashboardClient). Beslissing nodig: bij soft-delete van een
project, moet je dat gedrag behouden (ontkoppelen) of ook de children mee-prullenbakken?
Advies: **ontkoppelen blijft**, alleen het project zelf gaat naar de prullenbak — voorkomt een
lawine van "alles mee terug" bij herstel die verwarrend kan zijn.

## 2. Client-state — overal hetzelfde 3-tal functies

Per entiteit (kijk naar `trashGoal` / `restoreGoal` / `purgeGoal` in `DashboardClient.tsx`
als exact voorbeeld — nu al gebouwd voor `goals`):

```ts
async function trashX(id) { /* optimistic: deleted_at = now(); update; rollback bij fout */ }
async function restoreX(id) { /* deleted_at = null */ }
async function purgeX(id) { /* echte delete (bestaande onDeleteTask/onDeleteItem/onDeleted hergebruiken) */ }
```

Overal waar nu een 🗑-knop **direct** verwijdert (`onDeleteTask`, `onDeleteItem` in WeekTab,
project-delete in ProjectsView, recurring-task delete), vervang door `trashX` — de bestaande
hard-delete-functies worden de `purgeX`-implementatie (hergebruiken, niet opnieuw schrijven).

## 3. UI — één centrale prullenbak, niet 4 losse

**Advies: centrale 🗑-tab/paneel** (i.p.v. per-tab prullenbak zoals bij Doelen — dat was
gekozen omdat het klein & lokaal was). Voor de hele app:

- Nieuwe knop in de topbar (naast 🔍/🔔) of in het `⋯ Meer`-paneel op mobiel: **🗑 Prullenbak**.
- Opent een paneel/modal met alle soft-deleted items van alle types, gegroepeerd per type
  (Taken / Projecten / Weekplanning / Herhaaltaken / Doelen), elk met tekst, verwijderd-op-datum,
  **↩ Herstel** en **Definitief wissen**.
- Badge met totaalaantal op de knop (zoals `Prullenbak (7)` bij Doelen nu).
- Overal waar een lijst nu filtert (`tasks`, `weekItems.filter(...)`, project-lijsten,
  zoekresultaten in `SearchModal`), filter ook `!deleted_at` — zie `goals.filter(g => !g.deleted_at)`
  in `SearchModal`-aanroep als voorbeeld.

## 4. Opruiming (optioneel, niet urgent)
Overweeg een cron/scheduled cleanup die na bv. 30 dagen in de prullenbak definitief verwijdert
(voorkomt onbeperkte groei). Niet nodig voor v1.

## Referentie: al gebouwd (`goals`)
- Migratie: `supabase/add-goals-trash.sql`
- Client: `trashGoal` / `restoreGoal` / `purgeGoal` in `DashboardClient.tsx`
- UI: prullenbak-sectie onderaan `GoalsTab` (uitklapbaar, `↩ Herstel` / `Definitief wissen`)
- Zoekresultaten al gefilterd op `!deleted_at`

Gebruik dit 1-op-1 als sjabloon voor de andere entiteiten; alleen de UI wordt gecentraliseerd
i.p.v. per-tab, zoals hierboven beschreven.
