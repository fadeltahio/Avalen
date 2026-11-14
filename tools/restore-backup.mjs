// Restores a backup into an EMPTY database and proves it is complete: the dump's
// checksum must match its manifest, and after restoring, every table's row count and
// the schema version must match what was recorded when the backup was taken.
//
//   TARGET_DATABASE_URL=postgresql://…/avalen_restore node tools/restore-backup.mjs <key>
//   TARGET_DATABASE_URL=… node tools/restore-backup.mjs --file ./avalen.dump   (with ./avalen.dump.manifest.json)
//
// It refuses a target that already has tables, and a target equal to DATABASE_URL, so
// it can't overwrite a live database. Exit code 0 only when everything matches.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { backupBucket, connectionEnv, runTool, tableCounts } from "./backup-lib.mjs";

const pg = createRequire(import.meta.url)("pg");

export async function restoreBackup({ key, file, targetUrl = process.env.TARGET_DATABASE_URL, env = process.env } = {}) {
  if (!targetUrl) throw new Error("Missing TARGET_DATABASE_URL (an empty database to restore into).");
  if (env.DATABASE_URL && new URL(targetUrl).toString() === new URL(env.DATABASE_URL).toString())
    throw new Error("The target is the live database (DATABASE_URL). Restore into a separate, empty database.");
  let dump, manifest;
  if (file) {
    dump = readFileSync(file);
    manifest = JSON.parse(readFileSync(`${file}.manifest.json`, "utf8"));
  } else {
    const bucket = backupBucket(env);
    manifest = JSON.parse((await bucket.get(`${key}.manifest.json`)).toString());
    dump = await bucket.get(key);
  }
  const sha256 = createHash("sha256").update(dump).digest("hex");
  if (sha256 !== manifest.sha256) throw new Error("The backup file doesn't match its manifest checksum; it is damaged or incomplete. Nothing was restored.");

  const client = new pg.Client({ connectionString: targetUrl, application_name: "avalen-restore" });
  await client.connect();
  const dir = mkdtempSync(join(tmpdir(), "avalen-restore-"));
  try {
    const existing = Number((await client.query("SELECT COUNT(*) AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n);
    if (existing) throw new Error(`The target database already has ${existing} tables. Restore only into an empty database.`);
    const path = join(dir, "avalen.dump");
    writeFileSync(path, dump);
    await runTool("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction", `--dbname=${connectionEnv(targetUrl).PGDATABASE}`, path], targetUrl);
    const restored = await tableCounts((text) => client.query(text));
    const differences = [];
    for (const table of new Set([...Object.keys(manifest.counts), ...Object.keys(restored.counts)]))
      if (manifest.counts[table] !== restored.counts[table]) differences.push({ table, expected: manifest.counts[table] ?? null, restored: restored.counts[table] ?? null });
    if (manifest.schemaVersion !== restored.schemaVersion) differences.push({ table: "schema_migrations (version)", expected: manifest.schemaVersion, restored: restored.schemaVersion });
    return { key: manifest.key, takenAt: manifest.takenAt, tables: Object.keys(restored.counts).length, rows: Object.values(restored.counts).reduce((a, b) => a + b, 0), complete: differences.length === 0, differences };
  } finally {
    await client.end().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args[0] === "--file" ? args[1] : undefined;
  const key = file ? undefined : args[0];
  if (!file && !key) {
    console.error("Usage: TARGET_DATABASE_URL=… node tools/restore-backup.mjs <backup key> | --file <path>");
    process.exit(2);
  }
  try {
    const report = await restoreBackup({ key, file });
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.complete ? 0 : 1);
  } catch (error) {
    console.error(`Restore failed: ${error.message}`);
    process.exit(1);
  }
}
