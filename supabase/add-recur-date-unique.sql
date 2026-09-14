-- Eén bezetting per (herhaalpatroon, datum) — nooit twee rijen voor dezelfde
-- dag van dezelfde herhaling. Bewust GEEN partial index (`where recur_id is
-- not null`): Postgres kan `ON CONFLICT (recur_id, date)` niet matchen tegen
-- een partial unique index tenzij je in de ON CONFLICT-clausule dezelfde WHERE
-- herhaalt — en dat kan supabase-js's upsert(...,{onConflict}) niet. Een heel
-- gewone unique index werkt hier net zo goed: Postgres behandelt NULL <> NULL
-- in een unique constraint, dus rijen met recur_id = null (alle normale,
-- niet-herhalende taken) botsen sowieso nooit met elkaar.
drop index if exists week_items_recur_date_unique;
create unique index if not exists week_items_recur_date_unique
  on week_items (recur_id, date);
