import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
export function openDatabase(root) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const filename = join(root, "avalen.sqlite");
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('coach','client')), workspace_id TEXT NOT NULL REFERENCES workspaces(id), client_id TEXT);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invitations(token TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), client_id TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, client_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, duration REAL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS media_access(media_id TEXT NOT NULL, client_id TEXT NOT NULL, PRIMARY KEY(media_id,client_id));
    CREATE TABLE IF NOT EXISTS media_links(parent_id TEXT NOT NULL, child_id TEXT NOT NULL, PRIMARY KEY(parent_id,child_id));
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, kind TEXT NOT NULL, record_id TEXT, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, run_at INTEGER NOT NULL, error TEXT, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests(user_id TEXT NOT NULL, key TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(user_id,key));
    CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL, at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(state,run_at);
    CREATE INDEX IF NOT EXISTS media_client ON media(workspace_id,client_id);
    INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));
    CREATE TABLE IF NOT EXISTS coach_codes(code TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX IF NOT EXISTS coach_codes_workspace ON coach_codes(workspace_id,active);
    INSERT OR IGNORE INTO migrations VALUES(2,datetime('now'));
  `);
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
