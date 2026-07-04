-- Telegram Stars settlement tracking
-- Only rows with telegram_settled = true may unlock premium spin.

ALTER TABLE star_payments
  ADD COLUMN IF NOT EXISTS telegram_settled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE star_payments
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

UPDATE star_payments
SET
  telegram_settled = true,
  settled_at = COALESCE(settled_at, created_at)
WHERE charge_id IS NOT NULL
  AND charge_id <> ''
  AND telegram_settled = false;

CREATE INDEX IF NOT EXISTS star_payments_settled_pending_idx
  ON star_payments (user_id, product_id, created_at DESC)
  WHERE telegram_settled = true AND consumed_at IS NULL;
