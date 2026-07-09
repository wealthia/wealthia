-- MERGE ARENA cloud save (run once in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS merge_arena_states (
  user_id TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  trophies INTEGER NOT NULL DEFAULT 0,
  best_wave INTEGER NOT NULL DEFAULT 1,
  wins INTEGER NOT NULL DEFAULT 0,
  merges INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS merge_arena_states_trophies_idx
  ON merge_arena_states (trophies DESC);

CREATE INDEX IF NOT EXISTS merge_arena_states_best_wave_idx
  ON merge_arena_states (best_wave DESC);
