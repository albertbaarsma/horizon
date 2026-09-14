-- ═══════════════════════════════════════════════════════════════════════════
--  attachments — bestanden (foto's, PDF's, ...) gekoppeld aan een project,
--  doel of taak. Het bestand zelf staat in Supabase Storage (bucket
--  "attachments", privé); deze tabel is de metadata + koppeling.
--  entity_id is text zodat zowel projects.id (slug) als goals.id/tasks.id
--  (integer) hierin passen. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists attachments (
  id            bigserial primary key,
  user_id       uuid references profiles(id) on delete cascade,
  entity_type   text not null,        -- 'project' | 'goal' | 'task'
  entity_id     text not null,
  file_name     text not null,
  storage_path  text not null,        -- pad binnen de "attachments" bucket
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz default now()
);
create index if not exists attachments_entity_idx on attachments(user_id, entity_type, entity_id);

alter table attachments enable row level security;
do $$ begin
  create policy "own attachments" on attachments for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Storage: privé bucket. Bestandspaden beginnen altijd met "<user_id>/...",
-- storage.foldername(name) haalt dat eerste padsegment eruit zodat de policy
-- kan afdwingen dat iedereen alleen bij zijn eigen map kan.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

do $$ begin
  create policy "own attachment objects select" on storage.objects for select
    using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own attachment objects insert" on storage.objects for insert
    with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own attachment objects delete" on storage.objects for delete
    using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
