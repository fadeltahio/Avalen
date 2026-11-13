import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { foundations } from "../src/avalen/ecosystem/memory.js";
import { projection } from "../server/permissions.js";
import { fixture } from "./helpers/service.js";

// A workspace as stored before Phase 2: every workout inside the JSON document.
async function legacyWorkspace(f, data) {
  const id = `legacy-${Math.random().toString(36).slice(2)}`;
  const text = JSON.stringify(data);
  await f.db.run("INSERT INTO workspaces(id, data) VALUES($1, $2)", [id, text]);
  return { id, text };
}
const count = async (f, sql, params = []) => Number((await f.db.get(sql, params)).n);

test("workouts move out of the workspace document into their own tables and read back byte for byte", async () => {
  const f = await fixture();
  try {
    const demo = foundations(createWorkspace());
    const sets = demo.sessions.reduce((n, s) => n + s.sets.length, 0);
    const { id, text } = await legacyWorkspace(f, demo);

    const report = await f.store.workspaces.moveInlineWorkouts();
    assert.deepEqual(report.moved, [id]);
    assert.deepEqual(report.failed, []);

    const stored = JSON.parse((await f.db.get("SELECT data FROM workspaces WHERE id=$1", [id])).data);
    assert.deepEqual(stored.sessions, [], "the document no longer holds workouts");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sessions"), demo.sessions.length);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sets"), sets);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM coaching_relationships WHERE workspace_id=$1 AND status='active'", [id]), demo.clients.length);

    const rebuilt = await f.store.workspaces.get(id);
    assert.equal(JSON.stringify(rebuilt.data), text, "the coach's workspace is identical to before");
    for (const client of demo.clients) {
      const viewer = { role: "client", client_id: client.id };
      assert.equal(JSON.stringify(projection(rebuilt.data, viewer)), JSON.stringify(projection(JSON.parse(text), viewer)), `${client.name}'s view is identical`);
    }
    const squat = await f.db.get("SELECT exercise_name, weight_kg, reps FROM workout_sets WHERE session_id=$1 AND position=0", [demo.sessions[0].id]);
    assert.deepEqual({ ...squat }, { exercise_name: demo.sessions[0].sets[0].name, weight_kg: demo.sessions[0].sets[0].weight, reps: demo.sessions[0].sets[0].reps }, "sets are queryable rows");

    assert.deepEqual((await f.store.workspaces.moveInlineWorkouts()).moved, [], "running it again changes nothing");
  } finally {
    await f.close();
  }
});

test("a workspace that can't be rebuilt exactly is left as it was", async () => {
  const f = await fixture();
  try {
    const demo = foundations(createWorkspace());
    demo.sessions.push({ ...demo.sessions[0] }); // the same workout id twice can't be stored as two rows
    const { id, text } = await legacyWorkspace(f, demo);
    const report = await f.store.workspaces.moveInlineWorkouts();
    assert.equal(report.failed[0]?.id, id);
    assert.equal((await f.db.get("SELECT data FROM workspaces WHERE id=$1", [id])).data, text, "the document is untouched");
    assert.equal(JSON.stringify((await f.store.workspaces.get(id)).data), text, "and still reads the same");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sessions"), 0);
  } finally {
    await f.close();
  }
});

test("a workout logged in the app is stored under the client's relationship, and the coach sees it", async () => {
  const f = await fixture();
  try {
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Maya Chen", email: "maya@test.app", password: "client-password-123", code } });
    const relationship = await f.db.get("SELECT * FROM coaching_relationships WHERE client_id=$1", [client.user.clientId]);
    assert.equal(relationship.status, "active");
    assert.equal(relationship.client_user_id, client.user.id, "the relationship is linked to the client's login");

    const current = await f.call("/api/workspace", { account: client });
    const data = structuredClone(current.data);
    const workout = {
      id: "workout-1", clientId: client.user.clientId, date: new Date().toISOString().slice(0, 10), dayId: data.clients[0].program.days[0].id, title: "Upper Body A",
      sets: [{ id: "set-1", name: "Bench press", exerciseId: "bench", set: 1, weight: 60, reps: 8, effort: "Good", kind: "Standard", skipped: false }],
      startedAt: Date.now() - 1800000, finishedAt: new Date().toISOString(), duration: 1800, prs: [],
    };
    data.sessions.push(workout);
    const saved = await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: current.revision, data } });
    assert.equal(saved.status, 200, saved.error);

    const row = await f.db.get("SELECT client_id, relationship_id, title, duration_s FROM workout_sessions WHERE id='workout-1'");
    assert.deepEqual({ ...row }, { client_id: client.user.clientId, relationship_id: relationship.id, title: "Upper Body A", duration_s: 1800 });
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sets WHERE session_id='workout-1'"), 1);
    const coachView = await f.call("/api/workspace", { account: f.coach });
    assert.deepEqual(coachView.data.sessions.find((s) => s.id === "workout-1"), workout);

    const rewrite = structuredClone(saved.data);
    rewrite.sessions.find((s) => s.id === "workout-1").sets[0].weight = 90;
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: saved.revision, data: rewrite } })).status, 409, "completed workouts still can't be rewritten");
  } finally {
    await f.close();
  }
});

test("removing a client ends the relationship but keeps their workouts; deleting their account removes them", async () => {
  const f = await fixture();
  try {
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Liam Parker", email: "liam@test.app", password: "client-password-123", code } });
    const current = await f.call("/api/workspace", { account: client });
    const data = structuredClone(current.data);
    data.sessions.push({ id: "kept", clientId: client.user.clientId, date: new Date().toISOString().slice(0, 10), dayId: data.clients[0].program.days[0].id, title: "Lower Body A", sets: [{ name: "Back squat", exerciseId: "squat", set: 1, weight: 80, reps: 5, kind: "Standard", skipped: false }], startedAt: Date.now(), finishedAt: new Date().toISOString(), duration: 600, prs: [] });
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: current.revision, data } })).status, 200);

    const deleted = await f.call("/api/account/delete", { method: "POST", account: client, body: { confirm: "DELETE", password: "client-password-123" } });
    assert.equal(deleted.status, 200);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sessions WHERE client_id=$1", [client.user.clientId]), 0, "their workouts are gone");
    const relationship = await f.db.get("SELECT status, client_user_id FROM coaching_relationships WHERE client_id=$1", [client.user.clientId]);
    assert.deepEqual({ ...relationship }, { status: "ended", client_user_id: null }, "the relationship is ended and no longer points at the deleted login");

    // A coach removing a client from their list keeps that client's history.
    const coach = await f.call("/api/workspace", { account: f.coach });
    const workspaceId = (await f.db.get("SELECT workspace_id FROM users WHERE role='coach'")).workspace_id;
    const first = coach.data.clients[0];
    const withWorkout = structuredClone(coach.data);
    withWorkout.sessions.push({ id: "history", clientId: first.id, date: "2026-11-01", dayId: first.program.days[0].id, title: "Upper Body A", sets: [{ name: "Row", exerciseId: "row", set: 1, weight: 50, reps: 10, kind: "Standard", skipped: false }], startedAt: Date.now(), finishedAt: "2026-11-01T18:00:00Z", duration: 900, prs: [] });
    await f.store.workspaces.save(workspaceId, withWorkout);
    const removed = (await f.store.workspaces.get(workspaceId)).data;
    removed.clients = removed.clients.filter((c) => c.id !== first.id);
    await f.store.workspaces.save(workspaceId, removed);
    assert.equal((await f.db.get("SELECT status FROM coaching_relationships WHERE client_id=$1", [first.id])).status, "ended");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sessions WHERE id='history'"), 1, "the removed client's workout is kept");
  } finally {
    await f.close();
  }
});

test("deleting the coach's whole workspace removes its relationships and workouts", async () => {
  const f = await fixture();
  try {
    const workspaceId = (await f.db.get("SELECT workspace_id FROM users WHERE role='coach'")).workspace_id;
    const data = (await f.store.workspaces.get(workspaceId)).data;
    data.sessions.push({ id: "owner-gone", clientId: data.clients[0].id, date: "2026-11-01", dayId: "d", title: "T", sets: [{ name: "Row", set: 1, weight: 50, reps: 10, kind: "Standard", skipped: false }], startedAt: 1, finishedAt: "x", duration: 1, prs: [] });
    await f.store.workspaces.save(workspaceId, data);
    const deleted = await f.call("/api/account/delete", { method: "POST", account: f.coach, body: { confirm: "DELETE", password: "strong-password-123" } });
    assert.equal(deleted.status, 200);
    for (const table of ["workspaces", "coaching_relationships", "workout_sessions", "workout_sets"])
      assert.equal(await count(f, `SELECT COUNT(*) AS n FROM ${table}`), 0, `${table} is empty`);
  } finally {
    await f.close();
  }
});
