import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sqliteDriver } from "../server/db/sqlite.js";
import { migrate, migrationFiles } from "../server/db/migrate.js";
import { openStore } from "../server/store/index.js";
import { fixture, testingPostgres } from "./helpers/service.js";

const folder = () => mkdtempSync(join(tmpdir(), "avalen-storage-"));

test("migrations run once on a new database and are recorded", async () => {
  const dir = folder();
  try {
    const db = sqliteDriver(join(dir, "avalen.sqlite"));
    assert.deepEqual(await migrate(db), migrationFiles("sqlite").map((f) => f.version));
    assert.deepEqual(await migrate(db), [], "a second run applies nothing");
    assert.ok(await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='wearable_links'"));
    await db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a database created by the earlier code keeps its records", async () => {
  const dir = folder();
  try {
    const legacy = new DatabaseSync(join(dir, "avalen.sqlite"));
    legacy.exec(readFileSync(new URL("../server/migrations/sqlite/001_base.sql", import.meta.url), "utf8"));
    legacy.exec("CREATE TABLE migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); INSERT INTO migrations VALUES(1, 'x'), (2, 'y');");
    legacy.exec(`INSERT INTO workspaces(id, data) VALUES('w1', '{"clients":[]}')`);
    legacy.exec("INSERT INTO users VALUES('u1', 'coach@test.app', 'hash', 'coach', 'w1', NULL)");
    legacy.close();
    const store = await openStore(dir);
    assert.equal((await store.users.byEmail("coach@test.app")).id, "u1");
    assert.deepEqual((await store.workspaces.get("w1")).data, { clients: [] });
    await store.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("transactions run one at a time even when each awaits in the middle", async () => {
  const dir = folder();
  try {
    const db = sqliteDriver(join(dir, "avalen.sqlite"));
    await db.exec("CREATE TABLE counter(id INTEGER PRIMARY KEY, n INTEGER NOT NULL); INSERT INTO counter VALUES(1, 0);");
    const bump = () =>
      db.transaction(async () => {
        const { n } = await db.get("SELECT n FROM counter WHERE id=1");
        await new Promise((resolve) => setTimeout(resolve, 5));
        await db.run("UPDATE counter SET n=$1 WHERE id=1", [n + 1]);
      });
    await Promise.all(Array.from({ length: 10 }, bump));
    assert.equal((await db.get("SELECT n FROM counter WHERE id=1")).n, 10, "no update was lost");
    await db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed transaction leaves nothing behind and later work continues", async () => {
  const dir = folder();
  try {
    const db = sqliteDriver(join(dir, "avalen.sqlite"));
    await db.exec("CREATE TABLE notes(id TEXT PRIMARY KEY)");
    await assert.rejects(
      db.transaction(async () => {
        await db.run("INSERT INTO notes VALUES($1)", ["kept-out"]);
        throw new Error("stop");
      }),
      /stop/,
    );
    assert.equal(await db.get("SELECT id FROM notes WHERE id=$1", ["kept-out"]), null);
    await db.run("INSERT INTO notes VALUES($1)", ["after"]);
    assert.ok(await db.get("SELECT id FROM notes WHERE id=$1", ["after"]));
    await db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("numbered placeholders bind by number, including a reused one", async () => {
  const dir = folder();
  try {
    const db = sqliteDriver(join(dir, "avalen.sqlite"));
    const row = await db.get("SELECT $2 AS second, $1 AS first, $1 || $2 AS both", ["a", "b"]);
    assert.deepEqual({ ...row }, { second: "b", first: "a", both: "ab" });
    await db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The same guarantees on PostgreSQL, run by `pnpm test:postgres`.
const onPostgres = { skip: !testingPostgres && "runs under pnpm test:postgres" };

test("postgres: migrations run once and millisecond timestamps round-trip as numbers", onPostgres, async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await migrate(f.db), [], "the fixture already applied every migration");
    const row = await f.db.get("SELECT expires FROM sessions LIMIT 1");
    assert.equal(typeof row.expires, "number");
    assert.ok(row.expires > Date.now());
  } finally {
    await f.close();
  }
});

test("postgres: two saves to one workspace at the same moment both land, in turn", onPostgres, async () => {
  const f = await fixture();
  try {
    const { revision } = await f.call("/api/workspace", { account: f.coach });
    const user = await f.db.get("SELECT * FROM users WHERE role='coach'");
    const save = (label) =>
      f.commit(user, undefined, async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        data.savedViews.push({ id: label, name: label });
        return data;
      });
    await Promise.all([save("first"), save("second")]);
    const after = await f.load(user);
    assert.deepEqual(after.data.savedViews.map((v) => v.id).sort(), ["first", "second"], "neither save was lost");
    assert.equal(after.revision, revision + 2);
  } finally {
    await f.close();
  }
});

test("postgres: a failed transaction leaves nothing behind", onPostgres, async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.db.transaction(async () => {
        await f.db.run("INSERT INTO imports(id, workspace_id, data, at) VALUES($1, $2, $3, $4)", ["kept-out", "w", "{}", "now"]);
        throw new Error("stop");
      }),
      /stop/,
    );
    assert.equal(await f.db.get("SELECT id FROM imports WHERE id=$1", ["kept-out"]), null);
  } finally {
    await f.close();
  }
});

test("postgres: a second sign-up racing with the same email is told the email is taken", onPostgres, async () => {
  const f = await fixture();
  try {
    const signup = () =>
      f.call("/api/signup/coach", { method: "POST", body: { name: "Racer", email: "race@test.app", password: "strong-password-123" } });
    const statuses = (await Promise.all([signup(), signup(), signup()])).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409]);
  } finally {
    await f.close();
  }
});
