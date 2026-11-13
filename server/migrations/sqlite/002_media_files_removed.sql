-- Marks a deleted file record whose bytes have been removed from storage, so the
-- cleanup job removes each file once instead of asking the store again every run.
ALTER TABLE media ADD COLUMN files_removed INTEGER NOT NULL DEFAULT 0;
