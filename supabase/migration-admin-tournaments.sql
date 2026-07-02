-- Wealthia: Admin panel + Tournaments
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

-- Tournaments (tap races with entry fees and prizes)
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  entry_fee INTEGER NOT NULL DEFAULT 0,
  prize_pool INTEGER NOT NULL DEFAULT 0,
  prize_winner INTEGER NOT NULL DEFAULT 0,
  prize_runner_up INTEGER NOT NULL DEFAULT 0,
  prize_third INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_ends_at ON tournaments(ends_at);

-- Player entries and tap scores per tournament
CREATE TABLE IF NOT EXISTS tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  tap_score INTEGER NOT NULL DEFAULT 0,
  entry_paid INTEGER NOT NULL DEFAULT 0,
  prize_won INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_score ON tournament_entries(tournament_id, tap_score DESC);

-- Revenue / metrics log for admin dashboard
CREATE TABLE IF NOT EXISTS admin_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  user_id TEXT,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_metrics_type ON admin_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_admin_metrics_created ON admin_metrics(created_at DESC);
