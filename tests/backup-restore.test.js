// The off-site backup and the restore drill, end to end on a throwaway PostgreSQL:
// back up a database with real records, restore it into an empty one, prove every
// table matches, and sign in against the restored copy. Damaged backups and non-empty
// targets are refused without touching anything.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import { backupDatabase } from "../tools/backup-database.mjs";
import { restoreBackup } from "../tools/restore-backup.mjs";
import { createService } from "../server/app.js";
import { migrationFiles } from "../server/db/migrate.js";
import { fixture, testingPostgres } from "./helpers/service.js";
import { fakeR2 } from "./helpers/fake-r2.js";

const onlyPostgres = { skip: !testingPostgres && "needs PostgreSQL (pnpm test:postgres)" };
async function admin(sql) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql)).rows;
  } finally {
    await client.end();
  }
}
async function scratchDatabase() {
  const name = `restore_${randomBytes(4).toString("hex")}`;
  await admin(`CREATE DATABASE ${name}`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return { url: url.toString(), drop: () => admin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`) };
}

test("a backup restores completely into an empty database, and the app runs on the copy", onlyPostgres, async () => {
  const f = await fixture();
  const r2 = await fakeR2();
  const target = await scratchDatabase();
  const env = { AVALEN_BACKUP_R2_BUCKET: "avalen-backups", AVALEN_BACKUP_R2_ENDPOINT: r2.endpoint, AVALEN_BACKUP_R2_ACCESS_KEY_ID: "test-key", AVALEN_BACKUP_R2_SECRET_ACCESS_KEY: "test-secret" };
  try {
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Maya Chen", email: "maya@test.app", password: "client-password-123", code } });
    const seen = await f.call("/api/workspace", { account: client });
    const next = structuredClone(seen.data);
    next.foodLogs.push({ id: "oats", clientId: client.user.clientId, date: "2026-11-14", name: "Oats", kcal: 300 });
    next.sessions.push({ id: "w1", clientId: client.user.clientId, date: "2026-11-14", dayId: "d", title: "Upper", sets: [{ name: "Row", set: 1, weight: 50, reps: 10, kind: "Standard", skipped: false }], startedAt: 1, finishedAt: "x", duration: 1, prs: [] });
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } })).status, 200);

    const source = new URL(process.env.DATABASE_URL);
    source.pathname = `/${(await f.db.get("SELECT current_database() AS name")).name}`;
    const manifest = await backupDatabase({ databaseUrl: source.toString(), env, now: new Date("2026-11-14T03:00:00Z") });
    assert.equal(manifest.key, "avalen/2026-11-14/avalen-2026-11-14T03-00-00-000Z.dump");
    assert.ok(r2.objects.has(manifest.key) && r2.objects.has(`${manifest.key}.manifest.json`), "dump and manifest uploaded");
    assert.equal(manifest.counts.users, 2);
    assert.equal(manifest.counts.workout_sets, 1);
    assert.equal(manifest.schemaVersion, migrationFiles("postgres").at(-1).version, "the newest migration");

    const report = await restoreBackup({ key: manifest.key, targetUrl: target.url, env });
    assert.equal(report.complete, true, JSON.stringify(report.differences));
    assert.equal(report.tables, Object.keys(manifest.counts).length);

    const root = mkdtempSync(join(tmpdir(), "avalen-restored-"));
    const restored = await createService({ root, databaseUrl: target.url, setupToken: "x" });
    await new Promise((resolve) => restored.server.listen(0, "127.0.0.1", resolve));
    try {
      const res = await fetch(`http://127.0.0.1:${restored.server.address().port}/api/login`, { method: "POST", headers: { "X-Avalen": "1", "Content-Type": "application/json" }, body: JSON.stringify({ email: "maya@test.app", password: "client-password-123" }) });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body.data.foodLogs.map((r) => r.id), ["oats"]);
      assert.deepEqual(body.data.sessions.map((r) => r.id), ["w1"]);
    } finally {
      restored.server.closeAllConnections();
      await new Promise((resolve) => restored.server.close(resolve));
      await restored.db.close();
      rmSync(root, { recursive: true, force: true });
    }

    await assert.rejects(restoreBackup({ key: manifest.key, targetUrl: target.url, env }), /already has \d+ tables/, "a non-empty target is refused");
  } finally {
    await target.drop();
    await r2.close();
    await f.close();
  }
});

test("a damaged backup, a missing target and the live database as target are all refused", onlyPostgres, async () => {
  const f = await fixture();
  const r2 = await fakeR2();
  const target = await scratchDatabase();
  const env = { AVALEN_BACKUP_R2_BUCKET: "avalen-backups", AVALEN_BACKUP_R2_ENDPOINT: r2.endpoint, AVALEN_BACKUP_R2_ACCESS_KEY_ID: "test-key", AVALEN_BACKUP_R2_SECRET_ACCESS_KEY: "test-secret" };
  try {
    const source = new URL(process.env.DATABASE_URL);
    source.pathname = `/${(await f.db.get("SELECT current_database() AS name")).name}`;
    const manifest = await backupDatabase({ databaseUrl: source.toString(), env });
    const dump = Buffer.from(r2.objects.get(manifest.key));
    dump[dump.length - 10] ^= 0xff;
    r2.objects.set(manifest.key, dump);
    await assert.rejects(restoreBackup({ key: manifest.key, targetUrl: target.url, env }), /doesn't match its manifest checksum/);
    const client = new pg.Client({ connectionString: target.url });
    await client.connect();
    assert.equal(Number((await client.query("SELECT COUNT(*) AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n), 0, "nothing restored");
    await client.end();
    await assert.rejects(restoreBackup({ key: manifest.key, env: { ...env }, targetUrl: undefined }), /TARGET_DATABASE_URL/);
    await assert.rejects(restoreBackup({ key: manifest.key, targetUrl: source.toString(), env: { ...env, DATABASE_URL: source.toString() } }), /live database/);
    await assert.rejects(backupDatabase({ databaseUrl: source.toString(), env: {} }), /Missing AVALEN_BACKUP_R2_BUCKET/);
  } finally {
    await target.drop();
    await r2.close();
    await f.close();
  }
});
