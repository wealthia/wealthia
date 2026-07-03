-- Gold Rush daily event, level bracket tournaments, push tracking
ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS gold_rush_date TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gold_rush_until BIGINT NOT NULL DEFAULT 0;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS bracket_min_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bracket_max_level INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_push_date TEXT NOT NULL DEFAULT '';
