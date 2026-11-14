// Audit: core coaching flows against the real server and database (both SQLite and,
// under `pnpm test:postgres`, PostgreSQL). Each test checks what was stored, not just
// what the request returned.
import test from "node:test";
import assert from "node:assert/strict";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import { fixture } from "./helpers/service.js";

const today = new Date().toISOString().slice(0, 10);
const count = async (f, sql, params = []) => Number((await f.db.get(sql, params)).n);
async function save(f, account, edit) {
  const seen = await f.call("/api/workspace", { account });
  const next = structuredClone(seen.data);
  edit(next);
  return f.call("/api/workspace", { method: "PATCH", account, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } });
}
async function joinedClient(f, email = "maya@test.app", name = "Maya Chen") {
  const { code } = await f.call("/api/coach-code", { account: f.coach });
  return f.call("/api/signup/client", { method: "POST", body: { name, email, password: "client-password-123", code } });
}

test("audit: coach sign-up, sign-in, sign-out and wrong-password handling", async () => {
  const f = await fixture();
  try {
    const coach = await f.call("/api/signup/coach", { method: "POST", body: { name: "Laila Hassan", email: "laila@test.app", password: "coach-password-123" } });
    assert.equal(coach.status, 200);
    assert.equal(coach.user.role, "coach");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM users WHERE email='laila@test.app' AND role='coach'"), 1);
    assert.equal((await f.call("/api/signup/coach", { method: "POST", body: { name: "Dup", email: "laila@test.app", password: "coach-password-123" } })).status, 409);
    assert.equal((await f.call("/api/login", { method: "POST", body: { email: "laila@test.app", password: "wrong-password-1" } })).status, 401);
    const signedIn = await f.call("/api/login", { method: "POST", body: { email: "laila@test.app", password: "coach-password-123" } });
    assert.equal(signedIn.status, 200);
    assert.equal((await f.call("/api/logout", { method: "POST", account: signedIn })).status, 200);
    assert.equal((await f.call("/api/workspace", { account: signedIn })).status, 401, "the session ends at sign-out");
  } finally {
    await f.close();
  }
});

test("audit: client onboarding by coach code and by single-use invitation", async () => {
  const f = await fixture();
  try {
    const byCode = await joinedClient(f);
    assert.equal(byCode.status, 200);
    assert.equal((await f.db.get("SELECT status FROM coaching_relationships WHERE client_user_id=$1", [byCode.user.id])).status, "active");
    assert.equal((await f.call("/api/signup/client", { method: "POST", body: { name: "X", email: "x@test.app", password: "client-password-123", code: "ZZZ-ZZZ" } })).status, 404);

    const clientId = f.coach.data.clients[0].id;
    const invite = await f.call("/api/invitations", { method: "POST", account: f.coach, body: { clientId } });
    const joined = await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "invited@test.app", password: "client-password-123" } });
    assert.equal(joined.status, 200);
    assert.equal(joined.user.clientId, clientId);
    assert.equal((await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "again@test.app", password: "client-password-123" } })).status, 404, "an invitation works once");
  } finally {
    await f.close();
  }
});

test("audit: a coach's programme and nutrition changes persist and reach the client; the client can't change them", async () => {
  const f = await fixture();
  try {
    const client = await joinedClient(f);
    const id = client.user.clientId;
    assert.equal((await save(f, f.coach, (d) => {
      const c = d.clients.find((x) => x.id === id);
      c.program.days[0].name = "Upper Body · Audit";
      c.nutrition.kcal = 2150;
    })).status, 200);
    const stored = JSON.parse((await f.db.get("SELECT data FROM client_records WHERE client_id=$1", [id])).data);
    assert.equal(stored.program.days[0].name, "Upper Body · Audit");
    assert.equal(stored.nutrition.kcal, 2150);
    const view = (await f.call("/api/workspace", { account: client })).data.clients[0];
    assert.equal(view.program.days[0].name, "Upper Body · Audit");
    assert.equal(view.nutrition.kcal, 2150);
    assert.equal((await save(f, client, (d) => (d.clients[0].nutrition.kcal = 4000))).status, 403);
    assert.equal((await save(f, client, (d) => (d.clients[0].program.days[0].name = "Mine"))).status, 403);
  } finally {
    await f.close();
  }
});

test("audit: a completed workout persists as a session with set rows, is visible to the coach and can't be rewritten", async () => {
  const f = await fixture();
  try {
    const client = await joinedClient(f);
    const workout = { id: "audit-w1", clientId: client.user.clientId, date: today, dayId: "d1", title: "Upper Body A", sets: [{ name: "Bench press", exerciseId: "bench", set: 1, weight: 60, reps: 8, kind: "Standard", skipped: false }, { name: "Bench press", exerciseId: "bench", set: 2, weight: 60, reps: 7, kind: "Standard", skipped: false }], startedAt: Date.now() - 3600e3, finishedAt: new Date().toISOString(), duration: 3600, prs: [] };
    assert.equal((await save(f, client, (d) => d.sessions.push(workout))).status, 200);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sets WHERE session_id='audit-w1'"), 2);
    assert.deepEqual((await f.call("/api/workspace", { account: f.coach })).data.sessions.find((s) => s.id === "audit-w1"), workout);
    assert.equal((await save(f, client, (d) => (d.sessions.find((s) => s.id === "audit-w1").sets[0].weight = 100))).status, 409);
    assert.equal((await save(f, client, (d) => (d.sessions = d.sessions.filter((s) => s.id !== "audit-w1")))).status, 409, "or deleted");
  } finally {
    await f.close();
  }
});

test("audit: check-in submitted by the client, reviewed by the coach, feedback stored", async () => {
  const f = await fixture();
  try {
    const client = await joinedClient(f);
    const submit = await f.call("/api/commands", { method: "POST", account: client, body: { action: "checkin.submit", clientId: client.user.clientId, revision: 0, payload: { id: "audit-c1", answers: { weight: 80.4 }, updateText: "Good week." } } });
    assert.equal(submit.status, 200, submit.error);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM checkins WHERE record_key='id:audit-c1' AND reviewed=0"), 1);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM measurements WHERE client_id=$1 AND weight_kg=80.4", [client.user.clientId]), 1, "the weight answer becomes a measurement");
    const review = await f.call("/api/commands", { method: "POST", account: f.coach, body: { action: "checkin.review", clientId: client.user.clientId, revision: 0, payload: { id: "audit-c1", response: "Keep going." } } });
    assert.equal(review.status, 200, review.error);
    const row = JSON.parse((await f.db.get("SELECT data FROM checkins WHERE record_key='id:audit-c1'")).data);
    assert.equal(row.reviewed, true);
    assert.equal(row.response, "Keep going.");
    assert.equal((await f.call("/api/commands", { method: "POST", account: client, body: { action: "checkin.review", clientId: client.user.clientId, revision: 0, payload: { id: "audit-c1", response: "self" } } })).status, 403, "a client can't review");
  } finally {
    await f.close();
  }
});

test("audit: messages persist, sent messages can't be edited, and only the sender's side can add them", async () => {
  const f = await fixture();
  try {
    const client = await joinedClient(f);
    const id = client.user.clientId;
    assert.equal((await save(f, client, (d) => d.messages.push({ id: "audit-m1", clientId: id, from: "client", text: "Hello coach", at: new Date().toISOString(), read: false }))).status, 200);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM messages WHERE record_key='id:audit-m1' AND from_role='client'"), 1);
    assert.equal((await save(f, client, (d) => (d.messages.find((m) => m.id === "audit-m1").text = "Edited"))).status, 403);
    assert.equal((await save(f, client, (d) => d.messages.push({ id: "audit-m2", clientId: id, from: "coach", text: "Pretending", at: new Date().toISOString(), read: false }))).status, 403, "a client can't send as the coach");
  } finally {
    await f.close();
  }
});

test("audit: a failure partway through a save leaves nothing behind", async () => {
  const f = await fixture();
  try {
    const user = await f.db.get("SELECT * FROM users WHERE role='coach'");
    const clientId = (await f.load(user)).data.clients[0].id;
    const before = await f.db.get("SELECT revision, data FROM workspaces WHERE id=$1", [user.workspace_id]);
    const original = f.store.records.sync;
    let writtenBeforeFailure = 0;
    // Fail after the workout has been written but before the food log and the document.
    f.store.records.sync = async (area, ...rest) => {
      if (area.collection === "foodLogs") {
        writtenBeforeFailure = await count(f, "SELECT COUNT(*) AS n FROM workout_sessions WHERE id='rolled-back'");
        throw new Error("simulated storage failure");
      }
      return original(area, ...rest);
    };
    try {
      await assert.rejects(
        f.commit(user, undefined, (data) => {
          data.sessions.push({ id: "rolled-back", clientId, date: today, dayId: "d", title: "T", sets: [{ name: "Row", set: 1, weight: 50, reps: 10, kind: "Standard", skipped: false }], startedAt: 1, finishedAt: "x", duration: 1, prs: [] });
          data.foodLogs.push({ id: "rolled-back-food", clientId, date: today, name: "Oats", kcal: 300 });
          return data;
        }),
        /simulated storage failure/,
      );
    } finally {
      f.store.records.sync = original;
    }
    assert.equal(writtenBeforeFailure, 1, "the workout row really was written inside the transaction before the failure");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sessions WHERE id='rolled-back'"), 0, "the workout written earlier in the save was rolled back");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE record_key='id:rolled-back-food'"), 0);
    const after = await f.db.get("SELECT revision, data FROM workspaces WHERE id=$1", [user.workspace_id]);
    assert.deepEqual({ ...after }, { ...before }, "the workspace revision and document are unchanged");
  } finally {
    await f.close();
  }
});

test("audit: saves from two devices at the same moment, on different records, both land", async () => {
  const f = await fixture();
  try {
    const client = await joinedClient(f);
    const seenA = await f.call("/api/workspace", { account: client }), seenB = await f.call("/api/workspace", { account: client });
    const add = (seen, id) => {
      const next = structuredClone(seen.data);
      next.foodLogs.push({ id, clientId: client.user.clientId, date: today, name: id, kcal: 100 });
      return f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } });
    };
    const results = await Promise.all([add(seenA, "phone"), add(seenB, "tablet"), save(f, f.coach, (d) => (d.clients[0].goal = "Coach edit"))]);
    assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
    const latest = (await f.call("/api/workspace", { account: f.coach })).data;
    assert.deepEqual(latest.foodLogs.map((r) => r.id).sort(), ["phone", "tablet"]);
  } finally {
    await f.close();
  }
});
