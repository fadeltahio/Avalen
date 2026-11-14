// The iPhone app sends sign-in, saves and actions through Capacitor's native HTTP layer,
// which parses each JSON reply on iOS and hands it back with object keys reordered and
// decimals written with 17 significant digits (captured from iOS's JSONSerialization:
// 80.4 → 80.400000000000006). GET requests pass through unchanged. These tests drive the
// real server the way the iPhone app does, keeping each reply exactly as the native layer
// returns it, and check that saves made from that copy are accepted, stored and reloaded.
import test from "node:test";
import assert from "node:assert/strict";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import { canonicalJson, sameData } from "../src/avalen/ecosystem/canonical.js";
import { fixture } from "./helpers/service.js";

const today = new Date().toISOString().slice(0, 10);
const count = async (f, sql, params = []) => Number((await f.db.get(sql, params)).n);

// JSON text as iOS writes it: keys in a different order (reversed here, so it always
// differs) and non-integer numbers with 17 significant digits.
function nativeText(value) {
  if (value === null || typeof value !== "object") return typeof value === "number" && !Number.isInteger(value) ? value.toPrecision(17) : JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(nativeText).join(",")}]`;
  return `{${Object.keys(value).filter((k) => value[k] !== undefined).reverse().map((k) => `${JSON.stringify(k)}:${nativeText(value[k])}`).join(",")}}`;
}

// The parts of the app's connection layer that matter here: what it keeps as its copy
// of the workspace, and what it sends back on the next save.
function iPhoneApp(f, cookie) {
  const app = { cookie, csrf: null, user: null, data: null, revision: 0, replies: [] };
  async function send(path, { method = "GET", body, key } = {}) {
    const res = await fetch(f.base + path, {
      method,
      headers: { "X-Avalen": "1", ...(app.cookie ? { Cookie: app.cookie } : {}), ...(app.csrf ? { "X-CSRF-Token": app.csrf } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    app.cookie = res.headers.get("set-cookie")?.split(";")[0] || app.cookie;
    const text = await res.text();
    // Native for everything but GET: the reply is rebuilt the way iOS rebuilds it.
    const value = method === "GET" ? JSON.parse(text) : JSON.parse(nativeText(JSON.parse(text)));
    if (method !== "GET") app.replies.push({ server: text, app: JSON.stringify(value) });
    if (!res.ok) return { status: res.status, error: value.error };
    if (value.user) Object.assign(app, { user: value.user, csrf: value.csrf ?? app.csrf });
    if (value.data) Object.assign(app, { data: value.data, revision: value.revision });
    return { status: res.status, ...value };
  }
  return Object.assign(app, {
    signIn: (email, password) => send("/api/login", { method: "POST", body: { email, password } }),
    open: () => send("/api/session"),
    reload: () => send("/api/workspace"),
    save(edit) {
      const next = structuredClone(app.data);
      edit(next);
      return send("/api/workspace", { method: "PATCH", body: { revision: app.revision, changes: workspaceChanges(app.data, next) }, key: crypto.randomUUID() });
    },
    command: (action, clientId, payload) => send("/api/commands", { method: "POST", body: { action, clientId, payload, revision: app.revision }, key: crypto.randomUUID() }),
  });
}

async function coachAndClient(f) {
  const { code } = await f.call("/api/coach-code", { account: f.coach });
  const signup = await f.call("/api/signup/client", { method: "POST", body: { name: "Maya Chen", email: "maya@test.app", password: "client-password-123", code } });
  const client = iPhoneApp(f), coach = iPhoneApp(f);
  assert.equal((await client.signIn("maya@test.app", "client-password-123")).status, 200);
  assert.equal((await coach.signIn("coach@test.app", "strong-password-123")).status, 200);
  return { client, coach, clientId: signup.user.clientId };
}

test("the comparison treats reordered keys and iOS decimals as the same data, and real differences as different", () => {
  const record = { id: "r1", weight: 80.4, flags: [true, null, { b: 1, a: 2 }], note: "كشري" };
  const fromIOS = JSON.parse(nativeText(record));
  assert.notEqual(JSON.stringify(fromIOS), JSON.stringify(record), "the iOS copy really is written differently");
  assert.equal(sameData(record, fromIOS), true);
  assert.equal(canonicalJson(record), canonicalJson(fromIOS));
  assert.equal(sameData(record, { ...fromIOS, weight: 80.5 }), false);
  assert.equal(sameData(record, { ...fromIOS, extra: 1 }), false);
  assert.equal(sameData({ a: 1, b: undefined }, { a: 1 }), true, "like JSON, undefined fields don't count");
  assert.equal(sameData([1, 2], [2, 1]), false, "list order still matters");
});

test("iPhone: right after sign-in, the automatic time zone save and the next save are accepted and stored", async () => {
  const f = await fixture();
  try {
    const { client, clientId } = await coachAndClient(f);
    assert.notEqual(client.replies.at(-1).app, client.replies.at(-1).server, "the app's copy differs in text from what the server sent");
    const zone = await client.save((d) => (d.clients[0].timezone = "Africa/Cairo"));
    assert.equal(zone.status, 200, zone.error);
    const goal = await client.save((d) => (d.clients[0].goal = "Run 5 km"));
    assert.equal(goal.status, 200, goal.error);
    const stored = JSON.parse((await f.db.get("SELECT data FROM client_records WHERE client_id=$1", [clientId])).data);
    assert.equal(stored.timezone, "Africa/Cairo");
    assert.equal(stored.goal, "Run 5 km");
  } finally {
    await f.close();
  }
});

test("iPhone: a logged workout and the saves after it persist, and reload unchanged", async () => {
  const f = await fixture();
  try {
    const { client, coach, clientId } = await coachAndClient(f);
    const workout = { id: "w-native", clientId, date: today, dayId: client.data.clients[0].program.days[0].id, title: "Upper Body A", sets: [{ name: "Bench press", exerciseId: "bench", set: 1, weight: 62.5, reps: 8, kind: "Standard", skipped: false }, { name: "Bench press", exerciseId: "bench", set: 2, weight: 62.5, reps: 7, kind: "Standard", skipped: false }], startedAt: Date.now() - 3600e3, finishedAt: new Date().toISOString(), duration: 3600, prs: [] };
    assert.equal((await client.save((d) => d.sessions.push(workout))).status, 200);
    // The next saves start from the reply to the workout save, as rebuilt by iOS.
    assert.equal((await client.save((d) => d.foodLogs.push({ id: "after-workout", clientId, date: today, name: "Shake", kcal: 250.5 }))).status, 200);
    assert.equal((await client.save((d) => (d.clients[0].goal = "Stronger"))).status, 200);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM workout_sets WHERE session_id='w-native'"), 2);
    assert.deepEqual((await client.reload()).data.sessions.find((s) => s.id === "w-native"), workout, "the client reloads exactly what was logged");
    assert.deepEqual((await coach.reload()).data.sessions.find((s) => s.id === "w-native"), workout, "and so does the coach");
  } finally {
    await f.close();
  }
});

test("iPhone: a check-in, the coach's review and the saves around them all persist", async () => {
  const f = await fixture();
  try {
    const { client, coach, clientId } = await coachAndClient(f);
    const submitted = await client.command("checkin.submit", clientId, { id: "c-native", answers: { weight: 80.4 }, updateText: "Good week" });
    assert.equal(submitted.status, 200, submitted.error);
    assert.equal((await client.save((d) => (d.clients[0].goal = "After check-in"))).status, 200, "a save right after the check-in reply");
    assert.equal((await coach.reload()).status, 200);
    const reviewed = await coach.command("checkin.review", clientId, { id: "c-native", response: "Keep going" });
    assert.equal(reviewed.status, 200, reviewed.error);
    assert.equal((await coach.save((d) => (d.clients.find((c) => c.id === clientId).nutrition.kcal = 2100))).status, 200, "a coach save right after the review reply");
    const row = JSON.parse((await f.db.get("SELECT data FROM checkins WHERE record_key='id:c-native'")).data);
    assert.equal(row.reviewed, true);
    assert.equal(row.response, "Keep going");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM measurements WHERE client_id=$1 AND weight_kg=80.4", [clientId]), 1);
    assert.equal((await client.reload()).data.checkins.find((c) => c.id === "c-native").response, "Keep going");
  } finally {
    await f.close();
  }
});

test("iPhone: the coach's nutrition changes and the client's food logs, several in a row, all persist", async () => {
  const f = await fixture();
  try {
    const { client, coach, clientId } = await coachAndClient(f);
    for (const kcal of [2050, 2150, 2250.5]) {
      const saved = await coach.save((d) => (d.clients.find((c) => c.id === clientId).nutrition.kcal = kcal));
      assert.equal(saved.status, 200, `coach ${kcal}: ${saved.error}`);
    }
    for (const id of ["oats", "koshary", "foul"]) {
      const saved = await client.save((d) => d.foodLogs.push({ id, clientId, date: today, name: id, meal: "Lunch", kcal: 420.7, p: 18.2, c: 60.1, f: 9.9 }));
      assert.equal(saved.status, 200, `client ${id}: ${saved.error}`);
    }
    const stored = JSON.parse((await f.db.get("SELECT data FROM client_records WHERE client_id=$1", [clientId])).data);
    assert.equal(stored.nutrition.kcal, 2250.5);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE client_id=$1 AND kcal=420.7", [clientId]), 3);
    const reloaded = await client.reload();
    assert.equal(reloaded.data.clients[0].nutrition.kcal, 2250.5);
    assert.deepEqual(reloaded.data.foodLogs.map((r) => r.id).sort(), ["foul", "koshary", "oats"]);
  } finally {
    await f.close();
  }
});

test("iPhone: messages back and forth persist in order, and sent messages still can't be edited", async () => {
  const f = await fixture();
  try {
    const { client, coach, clientId } = await coachAndClient(f);
    const message = (id, from, text) => ({ id, clientId, from, text, at: new Date().toISOString(), read: false });
    assert.equal((await client.save((d) => d.messages.push(message("m1", "client", "Hi coach")))).status, 200);
    assert.equal((await coach.reload()).status, 200);
    assert.equal((await coach.save((d) => d.messages.push(message("m2", "coach", "Hi Maya")))).status, 200);
    assert.equal((await client.reload()).status, 200);
    assert.equal((await client.save((d) => d.messages.push(message("m3", "client", "Thanks")))).status, 200);
    assert.deepEqual((await coach.reload()).data.messages.filter((m) => m.clientId === clientId).map((m) => m.id), ["m1", "m2", "m3"]);
    assert.equal((await client.save((d) => (d.messages.find((m) => m.id === "m1").text = "Edited"))).status, 403, "the permission rules still apply");
  } finally {
    await f.close();
  }
});

test("iPhone: after a restart the session is restored, earlier saves are there, and new saves work", async () => {
  const f = await fixture();
  try {
    const { client, clientId } = await coachAndClient(f);
    assert.equal((await client.save((d) => d.foodLogs.push({ id: "before-restart", clientId, date: today, name: "Eggs", kcal: 180 }))).status, 200);
    const restarted = iPhoneApp(f, client.cookie);
    const opened = await restarted.open();
    assert.equal(opened.user.email, "maya@test.app");
    assert.equal(opened.data.foodLogs.some((r) => r.id === "before-restart"), true);
    assert.equal((await restarted.save((d) => d.foodLogs.push({ id: "after-restart", clientId, date: today, name: "Rice", kcal: 300 }))).status, 200);
    assert.equal((await restarted.save((d) => (d.clients[0].goal = "After restart"))).status, 200);
    assert.deepEqual((await restarted.reload()).data.foodLogs.map((r) => r.id).sort(), ["after-restart", "before-restart"]);
  } finally {
    await f.close();
  }
});

test("iPhone: a genuine conflict is still refused when someone else changed the same record", async () => {
  const f = await fixture();
  try {
    const { client, coach, clientId } = await coachAndClient(f);
    assert.equal((await coach.save((d) => (d.clients.find((c) => c.id === clientId).goal = "Coach's goal"))).status, 200);
    const stale = await client.save((d) => (d.clients[0].goal = "Client's goal"));
    assert.equal(stale.status, 409, "the client's copy of that record is out of date");
    const stored = JSON.parse((await f.db.get("SELECT data FROM client_records WHERE client_id=$1", [clientId])).data);
    assert.equal(stored.goal, "Coach's goal", "nothing was overwritten");
  } finally {
    await f.close();
  }
});
