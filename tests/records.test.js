import test from "node:test";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { foundations } from "../src/avalen/ecosystem/memory.js";
import { AREAS } from "../server/store/records.js";
import { fixture } from "./helpers/service.js";

const count = async (f, sql, params = []) => Number((await f.db.get(sql, params)).n);

test("every client-related list moves to its own table, with queryable columns, and reads back identically", async () => {
  const f = await fixture();
  try {
    const demo = foundations(createWorkspace());
    const id = "legacy-areas", text = JSON.stringify(demo);
    await f.db.run("INSERT INTO workspaces(id, data) VALUES($1, $2)", [id, text]);
    assert.deepEqual((await f.store.workspaces.moveInlineRecords()).moved, [id]);

    const document = JSON.parse((await f.db.get("SELECT data FROM workspaces WHERE id=$1", [id])).data);
    for (const area of AREAS) {
      const present = Array.isArray(demo[area.collection]);
      assert.deepEqual(document[area.collection], present ? [] : undefined, `${area.collection} no longer sits in the document`);
      assert.equal(await count(f, `SELECT COUNT(*) AS n FROM ${area.table} WHERE workspace_id=$1`, [id]), present ? demo[area.collection].length : 0, `${area.table} holds every ${area.collection} row`);
    }
    assert.equal(JSON.stringify((await f.store.workspaces.get(id)).data), text, "the workspace is identical to before");

    const kcal = demo.foodLogs.reduce((sum, r) => sum + r.kcal, 0);
    assert.equal(Math.round(Number((await f.db.get("SELECT SUM(kcal) AS total FROM food_logs WHERE workspace_id=$1", [id])).total)), Math.round(kcal), "calories are queryable");
    const latest = demo.measurements.filter((m) => m.clientId === demo.clients[0].id).sort((a, b) => b.date.localeCompare(a.date))[0];
    const row = await f.db.get("SELECT weight_kg FROM measurements WHERE workspace_id=$1 AND client_id=$2 ORDER BY record_date DESC LIMIT 1", [id, demo.clients[0].id]);
    assert.equal(row.weight_kg, latest.weight ?? null, "weights are queryable by client and date");
    const paid = demo.payments.filter((p) => p.status === "paid").length;
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM client_payments WHERE workspace_id=$1 AND status='paid'", [id]), paid, "payment status is queryable");
    const linked = await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE workspace_id=$1 AND relationship_id IS NOT NULL", [id]);
    assert.equal(linked, demo.foodLogs.length, "each row is tied to the client's coaching relationship");
  } finally {
    await f.close();
  }
});

test("a save that reorders a list is stored in exactly that order", async () => {
  const f = await fixture();
  try {
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Sophie Williams", email: "sophie@test.app", password: "client-password-123", code } });
    const workspaceId = (await f.db.get("SELECT workspace_id FROM users WHERE role='coach'")).workspace_id;
    const seed = (await f.store.workspaces.get(workspaceId)).data;
    const other = seed.clients.find((c) => c.id !== client.user.clientId).id;
    seed.foodLogs.push(
      { id: "a", clientId: client.user.clientId, date: "2026-11-10", name: "Oats", kcal: 300 },
      { id: "b", clientId: other, date: "2026-11-10", name: "Rice", kcal: 400 },
    );
    await f.store.workspaces.save(workspaceId, seed);

    // The server keeps the other clients' rows first and puts the client's own rows last.
    const current = await f.call("/api/workspace", { account: client });
    const data = structuredClone(current.data);
    data.foodLogs.push({ id: "c", clientId: client.user.clientId, date: "2026-11-11", name: "Eggs", kcal: 150 });
    const saved = await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: current.revision, changes: workspaceChanges(current.data, data) } });
    assert.equal(saved.status, 200, saved.error);
    const coach = (await f.store.workspaces.get(workspaceId)).data;
    assert.deepEqual(coach.foodLogs.map((r) => r.id), ["b", "a", "c"]);
  } finally {
    await f.close();
  }
});

test("rows without an id that repeat (the same client and date twice) are all kept", async () => {
  const f = await fixture();
  try {
    const workspaceId = (await f.db.get("SELECT workspace_id FROM users WHERE role='coach'")).workspace_id;
    const data = (await f.store.workspaces.get(workspaceId)).data;
    const clientId = data.clients[0].id;
    data.habitLogs.push({ clientId, date: "2026-11-12", values: { water: 1 } }, { clientId, date: "2026-11-12", values: { water: 2 } });
    await f.store.workspaces.save(workspaceId, data);
    const back = (await f.store.workspaces.get(workspaceId)).data.habitLogs.filter((r) => r.date === "2026-11-12");
    assert.deepEqual(back.map((r) => r.values.water), [1, 2]);
    data.habitLogs = data.habitLogs.filter((r) => !(r.date === "2026-11-12" && r.values.water === 1));
    await f.store.workspaces.save(workspaceId, data);
    assert.deepEqual((await f.store.workspaces.get(workspaceId)).data.habitLogs.filter((r) => r.date === "2026-11-12").map((r) => r.values.water), [2]);
  } finally {
    await f.close();
  }
});

test("a save rewrites only the lists it changed", async () => {
  const f = await fixture();
  try {
    const user = await f.db.get("SELECT * FROM users WHERE role='coach'");
    const clientId = (await f.load(user)).data.clients[0].id;
    // A row placed straight in the habits table, which a full rewrite of habits would remove.
    await f.db.run("INSERT INTO habit_logs(workspace_id, record_key, client_id, record_date, seq, data) VALUES($1, $2, $3, $4, $5, $6)", [user.workspace_id, "probe", clientId, "2026-11-01", 999, JSON.stringify({ clientId, date: "2026-11-01", values: {} })]);
    await f.commit(user, undefined, (data) => {
      data.foodLogs.push({ id: "only-food", clientId, date: "2026-11-14", name: "Oats", kcal: 300 });
      return data;
    });
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE record_key='id:only-food'"), 1, "the changed list is written");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM habit_logs WHERE record_key='probe'"), 1, "an unchanged list isn't rewritten");
  } finally {
    await f.close();
  }
});
