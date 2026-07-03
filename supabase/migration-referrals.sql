-- Track who invited whom (for Daily Prize eligibility)
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0;
