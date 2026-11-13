// Copies a SQLite data file into an empty PostgreSQL database and verifies every table:
//   DATABASE_URL=postgres://… node tools/sqlite-to-postgres.mjs <path to avalen.sqlite>
// Stop the server (or make it read-only) first so nothing is written during the copy.
// The SQLite file is only read. If any table differs after copying, nothing is kept.
import { existsSync } from "node:fs";
import { sqliteToPostgres } from "../server/db/convert.js";

const [file] = process.argv.slice(2);
if (!file || !existsSync(file) || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=postgres://… node tools/sqlite-to-postgres.mjs <path to avalen.sqlite>");
  process.exit(1);
}
try {
  const report = await sqliteToPostgres(file, process.env.DATABASE_URL);
  for (const { table, rows, fingerprint } of report) console.log(`${table.padEnd(18)} ${String(rows).padStart(6)} rows  ${fingerprint}`);
  console.log("Copied and verified. Every table matches its SQLite original.");
} catch (e) {
  console.error(`Not converted: ${e.message}`);
  process.exit(1);
}
