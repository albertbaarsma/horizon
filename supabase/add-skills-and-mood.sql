-- ═══════════════════════════════════════════════════════════════════════════
--  1. Vrije skill-tree: XP naar zelfbedachte vaardigheden (sociaal, IT, muziek…)
--  2. Mood tracker: stemming, energie en slaap per dag
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Skills ────────────────────────────────────────────────────────────────
-- Een skill "bestaat" zodra er een xp_event met die naam is; geen aparte tabel
-- nodig. Skill-XP staat náást de bestaande categorie-skills (cat_id).
alter table xp_events add column if not exists skill text;
create index if not exists xp_events_skill_idx on xp_events(user_id, skill);

-- ── 2. Mood ──────────────────────────────────────────────────────────────────
-- mood: -3 (zwaar omlaag) … 0 (neutraal) … +3 (sterk omhoog) — beide kanten
-- tellen, want bij bipolariteit is zowel een dip als een piek relevant.
-- energy: 1–5. sleep_hours: uren slaap die nacht (belangrijk vroegsignaal).
create table if not exists mood_entries (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  date        date not null default ((now() at time zone 'Europe/Amsterdam')::date),
  mood        int  not null check (mood between -3 and 3),
  energy      int  check (energy between 1 and 5),
  sleep_hours numeric(3,1) check (sleep_hours >= 0 and sleep_hours <= 24),
  note        text,
  created_at  timestamptz default now(),
  unique (user_id, date)   -- één meting per dag; opnieuw invullen werkt bij
);

create index if not exists mood_entries_user_date_idx on mood_entries(user_id, date desc);

alter table mood_entries enable row level security;
do $$ begin
  create policy "own mood_entries" on mood_entries for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
