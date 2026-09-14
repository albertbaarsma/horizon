-- Shutdown-ritueel + werkelijke tijd + taaknotities/subtaken + uitstel-teller
-- Draai dit in de Supabase SQL editor.

ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS actual_min INTEGER;
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]';
ALTER TABLE week_items ADD COLUMN IF NOT EXISTS postponed_count INTEGER NOT NULL DEFAULT 0;
