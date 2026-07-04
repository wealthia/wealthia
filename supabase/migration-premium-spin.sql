-- Wealthia: Premium Lucky Spin (global counter + cash payouts)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS global_counters (
  counter_key TEXT PRIMARY KEY,
  counter_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO global_counters (counter_key, counter_value)
VALUES ('global_premium_spins', 0)
ON CONFLICT (counter_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS pending_payouts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  amount_usd NUMERIC(10, 2) NOT NULL,
  wallet_address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  prize_id TEXT NOT NULL DEFAULT '',
  spin_payment_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pending_payouts_status_idx ON pending_payouts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS pending_payouts_user_id_idx ON pending_payouts (user_id);

ALTER TABLE star_payments
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS star_payments_premium_pending_idx
  ON star_payments (user_id, product_id, created_at DESC)
  WHERE consumed_at IS NULL;
