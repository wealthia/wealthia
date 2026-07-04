-- Wealthia: fraud / anti-cheat event log for premium spin protection
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS fraud_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fraud_events_user_id_idx ON fraud_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_events_type_idx ON fraud_events (event_type, created_at DESC);
