-- Coaching relationships and client-owned workout history (Phase 2).
-- A relationship links a coach's workspace to one of its clients, and to that client's
-- login once they have one. A workout belongs to the client; relationship_id records
-- which coaching relationship it was logged under.
CREATE TABLE IF NOT EXISTS coaching_relationships(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  client_id TEXT NOT NULL,
  client_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK(status IN ('active','ended')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE(workspace_id, client_id));
-- One coach at a time for a client with an account (removable for a future marketplace).
CREATE UNIQUE INDEX IF NOT EXISTS one_active_coach ON coaching_relationships(client_user_id) WHERE status='active' AND client_user_id IS NOT NULL;

-- data holds the workout exactly as the app recorded it; the other columns and the
-- sets table repeat what can be queried. seq keeps the order the workouts were saved in.
CREATE TABLE IF NOT EXISTS workout_sessions(
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,
  training_date TEXT NOT NULL,
  day_id TEXT,
  title TEXT NOT NULL,
  started_at INTEGER,
  finished_at TEXT,
  duration_s INTEGER,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS workout_sessions_client ON workout_sessions(client_id, training_date);
CREATE INDEX IF NOT EXISTS workout_sessions_relationship ON workout_sessions(relationship_id, seq);

CREATE TABLE IF NOT EXISTS workout_sets(
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  exercise_id TEXT,
  exercise_name TEXT NOT NULL,
  set_number INTEGER,
  kind TEXT,
  weight_kg REAL,
  reps REAL,
  effort TEXT,
  skipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(session_id, position));
CREATE INDEX IF NOT EXISTS workout_sets_exercise ON workout_sets(exercise_id);
