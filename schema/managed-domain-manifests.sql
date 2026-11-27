CREATE TABLE IF NOT EXISTS managed_domain_manifests (
  domain_id TEXT PRIMARY KEY,
  manifest_json TEXT NOT NULL,
  special_files_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(domain_id) REFERENCES managed_domains(id) ON DELETE CASCADE
);
