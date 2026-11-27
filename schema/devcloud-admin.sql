-- DEVPAGES DevCloud account registry and private admin audit trail.
CREATE TABLE IF NOT EXISTS devcloud_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive','active','disabled')),
  is_default INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'encrypted' CHECK(source IN ('encrypted','environment')),
  token_ciphertext BLOB,
  token_iv BLOB,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devcloud_one_default ON devcloud_accounts(is_default) WHERE is_default=1;
CREATE TABLE IF NOT EXISTS admin_activity (
  id TEXT PRIMARY KEY NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity(created_at DESC);
