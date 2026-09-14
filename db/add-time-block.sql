-- Feature 5: Tijdblokken — add time_block column to week_items
-- Run in Supabase SQL editor
ALTER TABLE week_items ADD COLUMN IF NOT EXISTS time_block TEXT;
