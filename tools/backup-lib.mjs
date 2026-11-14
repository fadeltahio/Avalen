// Shared by tools/backup-database.mjs and tools/restore-backup.mjs: the backup bucket
// client, the PostgreSQL tools and the per-table row counts kept in each manifest.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

export const pgTool = (name) => (process.env.PG_BIN ? join(process.env.PG_BIN, name) : name);

// The connection's parts as libpq environment variables, so the password never appears
// on a command line or in process listings.
export function connectionEnv(connectionString) {
  const url = new URL(connectionString);
  const sslmode = url.searchParams.get("sslmode");
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.username ? { PGUSER: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { PGPASSWORD: decodeURIComponent(url.password) } : {}),
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
  };
}

export function runTool(name, args, connectionString) {
  return new Promise((resolve, reject) => {
    const child = spawn(pgTool(name), args, { env: { ...process.env, ...connectionEnv(connectionString) }, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => reject(new Error(`${name} could not run: ${e.message}`)));
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${name} failed (exit ${code}): ${stderr.trim().split("\n").slice(-3).join(" ")}`))));
  });
}

export function backupBucket(env = process.env) {
  const names = ["AVALEN_BACKUP_R2_BUCKET", "AVALEN_BACKUP_R2_ENDPOINT", "AVALEN_BACKUP_R2_ACCESS_KEY_ID", "AVALEN_BACKUP_R2_SECRET_ACCESS_KEY"];
  const missing = names.filter((n) => !env[n]);
  if (missing.length) throw new Error(`Missing ${missing.join(", ")}.`);
  const client = new AwsClient({ accessKeyId: env.AVALEN_BACKUP_R2_ACCESS_KEY_ID, secretAccessKey: env.AVALEN_BACKUP_R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  const base = `${env.AVALEN_BACKUP_R2_ENDPOINT.replace(/\/+$/, "")}/${encodeURIComponent(env.AVALEN_BACKUP_R2_BUCKET)}`;
  const url = (key) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return {
    async put(key, bytes, hash) {
      const res = await fetch(await client.sign(url(key), { method: "PUT", body: bytes, headers: { "Content-Type": "application/octet-stream", "X-Amz-Content-Sha256": hash } }));
      if (!res.ok) throw new Error(`The backup bucket refused ${key} (${res.status}).`);
    },
    async get(key) {
      const res = await fetch(await client.sign(url(key), { method: "GET" }));
      if (!res.ok) throw new Error(`The backup bucket could not return ${key} (${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// Row counts for every table, plus the schema version, read through `query`.
export async function tableCounts(query) {
  const tables = (await query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r) => r.tablename);
  const counts = {};
  for (const table of tables) counts[table] = Number((await query(`SELECT COUNT(*) AS n FROM "${table}"`)).rows[0].n);
  const schemaVersion = tables.includes("schema_migrations") ? Number((await query("SELECT MAX(version) AS v FROM schema_migrations")).rows[0].v) : null;
  return { counts, schemaVersion };
}
