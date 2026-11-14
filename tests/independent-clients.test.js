import test from "node:test";
import assert from "node:assert/strict";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import { fixture } from "./helpers/service.js";

const count = async (f, sql, params = []) => Number((await f.db.get(sql, params)).n);
const today = new Date().toISOString().slice(0, 10);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);

// A client who has joined by code and logged a workout, a meal and a progress photo.
async function activeClient(f, email = "maya@test.app") {
  const { code } = await f.call("/api/coach-code", { account: f.coach });
  const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Maya Chen", email, password: "client-password-123", code } });
  const seen = await f.call("/api/workspace", { account: client });
  const upload = await fetch(`${f.base}/api/media`, {
    method: "POST",
    headers: { Cookie: client.cookie, "X-CSRF-Token": client.csrf, "X-Avalen": "1", "Content-Type": "image/png", "X-Client-Id": client.user.clientId, "X-File-Name": "progress.png" },
    body: png,
  });
  const photo = await upload.json();
  const next = structuredClone(seen.data);
  next.sessions.push({ id: `${email}-workout`, clientId: client.user.clientId, date: today, dayId: next.clients[0].program.days[0].id, title: "Upper Body A", sets: [{ name: "Bench press", exerciseId: "bench", set: 1, weight: 60, reps: 8, kind: "Standard", skipped: false }], startedAt: Date.now(), finishedAt: new Date().toISOString(), duration: 1500, prs: [] });
  next.foodLogs.push({ id: `${email}-meal`, clientId: client.user.clientId, date: today, name: "Koshary", meal: "Lunch", kcal: 700, p: 20, c: 120, f: 15 });
  next.photos.push({ id: `${email}-photo`, clientId: client.user.clientId, date: today, file: { id: photo.id, type: "image/png", name: "progress.png" } });
  const saved = await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } });
  assert.equal(saved.status, 200, saved.error);
  return { client, photoId: photo.id };
}
const leave = (f, client) => f.call("/api/account/leave-coach", { method: "POST", account: client, body: { confirm: true } });

test("a client who leaves keeps their records; the former coach keeps only what is theirs", async () => {
  const f = await fixture();
  try {
    const { client, photoId } = await activeClient(f);
    const left = await leave(f, client);
    assert.equal(left.status, 200, left.error);
    assert.deepEqual(left.data.coachless.kept, { workouts: 1, foodLogs: 1, measurements: 0, checkins: 0, photos: 1 });

    const coach = (await f.call("/api/workspace", { account: f.coach })).data;
    const record = coach.clients.find((c) => c.id === client.user.clientId);
    assert.ok(record.leftAt && record.paused, "the coach still sees the client, marked as having left");
    assert.equal(coach.sessions.some((s) => s.clientId === client.user.clientId), false, "but not their workouts");
    assert.equal(coach.foodLogs.some((r) => r.clientId === client.user.clientId), false, "or their food logs");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sessions WHERE client_id=$1", [client.user.clientId]), 1, "the records still exist, for the client");

    const coachEdit = await f.call("/api/workspace", { account: f.coach });
    const next = structuredClone(coachEdit.data);
    next.clients[0].goal = "Unrelated coach edit";
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: f.coach, body: { revision: coachEdit.revision, changes: workspaceChanges(coachEdit.data, next) } })).status, 200);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE client_id=$1", [client.user.clientId]), 1, "a later coach save doesn't delete them");

    assert.equal((await fetch(`${f.base}/api/media/${photoId}`, { headers: { Cookie: client.cookie } })).status, 200, "the client can still open their photo");
    assert.equal((await fetch(`${f.base}/api/media/${photoId}`, { headers: { Cookie: f.coach.cookie } })).status, 404, "the former coach can't");
    assert.equal((await leave(f, client)).status, 409, "leaving twice is refused");
  } finally {
    await f.close();
  }
});

test("a client between coaches can download everything and join a new coach, who starts fresh", async () => {
  const f = await fixture();
  try {
    const { client } = await activeClient(f);
    await leave(f, client);
    const exported = await f.call("/api/account/export", { account: client });
    assert.equal(exported.status, 200);
    assert.deepEqual(exported.workouts.map((w) => w.title), ["Upper Body A"]);
    assert.deepEqual(exported.foodLogs.map((r) => r.name), ["Koshary"]);
    assert.equal(exported.coaching[0].status, "ended");

    // A second coach on the same service.
    const second = await f.call("/api/signup/coach", { method: "POST", body: { name: "Second Coach", email: "second@test.app", password: "strong-password-456" } });
    const { code } = await f.call("/api/coach-code", { account: second });
    const joined = await f.call("/api/account/join-coach", { method: "POST", account: client, body: { code } });
    assert.equal(joined.status, 200, joined.error);
    assert.equal(joined.data.coachless, undefined);
    assert.deepEqual(joined.data.sessions, [], "the new coaching relationship starts fresh");
    const secondView = (await f.call("/api/workspace", { account: second })).data;
    assert.equal(secondView.clients.find((c) => c.id === joined.user.clientId).name, "Maya Chen");
    assert.equal(secondView.sessions.length, 0, "the new coach doesn't see earlier history");
    assert.deepEqual((await f.db.all("SELECT status FROM coaching_relationships WHERE client_user_id=$1 ORDER BY started_at", [client.user.id])).map((r) => r.status), ["ended", "active"]);
    assert.equal((await f.call("/api/account/export", { account: client })).workouts.length, 1, "the client's history is still theirs");
    assert.equal((await f.call("/api/account/join-coach", { method: "POST", account: client, body: { code } })).status, 409, "a client can't join while already coached");
  } finally {
    await f.close();
  }
});

test("deleting a coachless client's account removes their records from every coach they had", async () => {
  const f = await fixture();
  try {
    const { client } = await activeClient(f);
    await leave(f, client);
    const deleted = await f.call("/api/account/delete", { method: "POST", account: client, body: { confirm: "DELETE", password: "client-password-123" } });
    assert.equal(deleted.status, 200, deleted.error);
    for (const table of ["workout_sessions", "food_logs", "progress_photos", "media"])
      assert.equal(await count(f, `SELECT COUNT(*) AS n FROM ${table} WHERE client_id=$1`, [client.user.clientId]), 0, `${table} holds nothing of theirs`);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM users WHERE id=$1", [client.user.id]), 0);
    const record = (await f.call("/api/workspace", { account: f.coach })).data.clients.find((c) => c.id === client.user.clientId);
    assert.equal(record.name, "Deleted client", "the former coach keeps only an anonymous entry");
  } finally {
    await f.close();
  }
});

test("when a coach deletes their account, clients keep their history and can join another coach", async () => {
  const f = await fixture();
  try {
    const { client, photoId } = await activeClient(f);
    assert.equal((await f.call("/api/account/delete", { method: "POST", account: f.coach, body: { confirm: "DELETE", password: "strong-password-123" } })).status, 200);
    const view = await f.call("/api/workspace", { account: client });
    assert.equal(view.status, 200);
    assert.deepEqual(view.data.coachless.kept, { workouts: 1, foodLogs: 1, measurements: 0, checkins: 0, photos: 1 });
    assert.equal((await f.call("/api/account/export", { account: client })).foodLogs[0].name, "Koshary");
    assert.equal((await fetch(`${f.base}/api/media/${photoId}`, { headers: { Cookie: client.cookie } })).status, 200, "their photo is still theirs");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM client_payments"), 0, "the coach's own records are gone");
  } finally {
    await f.close();
  }
});
