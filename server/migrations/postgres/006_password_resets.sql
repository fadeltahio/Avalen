-- One-time password reset codes sent by email. Only a hash of each code is kept; a code
-- expires after 15 minutes, allows 5 wrong guesses, and works once. Deleting the account
-- deletes its codes.
CREATE TABLE IF NOT EXISTS password_resets(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created BIGINT NOT NULL,
  expires BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at BIGINT
);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets(user_id, created);
