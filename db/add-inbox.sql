-- Universele inbox: taken zonder project (proj_id NULL = 📥 inbox)
-- Draai dit in de Supabase SQL editor.

ALTER TABLE tasks ALTER COLUMN proj_id DROP NOT NULL;
