// Copies every record from a SQLite data file into an empty PostgreSQL database, then
// reads each table back from both and compares them row by row. Everything runs in one
// PostgreSQL transaction: if any table differs, nothing is kept. The SQLite file is
// opened read-only and never changed.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { postgresDriver } from "./postgres.js";
import { migrate } from "./migrate.js";

// Parents before children, each with the columns that identify a row.
export const TABLES = [
  ["workspaces", ["id"]],
  ["users", ["id"]],
  ["coaching_relationships", ["id"]],
  ["workout_sessions", ["id"]],
  ["workout_sets", ["session_id", "position"]],
  ["sessions", ["token"]],
  ["invitations", ["token"]],
  ["coach_codes", ["code"]],
  ["media", ["id"]],
  ["media_access", ["media_id", "client_id"]],
  ["media_links", ["parent_id", "child_id"]],
  ["jobs", ["id"]],
  ["requests", ["user_id", "key"]],
  ["imports", ["id"]],
  ["payment_accounts", ["workspace_id"]],
  ["wearable_links", ["workspace_id", "client_id", "provider"]],
  ["wearable_states", ["state"]],
  ["wearable_days", ["workspace_id", "client_id", "provider", "date"]],
  ["wearable_events", ["id"]],
];

const fingerprint = (rows) => createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
// Sorted here rather than with ORDER BY: the two databases may order text differently.
const byKeys = (keys) => (a, b) => {
  const x = JSON.stringify(keys.map((k) => a[k])), y = JSON.stringify(keys.map((k) => b[k]));
  return x < y ? -1 : x > y ? 1 : 0;
};

export async function sqliteToPostgres(sqlitePath, databaseUrl) {
  const source = new DatabaseSync(sqlitePath, { readOnly: true });
  const target = postgresDriver(databaseUrl, { max: 2 });
  try {
    await migrate(target);
    const report = [];
    await target.transaction(async () => {
      for (const [table] of TABLES)
        if ((await target.get(`SELECT COUNT(*) AS n FROM ${table}`)).n > 0)
          throw new Error(`The PostgreSQL database already has records in "${table}". Convert only into an empty database.`);

      for (const [table, keys] of TABLES) {
        const exists = source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
        const targetColumns = (await target.all("SELECT column_name FROM information_schema.columns WHERE table_name=$1", [table])).map((c) => c.column_name);
        const sourceColumns = exists ? source.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name) : [];
        const missing = sourceColumns.filter((c) => !targetColumns.includes(c));
        if (missing.length) throw new Error(`"${table}" has columns PostgreSQL doesn't: ${missing.join(", ")}.`);
        const columns = sourceColumns;
        const rows = exists ? source.prepare(`SELECT ${columns.join(", ")} FROM ${table}`).all().sort(byKeys(keys)) : [];
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        for (const row of rows) await target.run(`INSERT INTO ${table}(${columns.join(", ")}) VALUES(${placeholders})`, columns.map((c) => row[c]));

        const copied = columns.length ? (await target.all(`SELECT ${columns.join(", ")} FROM ${table}`)).sort(byKeys(keys)) : [];
        const plain = (list) => list.map((r) => columns.map((c) => r[c]));
        const before = fingerprint(plain(rows)), after = fingerprint(plain(copied));
        if (rows.length !== copied.length || before !== after)
          throw new Error(`"${table}" did not copy exactly (${rows.length} rows read, ${copied.length} written). Nothing was kept.`);
        report.push({ table, rows: rows.length, fingerprint: after });
      }
    });
    return report;
  } finally {
    source.close();
    await target.close();
  }
}
