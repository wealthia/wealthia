-- Offline + live energy regen: base 3/sec, timestamp for catch-up on login
ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS energy_regen_rate INTEGER NOT NULL DEFAULT 3;

ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS last_energy_updated_at BIGINT NOT NULL DEFAULT 0;

UPDATE game_states
SET energy_regen_rate = 3
WHERE energy_regen_rate IS NULL OR energy_regen_rate < 1;

UPDATE game_states
SET last_energy_updated_at = (
  EXTRACT(EPOCH FROM COALESCE(updated_at, NOW()))::BIGINT * 1000
)
WHERE last_energy_updated_at IS NULL OR last_energy_updated_at < 1;

-- energy column stores current_energy (API exposes as currentEnergy)
