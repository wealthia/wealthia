-- Wealthia: Empire Level + Casino
-- Run in Supabase SQL Editor

ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS casino_level INTEGER NOT NULL DEFAULT 0;

ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS casino_date TEXT DEFAULT '';
