import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { sqliteToPostgres } from "../server/db/convert.js";
import { fixture, testingPostgres } from "./helpers/service.js";
import { openStore } from "../server/store/index.js";

const onPostgres = { skip: !testingPostgres && "runs under pnpm test:postgres" };
async function emptyDatabase() {
  const name = `convert_${randomBytes(6).toString("hex")}`, admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}

test("postgres: a SQLite workspace converts exactly, and the converted server signs the same people in", onPostgres, async () => {
  // A SQLite-backed service with real activity: a coach, a client who joined by code, a wearable reading.
  const f = await fixture({ databaseUrl: "" }); // empty address: SQLite even under test:postgres
  const target = await emptyDatabase();
  try {
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Maya Chen", email: "maya@test.app", password: "client-password-123", code } });
    assert.equal(client.status, 200);
    const today = new Date().toISOString().slice(0, 10);
    await f.call("/api/wearables/upload", { method: "POST", account: client, body: { provider: "manual", days: [{ date: today, metrics: { sleepMinutes: 420 } }] } });
    const current = await f.call("/api/workspace", { account: client });
    const data = structuredClone(current.data);
    data.sessions.push({ id: "converted-workout", clientId: client.user.clientId, date: today, dayId: data.clients[0].program.days[0].id, title: "Upper Body A", sets: [{ name: "Bench press", exerciseId: "bench", set: 1, weight: 60, reps: 8, kind: "Standard", skipped: false }], startedAt: Date.now(), finishedAt: new Date().toISOString(), duration: 1200, prs: [] });
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: current.revision, data } })).status, 200);
    const before = await f.store.workspaces.all();

    const report = await sqliteToPostgres(join(f.root, "avalen.sqlite"), target.url);
    assert.equal(report.find((r) => r.table === "users").rows, 2);
    assert.equal(report.find((r) => r.table === "wearable_days").rows, 1);
    assert.equal(report.find((r) => r.table === "workout_sessions").rows, 1);
    assert.equal(report.find((r) => r.table === "workout_sets").rows, 1);
    assert.equal(report.find((r) => r.table === "coaching_relationships").rows, 2);

    const converted = await openStore(f.root, { databaseUrl: target.url });
    try {
      assert.deepEqual(await converted.workspaces.all(), before, "every workspace document is identical");
      assert.equal((await converted.users.byEmail("maya@test.app")).client_id, client.user.clientId);
      assert.ok(await converted.coachCodes.workspaceFor(code.replace("-", "")), "the coach code still works");
    } finally {
      await converted.db.close();
    }

    await assert.rejects(sqliteToPostgres(join(f.root, "avalen.sqlite"), target.url), /already has records in "workspaces"/, "refuses a database that isn't empty");
  } finally {
    await f.close();
    await target.drop();
  }
});
