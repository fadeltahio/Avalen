-- A client's login can now exist without a coach (workspace_id NULL): after leaving a
-- coach, or when their coach deletes their account, the client keeps their account and
-- their history.
ALTER TABLE users ALTER COLUMN workspace_id DROP NOT NULL;
-- A deleted coach's workspace is kept as an empty marker while former clients still own
-- records in it; background work skips it.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS deleted_at TEXT;
