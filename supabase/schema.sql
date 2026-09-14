-- Run this in the Supabase SQL editor after creating your project

create extension if not exists "pgcrypto";

-- Profiles (one per auth user)
create table profiles (
  id uuid references auth.users primary key,
  display_name text,
  ai_token text unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Categories
create table categories (
  id text,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  primary key (id, user_id)
);

-- Projects
create table projects (
  id text,
  user_id uuid references profiles(id) on delete cascade,
  cat_id text not null,
  name text not null,
  emoji text default '📌',
  status text default 'actief',
  description text,
  vision text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id, user_id)
);

-- Tasks
create table tasks (
  id serial primary key,
  user_id uuid references profiles(id) on delete cascade,
  proj_id text not null,
  name text not null,
  status text default 'backlog', -- backlog | doing | waiting | done
  urgent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Goals
create table goals (
  id serial primary key,
  user_id uuid references profiles(id) on delete cascade,
  horizon text default 'nu', -- nu | wk | 6w | kwartaal | jaar
  text text not null,
  done boolean default false,
  created_at timestamptz default now()
);

-- Achievements
create table achievements (
  id serial primary key,
  user_id uuid references profiles(id) on delete cascade,
  date date not null,
  text text not null,
  cat_id text,
  emoji text default '⭐',
  created_at timestamptz default now()
);

-- Week items (dag-planning in het dashboard)
create table week_items (
  id serial primary key,
  user_id uuid references profiles(id) on delete cascade,
  date date not null,
  type text default 'task',      -- task | cal | sport | kids | urgent
  text text not null,
  done boolean default false,
  proj_id text,
  task_id text,
  created_at timestamptz default now()
);

-- Tuinproject scenarios (rekentool opgeslagen berekeningen)
create table tuinproject_scenarios (
  id serial primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null default 'Scenario',
  -- Verbouwing & inleg
  verbouwing integer default 175000,
  inleg_cash integer default 30000,
  inleg_tarief integer default 40,
  inleg_uren integer default 500,
  albert_tarief integer default 25,
  albert_uren integer default 600,
  valentijn_tarief integer default 50,
  valentijn_uren integer default 600,
  -- Lening
  rente numeric(5,2) default 6.0,
  looptijd integer default 12,
  lening_type text default 'annuitair',
  bouw_maanden integer default 20,
  -- Kosten
  ozb integer default 35,
  verzekering integer default 40,
  reparaties integer default 185,
  -- Huur
  huur_start integer default 1200,
  huur_groei1 numeric(4,2) default 4.4,
  huur_groei2 numeric(4,2) default 2.0,
  huur_omslag integer default 5,
  erik_pct integer default 30,
  -- Handmatige tabeloverschrijvingen (JSON)
  cell_overrides jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RPM checklist state (checkboxes in tuinproject-rpm pagina)
create table rpm_checks (
  user_id uuid references profiles(id) on delete cascade,
  plan_id text not null,     -- bijv. 'tuinproject'
  check_id text not null,    -- bijv. 'f1a1'
  checked boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, plan_id, check_id)
);

-- Row Level Security
alter table profiles enable row level security;
alter table categories enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table goals enable row level security;
alter table achievements enable row level security;

alter table week_items enable row level security;
alter table tuinproject_scenarios enable row level security;
alter table rpm_checks enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own categories" on categories for all using (auth.uid() = user_id);
create policy "own projects" on projects for all using (auth.uid() = user_id);
create policy "own tasks" on tasks for all using (auth.uid() = user_id);
create policy "own goals" on goals for all using (auth.uid() = user_id);
create policy "own achievements" on achievements for all using (auth.uid() = user_id);
create policy "own week_items" on week_items for all using (auth.uid() = user_id);
create policy "own tuinproject_scenarios" on tuinproject_scenarios for all using (auth.uid() = user_id);
create policy "own rpm_checks" on rpm_checks for all using (auth.uid() = user_id);
