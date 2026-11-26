-- Run once against the existing D1 database devpages-production.
-- OAuth access and refresh tokens are encrypted before they are written.
CREATE TABLE IF NOT EXISTS cloudflare_connections (
  user_id TEXT PRIMARY KEY NOT NULL,
  accounts_json TEXT NOT NULL,
  token_ciphertext BLOB NOT NULL,
  token_iv BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
