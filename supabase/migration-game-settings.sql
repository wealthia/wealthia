-- Live game configuration (editable from admin panel)
CREATE TABLE IF NOT EXISTS game_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  premium_spin_stars INTEGER NOT NULL DEFAULT 30,
  cash_10_interval INTEGER NOT NULL DEFAULT 150,
  cash_5_interval INTEGER NOT NULL DEFAULT 70,
  cash_2_interval INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO game_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
