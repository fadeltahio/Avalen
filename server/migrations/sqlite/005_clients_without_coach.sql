-- sqlite: foreign keys off
-- A client's login can now exist without a coach (workspace_id NULL): after leaving a
-- coach, or when their coach deletes their account, the client keeps their account and
-- their history. SQLite can't drop NOT NULL in place, so the table is rebuilt.
CREATE TABLE users_new(
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('coach','client')),
  workspace_id TEXT REFERENCES workspaces(id),
  client_id TEXT);
INSERT INTO users_new(id, email, password, role, workspace_id, client_id) SELECT id, email, password, role, workspace_id, client_id FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
-- Make sure every coaching relationship is linked to its client's login.
UPDATE coaching_relationships SET client_user_id=(SELECT id FROM users WHERE users.workspace_id=coaching_relationships.workspace_id AND users.client_id=coaching_relationships.client_id)
WHERE client_user_id IS NULL;
-- A deleted coach's workspace is kept as an empty marker while former clients still own
-- records in it; background work skips it.
ALTER TABLE workspaces ADD COLUMN deleted_at TEXT;
