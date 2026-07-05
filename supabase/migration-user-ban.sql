-- Ban abusive users from Telegram bot / game session
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ban_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS users_banned_idx ON users (is_banned) WHERE is_banned = true;
