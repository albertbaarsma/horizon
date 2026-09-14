-- Voeg proj_type kolom toe aan projects tabel
-- Waarden: 'project' (complex, eindig) of 'routine' (doorlopend, herhalend)
alter table projects add column if not exists proj_type text not null default 'project';

-- Voeg notes kolom toe voor RPM actieplan / stand van zaken / vrije tekst
alter table projects add column if not exists notes text;

-- Markeer bekende routines
update projects set proj_type = 'routine'
where id in ('sport', 'plansessie', 'setlist');
