-- Daily $10 lottery winners + midnight reset helper

CREATE TABLE IF NOT EXISTS daily_winners (
  id BIGSERIAL PRIMARY KEY,
  contest_date TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  daily_score INTEGER NOT NULL DEFAULT 0,
  tickets INTEGER NOT NULL DEFAULT 0,
  prize_amount INTEGER NOT NULL DEFAULT 10,
  prize_currency TEXT NOT NULL DEFAULT 'USD',
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_winners_drawn_at_idx ON daily_winners (drawn_at DESC);

CREATE OR REPLACE FUNCTION reset_daily_contest(p_today TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE game_states
  SET
    daily_contest_score = 0,
    contest_date = p_today,
    contest_baseline_city = COALESCE(coins, 0) + COALESCE(spent, 0),
    updated_at = NOW();
END;
$$;
