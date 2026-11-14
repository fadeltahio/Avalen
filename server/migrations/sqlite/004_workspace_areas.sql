-- Phase 3: every client-related list in a workspace gets its own table (see
-- server/store/records.js). Each row keeps the record exactly as the app wrote it,
-- its position in the list, its client and coaching relationship, and a few
-- queryable columns.

CREATE TABLE IF NOT EXISTS client_records(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS client_records_client ON client_records(client_id, record_date);

CREATE TABLE IF NOT EXISTS food_logs(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  meal TEXT,
  kcal REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS food_logs_client ON food_logs(client_id, record_date);

CREATE TABLE IF NOT EXISTS nutrition_days(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  complete INTEGER,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS nutrition_days_client ON nutrition_days(client_id, record_date);

CREATE TABLE IF NOT EXISTS habit_logs(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS habit_logs_client ON habit_logs(client_id, record_date);

CREATE TABLE IF NOT EXISTS activity_logs(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS activity_logs_client ON activity_logs(client_id, record_date);

CREATE TABLE IF NOT EXISTS measurements(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  weight_kg REAL,
  waist_cm REAL,
  body_fat_pct REAL,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS measurements_client ON measurements(client_id, record_date);

CREATE TABLE IF NOT EXISTS checkins(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  reviewed INTEGER,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS checkins_client ON checkins(client_id, record_date);

CREATE TABLE IF NOT EXISTS messages(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  from_role TEXT,
  is_read INTEGER,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS messages_client ON messages(client_id, record_date);

CREATE TABLE IF NOT EXISTS progress_photos(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS progress_photos_client ON progress_photos(client_id, record_date);

CREATE TABLE IF NOT EXISTS client_documents(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS client_documents_client ON client_documents(client_id, record_date);

CREATE TABLE IF NOT EXISTS body_scans(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS body_scans_client ON body_scans(client_id, record_date);

CREATE TABLE IF NOT EXISTS client_payments(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  amount REAL,
  currency TEXT,
  status TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS client_payments_client ON client_payments(client_id, record_date);

CREATE TABLE IF NOT EXISTS timeline_events(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS timeline_events_client ON timeline_events(client_id, record_date);

CREATE TABLE IF NOT EXISTS plan_revisions(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS plan_revisions_client ON plan_revisions(client_id, record_date);

CREATE TABLE IF NOT EXISTS notifications(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS notifications_client ON notifications(client_id, record_date);

CREATE TABLE IF NOT EXISTS form_submissions(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS form_submissions_client ON form_submissions(client_id, record_date);

CREATE TABLE IF NOT EXISTS schedule_proposals(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS schedule_proposals_client ON schedule_proposals(client_id, record_date);

CREATE TABLE IF NOT EXISTS insight_decisions(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS insight_decisions_client ON insight_decisions(client_id, record_date);

CREATE TABLE IF NOT EXISTS client_preferences(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS client_preferences_client ON client_preferences(client_id, record_date);

CREATE TABLE IF NOT EXISTS dismissed_flags(
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  record_key TEXT NOT NULL,
  client_id TEXT,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  record_date TEXT,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(workspace_id, record_key));
CREATE INDEX IF NOT EXISTS dismissed_flags_client ON dismissed_flags(client_id, record_date);
CREATE INDEX IF NOT EXISTS client_payments_key ON client_payments(record_key);
