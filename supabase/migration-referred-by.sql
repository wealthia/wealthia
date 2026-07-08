-- Store inviter Telegram ID on the referred user row for admin analytics
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by);

UPDATE users AS u
SET referred_by = r.referrer_id
FROM referrals AS r
WHERE r.referred_user_id = u.id
  AND (u.referred_by IS NULL OR u.referred_by = '');
