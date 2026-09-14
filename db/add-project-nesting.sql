-- Sub-projecten: een project kan onder een hoofdproject hangen.
-- Draai dit in de Supabase SQL editor.
-- Geen FK-verwijzing: projects.id heeft geen unique constraint (de app
-- controleert zelf of het hoofdproject bestaat).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id TEXT;
