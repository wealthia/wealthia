-- Daily $10 contest: score = city_value gained since UTC midnight
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS contest_date TEXT NOT NULL DEFAULT '';
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS contest_baseline_city INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS daily_contest_score INTEGER NOT NULL DEFAULT 0;
