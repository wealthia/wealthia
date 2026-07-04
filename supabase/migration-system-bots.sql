-- Persistent system bot daily contest scores (gradual ticket growth via cron)

CREATE TABLE IF NOT EXISTS system_bot_states (
  bot_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  referral_count INTEGER NOT NULL DEFAULT 3,
  daily_contest_score INTEGER NOT NULL DEFAULT 0,
  contest_date TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_bot_states (bot_id, display_name, referral_count)
VALUES
  ('contest_seed_1', 'Marcus', 4),
  ('contest_seed_2', 'Emma', 3),
  ('contest_seed_3', 'Ryan', 3)
ON CONFLICT (bot_id) DO NOTHING;
