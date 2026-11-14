// A database that drops connections, refuses them or stops answering must never take
// the server down or lose acknowledged data: the affected request gets a 503 with
// nothing saved, and the next request works again. Most cases need a real PostgreSQL
// server (`pnpm test:postgres`); the first runs on both databases.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import { postgresDriver } from "../server/db/postgres.js";
import { fixture, testingPostgres } from "./helpers/service.js";

const onlyPostgres = { skip: !testingPostgres && "needs PostgreSQL (pnpm test:postgres)" };
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const count = async (f, sql, params = []) => Number((await f.db.get(sql, params)).n);

async function admin(sql, params = []) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}
const databaseOf = async (f) => (await f.db.get("SELECT current_database() AS name")).name;
const dropConnections = (name) => admin("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()", [name]);

// A client with a meal ready to save; returns the request body so it can be retried.
async function pendingMeal(f, id = "meal-1") {
  const { code } = await f.call("/api/coach-code", { account: f.coach });
  const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Maya Chen", email: "maya@test.app", password: "client-password-123", code } });
  const seen = await f.call("/api/workspace", { account: client });
  const next = structuredClone(seen.data);
  next.foodLogs.push({ id, clientId: client.user.clientId, date: today, name: "Oats", kcal: 300 });
  return { client, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } };
}
const workspaceRow = async (f) => f.db.get("SELECT w.revision, w.data FROM workspaces w JOIN users u ON u.workspace_id=w.id WHERE u.email='coach@test.app'");

test("a save that hits an unavailable database answers 503, keeps nothing, and the retry saves once", async () => {
  const f = await fixture();
  try {
    const { client, body } = await pendingMeal(f);
    const before = await workspaceRow(f);
    const original = f.store.records.sync;
    // The connection is lost after the workouts were written, partway through the save.
    f.store.records.sync = async (area, ...rest) => {
      if (area.collection === "foodLogs") throw Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" });
      return original(area, ...rest);
    };
    const key = randomUUID();
    let failed;
    try {
      failed = await f.call("/api/workspace", { method: "PATCH", account: client, body, headers: { "Idempotency-Key": key } });
    } finally {
      f.store.records.sync = original;
    }
    assert.equal(failed.status, 503);
    assert.match(failed.error, /nothing was saved/);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE record_key='id:meal-1'"), 0);
    assert.deepEqual({ ...(await workspaceRow(f)) }, { ...before }, "revision and document unchanged");

    const retried = await f.call("/api/workspace", { method: "PATCH", account: client, body, headers: { "Idempotency-Key": key } });
    assert.equal(retried.status, 200, retried.error);
    const again = await f.call("/api/workspace", { method: "PATCH", account: client, body, headers: { "Idempotency-Key": key } });
    assert.equal(again.status, 200, "a repeated retry is answered from the first result");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE record_key='id:meal-1'"), 1, "saved exactly once");
  } finally {
    await f.close();
  }
});

test("connections closed by the database while idle don't crash the server; the next requests work", onlyPostgres, async () => {
  const f = await fixture();
  try {
    const name = await databaseOf(f);
    for (let round = 0; round < 3; round++) {
      assert.equal((await f.call("/api/workspace", { account: f.coach })).status, 200);
      const killed = await dropConnections(name);
      assert.ok(killed.length >= 1, "at least one server connection was ended");
      await sleep(200);
      assert.equal((await f.call("/api/workspace", { account: f.coach })).status, 200, `round ${round + 1}: served after the drop`);
    }
  } finally {
    await f.close();
  }
});

test("a connection lost in the middle of a save answers 503, rolls back, and the server keeps serving", onlyPostgres, async () => {
  const f = await fixture();
  try {
    const { client, body } = await pendingMeal(f);
    const before = await workspaceRow(f);
    const original = f.store.records.sync;
    // Ends this request's own database connection between two writes of the save.
    f.store.records.sync = async (area, ...rest) => {
      if (area.collection === "foodLogs") await f.db.get("SELECT pg_terminate_backend(pg_backend_pid())");
      return original(area, ...rest);
    };
    let failed;
    try {
      failed = await f.call("/api/workspace", { method: "PATCH", account: client, body });
    } finally {
      f.store.records.sync = original;
    }
    assert.equal(failed.status, 503, failed.error);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE record_key='id:meal-1'"), 0);
    assert.deepEqual({ ...(await workspaceRow(f)) }, { ...before });
    const health = await fetch(`${f.base}/api/health`);
    assert.equal(health.status, 200, "the instance is healthy again");
    const retried = await f.call("/api/workspace", { method: "PATCH", account: client, body });
    assert.equal(retried.status, 200, retried.error);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE record_key='id:meal-1'"), 1);
  } finally {
    await f.close();
  }
});

test("while the database refuses connections, requests and the health check fail fast with 503, then recover", onlyPostgres, async () => {
  const f = await fixture();
  const name = await databaseOf(f);
  try {
    await admin(`ALTER DATABASE ${name} ALLOW_CONNECTIONS false`);
    await dropConnections(name);
    await sleep(200);
    const started = Date.now();
    const refused = await f.call("/api/workspace", { account: f.coach });
    assert.equal(refused.status, 503, refused.error);
    const health = await fetch(`${f.base}/api/health`);
    assert.equal(health.status, 503);
    assert.equal((await health.json()).checks.database, "unavailable");
    assert.ok(Date.now() - started < 8000, "answered within the connection timeout, not hung");

    await admin(`ALTER DATABASE ${name} ALLOW_CONNECTIONS true`);
    assert.equal((await f.call("/api/workspace", { account: f.coach })).status, 200);
    assert.equal((await fetch(`${f.base}/api/health`)).status, 200);
  } finally {
    await admin(`ALTER DATABASE ${name} ALLOW_CONNECTIONS true`).catch(() => {});
    await f.close();
  }
});

test("a statement that runs too long and a database that never answers both fail instead of hanging", onlyPostgres, async () => {
  const f = await fixture();
  const slow = postgresDriver(process.env.DATABASE_URL, { statementTimeout: 200 });
  const silent = createServer(() => {}); // accepts the connection, never replies
  await new Promise((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const hung = postgresDriver(`postgres://user:pass@127.0.0.1:${silent.address().port}/db`, { connectionTimeout: 500 });
  try {
    await assert.rejects(slow.get("SELECT pg_sleep(3)"), (e) => e.unavailable === true && e.code === "57014");
    assert.equal((await slow.get("SELECT 1 AS ok")).ok, 1, "the same pool keeps working afterwards");
    const started = Date.now();
    await assert.rejects(hung.get("SELECT 1"), (e) => e.unavailable === true);
    await assert.rejects(hung.transaction(async () => {}), (e) => e.unavailable === true);
    assert.ok(Date.now() - started < 3000, "gave up after the connection timeout");
  } finally {
    await slow.close();
    await hung.close().catch(() => {});
    silent.close();
    await f.close();
  }
});

test("the real server process survives the database ending every connection (the audit's crash)", onlyPostgres, async () => {
  const f = await fixture();
  const name = await databaseOf(f);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  const dir = mkdtempSync(join(tmpdir(), "avalen-recovery-"));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: url.toString(), AVALEN_SECRETS_KEY: randomBytes(32).toString("base64"), AVALEN_DATA_DIR: dir, PORT: String(port), AVALEN_SETUP_TOKEN: "unused-setup-token" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  let exited = null;
  child.on("exit", (code) => (exited = code));
  try {
    for (let i = 0; i < 100 && !output.includes("Avalen service"); i++) await sleep(100);
    assert.match(output, /Avalen service/);
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    await dropConnections(name);
    await sleep(1500);
    assert.equal(exited, null, `the process is still running\n${output}`);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/status`)).status, 200);
    assert.match(output, /database connection closed while idle/, "the drop was logged");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    rmSync(dir, { recursive: true, force: true });
    await f.close();
  }
});
