-- Soft delete for chores: deleted_at is a nullable ISO timestamp, NULL while the chore is live.
-- Additive (nullable column, no default), so the old Worker keeps working during the
-- migrate-before-deploy window.
ALTER TABLE chores ADD COLUMN deleted_at TEXT;
