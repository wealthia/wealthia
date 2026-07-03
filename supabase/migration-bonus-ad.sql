-- Bonus ad slot (replaces Partner Bot): repeatable every 15 minutes
ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS bonus_ad_last_claimed_at BIGINT NOT NULL DEFAULT 0;
