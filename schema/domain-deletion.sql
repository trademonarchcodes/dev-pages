-- Soft-delete tracking for hosted projects. Keeps the subscription status CHECK constraint intact.
-- Apply once to devpages-production D1.
ALTER TABLE managed_domains ADD COLUMN deleted_at TEXT;
