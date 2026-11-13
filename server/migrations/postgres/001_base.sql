-- The same tables as migrations/sqlite/001_base.sql. Millisecond timestamps are
-- BIGINT (they overflow PostgreSQL's 32-bit INTEGER). JSON stays TEXT in this phase
-- so the stored documents are byte-for-byte what SQLite holds; Phase 2 replaces them.
CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('coach','client')), workspace_id TEXT NOT NULL REFERENCES workspaces(id), client_id TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS invitations(token TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), client_id TEXT NOT NULL, expires BIGINT NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, client_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size BIGINT NOT NULL, duration DOUBLE PRECISION, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS media_access(media_id TEXT NOT NULL, client_id TEXT NOT NULL, PRIMARY KEY(media_id,client_id));
CREATE TABLE IF NOT EXISTS media_links(parent_id TEXT NOT NULL, child_id TEXT NOT NULL, PRIMARY KEY(parent_id,child_id));
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, kind TEXT NOT NULL, record_id TEXT, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, run_at BIGINT NOT NULL, error TEXT, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS requests(user_id TEXT NOT NULL, key TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(state,run_at);
CREATE INDEX IF NOT EXISTS media_client ON media(workspace_id,client_id);
CREATE TABLE IF NOT EXISTS coach_codes(code TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS coach_codes_workspace ON coach_codes(workspace_id,active);
CREATE TABLE IF NOT EXISTS payment_accounts(
  workspace_id TEXT PRIMARY KEY, region TEXT NOT NULL, public_key TEXT NOT NULL,
  secret_key TEXT NOT NULL, hmac_secret TEXT NOT NULL, integration_ids TEXT NOT NULL, connected_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wearable_links(
  workspace_id TEXT NOT NULL, client_id TEXT NOT NULL, provider TEXT NOT NULL, external_user TEXT,
  access_token TEXT NOT NULL, refresh_token TEXT, expires_at BIGINT NOT NULL, connected_at TEXT NOT NULL,
  last_sync_at TEXT, last_error TEXT, retry_at BIGINT, PRIMARY KEY(workspace_id, client_id, provider));
CREATE TABLE IF NOT EXISTS wearable_states(state TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, client_id TEXT NOT NULL, provider TEXT NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS wearable_days(
  workspace_id TEXT NOT NULL, client_id TEXT NOT NULL, provider TEXT NOT NULL, date TEXT NOT NULL,
  metrics TEXT NOT NULL, synced_at TEXT NOT NULL, PRIMARY KEY(workspace_id, client_id, provider, date));
CREATE TABLE IF NOT EXISTS wearable_events(id TEXT PRIMARY KEY, at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS wearable_days_client ON wearable_days(workspace_id, client_id, date);
CREATE INDEX IF NOT EXISTS wearable_links_user ON wearable_links(provider, external_user);
