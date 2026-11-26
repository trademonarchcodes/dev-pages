-- One-time migration for existing DEVPAGES billing database.
ALTER TABLE managed_domains ADD COLUMN cloudflare_account_id TEXT;
ALTER TABLE managed_domains ADD COLUMN original_deployment_id TEXT;
ALTER TABLE managed_domains ADD COLUMN suspended_deployment_id TEXT;
