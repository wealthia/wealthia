-- Wealthia: Telegram Stars premium boosts
-- Run in Supabase SQL Editor

ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS endless_energy_until BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS star_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  stars_amount INTEGER NOT NULL DEFAULT 0,
  charge_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS star_payments_user_id_idx ON star_payments (user_id);
