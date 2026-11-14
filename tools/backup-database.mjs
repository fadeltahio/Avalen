// Off-site database backup: a consistent pg_dump of DATABASE_URL, uploaded with a
// manifest to a separate private bucket (AVALEN_BACKUP_R2_*). Run daily by the backup
// cron job (see docs/DEPLOYMENT.md); delete old copies with a lifecycle rule on that
// bucket. Exits non-zero on any failure so the host marks the run as failed.
//
//   node tools/backup-database.mjs
//
// The manifest holds each table's row count, taken in the same database snapshot as
// the dump, so tools/restore-backup.mjs can prove a restore is complete.
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { backupBucket, runTool, tableCounts } from "./backup-lib.mjs";

const pg = createRequire(import.meta.url)("pg");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function backupDatabase({ databaseUrl = process.env.DATABASE_URL, env = process.env, now = new Date() } = {}) {
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");
  const bucket = backupBucket(env);
  const prefix = (env.AVALEN_BACKUP_PREFIX || "avalen").replace(/^\/+|\/+$/g, "");
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const key = `${prefix}/${now.toISOString().slice(0, 10)}/avalen-${stamp}.dump`;
  const dir = mkdtempSync(join(tmpdir(), "avalen-backup-"));
  const client = new pg.Client({ connectionString: databaseUrl, application_name: "avalen-backup" });
  await client.connect();
  try {
    // Hold one snapshot open: the dump and the row counts see exactly the same data.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
    const file = join(dir, "avalen.dump");
    await runTool("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--snapshot=${snapshot}`, `--file=${file}`], databaseUrl);
    const { counts, schemaVersion } = await tableCounts((text) => client.query(text));
    const serverVersion = (await client.query("SHOW server_version")).rows[0].server_version;
    await client.query("COMMIT");
    const dump = readFileSync(file);
    const manifest = { key, takenAt: now.toISOString(), bytes: statSync(file).size, sha256: sha256(dump), serverVersion, schemaVersion, counts };
    await bucket.put(key, dump, manifest.sha256);
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
    await bucket.put(`${key}.manifest.json`, manifestBytes, sha256(manifestBytes));
    return manifest;
  } finally {
    await client.end().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const manifest = await backupDatabase();
    const rows = Object.values(manifest.counts).reduce((a, b) => a + b, 0);
    console.log(JSON.stringify({ level: "info", msg: "backup uploaded", key: manifest.key, bytes: manifest.bytes, tables: Object.keys(manifest.counts).length, rows, schemaVersion: manifest.schemaVersion }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "backup failed", message: error.message }));
    process.exit(1);
  }
}
