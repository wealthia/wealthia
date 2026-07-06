-- Leaderboard, daily contest, and referral query performance
CREATE INDEX IF NOT EXISTS game_states_city_value_idx
  ON game_states (city_value DESC);

CREATE INDEX IF NOT EXISTS game_states_daily_contest_idx
  ON game_states (contest_date, daily_contest_score DESC);

CREATE INDEX IF NOT EXISTS referrals_referrer_status_idx
  ON referrals (referrer_id, status);

CREATE INDEX IF NOT EXISTS users_last_seen_idx
  ON users (last_seen_at DESC);
