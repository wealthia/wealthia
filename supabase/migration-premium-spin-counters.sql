-- Wealthia: Premium Lucky Spin cash award block counters
-- Run in Supabase SQL Editor after migration-premium-spin.sql

INSERT INTO global_counters (counter_key, counter_value)
VALUES
  ('premium_cash_50_last_spin', 0),
  ('premium_cash_1_last_spin', 0)
ON CONFLICT (counter_key) DO NOTHING;
