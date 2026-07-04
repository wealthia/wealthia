-- Referral channel gate: reward only after referred user joins @official_wealthia and opens the game.
-- Status values on referrals.status:
--   pending_channel — recorded on signup via ref link, no coins yet
--   qualified       — channel member opened game; referrer credited +500
--   rejected_bot    — referred account is a Telegram bot

-- No schema change required if migration-referral-bot-block.sql already added status TEXT.
-- Optional: backfill legacy rows that were inserted before pending_channel existed.
UPDATE referrals
SET status = 'qualified'
WHERE status IS NULL OR status = '';
