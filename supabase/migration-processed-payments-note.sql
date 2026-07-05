-- ProcessedPayments ledger (idempotency / replay protection)
-- Implemented by existing star_payments.charge_id UNIQUE constraint.
-- Each Telegram successful_payment charge_id may only settle once.
-- Duplicate webhook replays return HTTP 200 without granting rewards again.

-- Ensure settlement columns exist (see migration-stars-settlement.sql)
-- star_payments: charge_id TEXT NOT NULL UNIQUE
