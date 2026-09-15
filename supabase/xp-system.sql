-- ═══════════════════════════════════════════════════════════════════════════
--  Horizon — XP / gamification systeem
--  Voer dit één keer uit in de Supabase SQL Editor.
--  Veilig om opnieuw te draaien (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. XP-events log ─────────────────────────────────────────────────────────
create table if not exists xp_events (
  id         bigserial primary key,
  user_id    uuid references profiles(id) on delete cascade,
  amount     int  not null,
  reason     text not null,
  cat_id     text,                       -- levenscategorie (nullable)
  source     text not null default 'manual', -- task | achievement | goal | weekitem | tutorial | manual | ai
  ref_id     text,                       -- id van de bron, voor dedup
  seen       boolean default false,      -- voor het meldingen-overzicht
  created_at timestamptz default now()
);

create index if not exists xp_events_user_idx on xp_events(user_id, created_at desc);

alter table xp_events enable row level security;
do $$ begin
  create policy "own xp_events" on xp_events for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── 2. Profiel-uitbreidingen (tutorial + unlocks) ────────────────────────────
alter table profiles add column if not exists onboarding_done   boolean default false;
alter table profiles add column if not exists onboarding_step    int     default 0;
alter table profiles add column if not exists unlocked_features  text[]  default '{}';

-- ── 3. Trigger: taak afgerond → XP ───────────────────────────────────────────
create or replace function award_task_xp() returns trigger
language plpgsql security definer as $$
declare
  cat  text;
  base int := 10;
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    -- eenmalig per taak (afvinken → ontvinken → opnieuw telt niet dubbel)
    if not exists (
      select 1 from xp_events
      where source = 'task' and ref_id = new.id::text and user_id = new.user_id
    ) then
      if new.urgent then base := 15; end if;
      select cat_id into cat from projects
        where id = new.proj_id and user_id = new.user_id;
      insert into xp_events(user_id, amount, reason, cat_id, source, ref_id)
      values (new.user_id, base, 'Taak afgerond: ' || new.name, cat, 'task', new.id::text);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_task_xp on tasks;
create trigger trg_task_xp after update on tasks
  for each row execute function award_task_xp();

-- ── 4. Trigger: prestatie → XP ───────────────────────────────────────────────
create or replace function award_achievement_xp() returns trigger
language plpgsql security definer as $$
begin
  insert into xp_events(user_id, amount, reason, cat_id, source, ref_id)
  values (new.user_id, 25, 'Prestatie: ' || new.text, new.cat_id, 'achievement', new.id::text);
  return new;
end $$;

drop trigger if exists trg_achievement_xp on achievements;
create trigger trg_achievement_xp after insert on achievements
  for each row execute function award_achievement_xp();

-- ── 5. Trigger: doel invoeren → XP ───────────────────────────────────────────
create or replace function award_goal_xp() returns trigger
language plpgsql security definer as $$
begin
  insert into xp_events(user_id, amount, reason, cat_id, source, ref_id)
  values (new.user_id, 15, 'Doel toegevoegd: ' || new.text, new.cat_id, 'goal', new.id::text);
  return new;
end $$;

drop trigger if exists trg_goal_xp on goals;
create trigger trg_goal_xp after insert on goals
  for each row execute function award_goal_xp();

-- ── 5b. Trigger: weekplanning-item afgevinkt → XP ────────────────────────────
-- Alleen losse planning/routines (task_id is null); taak-gekoppelde items
-- krijgen hun XP al via de taken-trigger. Vuurt op insert (routines worden
-- direct als done ingevoegd) én update (afvinken).
create or replace function award_weekitem_xp() returns trigger
language plpgsql security definer as $$
declare cat text;
begin
  if new.done = true and new.task_id is null
     and (tg_op = 'INSERT' or old.done is distinct from true) then
    if not exists (
      select 1 from xp_events
      where source = 'weekitem' and ref_id = new.id::text and user_id = new.user_id
    ) then
      if new.proj_id is not null then
        select cat_id into cat from projects where id = new.proj_id and user_id = new.user_id;
      end if;
      insert into xp_events(user_id, amount, reason, cat_id, source, ref_id)
      values (new.user_id, 5, 'Planning afgevinkt: ' || new.text, cat, 'weekitem', new.id::text);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_weekitem_xp on week_items;
create trigger trg_weekitem_xp after insert or update on week_items
  for each row execute function award_weekitem_xp();

-- ── 6. Backfill: bestaande historie omzetten naar XP (seen = true) ───────────
-- Afgeronde taken
insert into xp_events(user_id, amount, reason, cat_id, source, ref_id, seen, created_at)
select t.user_id,
       case when t.urgent then 15 else 10 end,
       'Taak afgerond: ' || t.name,
       (select cat_id from projects p where p.id = t.proj_id and p.user_id = t.user_id),
       'task', t.id::text, true, coalesce(t.updated_at, now())
from tasks t
where t.status = 'done'
  and not exists (select 1 from xp_events e
                  where e.source = 'task' and e.ref_id = t.id::text and e.user_id = t.user_id);

-- Prestaties
insert into xp_events(user_id, amount, reason, cat_id, source, ref_id, seen, created_at)
select a.user_id, 25, 'Prestatie: ' || a.text, a.cat_id, 'achievement', a.id::text, true, a.created_at
from achievements a
where not exists (select 1 from xp_events e
                  where e.source = 'achievement' and e.ref_id = a.id::text and e.user_id = a.user_id);

-- Doelen
insert into xp_events(user_id, amount, reason, cat_id, source, ref_id, seen, created_at)
select g.user_id, 15, 'Doel toegevoegd: ' || g.text, g.cat_id, 'goal', g.id::text, true, g.created_at
from goals g
where not exists (select 1 from xp_events e
                  where e.source = 'goal' and e.ref_id = g.id::text and e.user_id = g.user_id);

-- Afgevinkte planning-items (losse items + routines, niet taak-gekoppeld)
insert into xp_events(user_id, amount, reason, cat_id, source, ref_id, seen, created_at)
select w.user_id, 5, 'Planning afgevinkt: ' || w.text,
       (select cat_id from projects p where p.id = w.proj_id and p.user_id = w.user_id),
       'weekitem', w.id::text, true, w.created_at
from week_items w
where w.done = true and w.task_id is null
  and not exists (select 1 from xp_events e
                  where e.source = 'weekitem' and e.ref_id = w.id::text and e.user_id = w.user_id);
