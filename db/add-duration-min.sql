-- Feature 7: Taak-duur schatten — add duration_min column to tasks
-- Run in Supabase SQL editor
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_min INTEGER;
