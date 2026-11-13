import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fixture, testingPostgres } from "./helpers/service.js";
import { snapshotDatabase } from "../server/jobs.js";

test("a daily snapshot is a readable copy of the database, written once per day and pruned to the newest days", { skip: testingPostgres && "SQLite file snapshots only" }, async () => {
  const f = await fixture();
  try {
    const service = { store: f.store, root: f.root };
    const first = await snapshotDatabase(service, { now: new Date("2026-11-13T02:00:00Z"), keep: 2 });
    assert.ok(first && existsSync(first));
    const copy = new DatabaseSync(first, { readOnly: true });
    assert.equal(copy.prepare("SELECT count(*) AS n FROM users").get().n, (await f.db.get("SELECT count(*) AS n FROM users")).n);
    copy.close();
    assert.equal(await snapshotDatabase(service, { now: new Date("2026-11-13T20:00:00Z"), keep: 2 }), null, "same day is not copied twice");
    await snapshotDatabase(service, { now: new Date("2026-11-14T02:00:00Z"), keep: 2 });
    await snapshotDatabase(service, { now: new Date("2026-11-15T02:00:00Z"), keep: 2 });
    assert.deepEqual(readdirSync(join(service.root, "backups")).sort(), ["avalen-2026-11-14.sqlite", "avalen-2026-11-15.sqlite"]);
    assert.equal(await snapshotDatabase(service, { keep: 0 }), null, "0 turns snapshots off");
  } finally { await f.close(); }
});
