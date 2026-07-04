-- Economy v2: max energy 1000, daily score tracking, tickets via daily_contest_score
ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS max_energy INTEGER DEFAULT 1000;

UPDATE game_states
SET max_energy = 1000
WHERE max_energy IS NULL OR max_energy < 1;

UPDATE game_states
SET energy = LEAST(GREATEST(energy, 0), COALESCE(max_energy, 1000))
WHERE energy IS NOT NULL;

-- users.last_seen_at already exists from base schema; ensure it is set
UPDATE users
SET last_seen_at = COALESCE(last_seen_at, NOW())
WHERE last_seen_at IS NULL;
