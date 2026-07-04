-- Referral channel gate: reward only after referred user joins official channel and opens the game.
-- Status values on referrals.status:
--   pending_channel — recorded on signup via ref link, no coins yet
--   qualified       — channel member opened game; referrer credited +500
--   rejected_bot    — referred account is a Telegram bot
--
-- Render env (recommended):
--   OFFICIAL_CHANNEL_USERNAME=@official_wealthia
--   OFFICIAL_CHANNEL_ID=-100xxxxxxxxxx   (numeric id — most reliable for getChatMember)
--   OFFICIAL_CHANNEL_URL=https://t.me/official_wealthia
-- Bot must be admin in the channel so getChatMember can read members.

-- No schema change required if migration-referral-bot-block.sql already added status TEXT.
UPDATE referrals
SET status = 'qualified'
WHERE status IS NULL OR status = '';
