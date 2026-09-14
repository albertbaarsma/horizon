-- Voeg prioriteit, volgorde en html-content toe aan projects tabel
alter table projects add column if not exists is_priority boolean not null default false;
alter table projects add column if not exists sort_order int not null default 0;
alter table projects add column if not exists html_content text;
