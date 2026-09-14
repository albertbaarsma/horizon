-- ═══════════════════════════════════════════════════════════════════════════
--  Week- en maandrapporten — automatisch (Vercel Cron) of handmatig
--  gegenereerd door lib/report-generator.ts. Elk rapport is platte, voor-te-
--  lezen tekst over een vaste periode. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists life_reports (
  id           bigserial primary key,
  user_id      uuid references profiles(id) on delete cascade,
  kind         text not null check (kind in ('week', 'month')),
  period_start date not null,
  period_end   date not null,
  content      text not null,
  created_at   timestamptz default now()
);
create index if not exists life_reports_user_kind_idx on life_reports(user_id, kind, period_end desc);

alter table life_reports enable row level security;
do $$ begin
  create policy "own life_reports" on life_reports for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
