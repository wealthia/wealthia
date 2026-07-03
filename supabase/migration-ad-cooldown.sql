-- Rewarded ad: repeatable every 5 minutes (was one-time ad_done flag)
ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS ad_last_claimed_at BIGINT NOT NULL DEFAULT 0;

-- Players who already claimed the one-time ad start on cooldown from now
UPDATE game_states
SET ad_last_claimed_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE ad_done = TRUE AND ad_last_claimed_at = 0;
