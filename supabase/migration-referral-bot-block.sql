-- Referral bot blocking: only count real humans toward referral stats
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'qualified';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reject_reason TEXT NOT NULL DEFAULT '';
