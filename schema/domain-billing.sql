-- DEVPAGES per-domain billing records. Run against devpages-production D1.
CREATE TABLE IF NOT EXISTS managed_domains (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL UNIQUE,
  hostname TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','active','suspended','provisioning','failed')),
  promo_eligible INTEGER NOT NULL DEFAULT 0,
  activated_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_managed_domains_user ON managed_domains(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_managed_domains_expiry ON managed_domains(status, expires_at);
CREATE TABLE IF NOT EXISTS domain_payments (
  reference TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('setup','renewal')),
  amount_kobo INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(domain_id) REFERENCES managed_domains(id)
);
CREATE INDEX IF NOT EXISTS idx_domain_payments_user ON domain_payments(user_id, created_at);
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
