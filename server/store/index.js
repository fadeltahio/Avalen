// The storage layer: every read and write the server makes goes through these named
// functions, so routes and services never contain SQL. Swapping the database (Phase 1)
// or splitting a workspace into tables (Phase 2) changes this folder, not its callers.
import { join } from "node:path";
import { sqliteDriver } from "../db/sqlite.js";
import { postgresDriver } from "../db/postgres.js";
import { migrate } from "../db/migrate.js";
import { accountStore } from "./accounts.js";
import { workspaceStore } from "./workspaces.js";
import { mediaStore } from "./media.js";
import { jobStore } from "./jobs.js";
import { integrationStore } from "./integrations.js";

export function createStore(db) {
  return {
    db,
    transaction: (fn) => db.transaction(fn),
    ...accountStore(db),
    ...workspaceStore(db),
    media: mediaStore(db),
    jobs: jobStore(db),
    ...integrationStore(db),
  };
}

// PostgreSQL when a connection address is given (DATABASE_URL in production),
// otherwise a SQLite file in the data folder.
export async function openStore(root, { databaseUrl } = {}) {
  const db = databaseUrl ? postgresDriver(databaseUrl) : sqliteDriver(join(root, "avalen.sqlite"));
  await migrate(db);
  const store = createStore(db);
  await store.workspaces.moveInlineWorkouts();
  return store;
}
