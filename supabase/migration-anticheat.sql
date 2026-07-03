-- Anti-cheat: per-user tap rate limiting window
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS tap_window_start BIGINT NOT NULL DEFAULT 0;
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS tap_window_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS tap_violations INTEGER NOT NULL DEFAULT 0;
