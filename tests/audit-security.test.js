// Audit: deliberate attempts to reach data that isn't yours, against the real server and
// database. Every refusal is checked, and where a write was attempted, the database is
// checked to show nothing changed.
import test from "node:test";
import assert from "node:assert/strict";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import { fixture } from "./helpers/service.js";

const today = new Date().toISOString().slice(0, 10);
const count = async (f, sql, params = []) => Number((await f.db.get(sql, params)).n);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);
const refused = (status) => [401, 403, 404].includes(status);

async function patch(f, account, edit) {
  const seen = await f.call("/api/workspace", { account });
  const next = structuredClone(seen.data);
  edit(next, seen.data);
  return f.call("/api/workspace", { method: "PATCH", account, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } });
}
async function upload(f, account, clientId) {
  const res = await fetch(`${f.base}/api/media`, {
    method: "POST",
    headers: { Cookie: account.cookie, "X-CSRF-Token": account.csrf, "X-Avalen": "1", "Content-Type": "image/png", "X-Client-Id": clientId, "X-File-Name": "p.png" },
    body: png,
  });
  return res.json();
}
const media = (f, account, id, method = "GET") =>
  fetch(`${f.base}/api/media/${id}`, { method, headers: account ? { Cookie: account.cookie, "X-CSRF-Token": account.csrf, "X-Avalen": "1" } : {} });

// Coach A (the fixture's owner) with two client logins; coach B on the same service.
async function world() {
  const f = await fixture();
  const { code } = await f.call("/api/coach-code", { account: f.coach });
  const x = await f.call("/api/signup/client", { method: "POST", body: { name: "Client X", email: "x@test.app", password: "client-password-123", code } });
  const yId = f.coach.data.clients[0].id;
  const invite = await f.call("/api/invitations", { method: "POST", account: f.coach, body: { clientId: yId } });
  const y = await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "y@test.app", password: "client-password-123" } });
  const photo = await upload(f, x, x.user.clientId);
  assert.ok(photo.id, "X's photo uploaded");
  assert.equal((await patch(f, x, (d) => {
    d.foodLogs.push({ id: "x-meal", clientId: x.user.clientId, date: today, name: "X private meal", kcal: 500 });
    d.messages.push({ id: "x-msg", clientId: x.user.clientId, from: "client", text: "X private message", at: new Date().toISOString(), read: false });
    d.photos.push({ id: "x-photo", clientId: x.user.clientId, date: today, file: { id: photo.id, type: "image/png", name: "p.png" } });
  })).status, 200);
  const b = await f.call("/api/signup/coach", { method: "POST", body: { name: "Coach B", email: "b@test.app", password: "coach-b-password-1" } });
  return { f, a: f.coach, b, x, y, photoId: photo.id };
}

test("audit security: another coach can't read, change or act on coach A's clients", async () => {
  const { f, b, x, photoId } = await world();
  try {
    const view = await f.call("/api/workspace", { account: b });
    const text = JSON.stringify(view.data);
    for (const secret of ["Client X", "X private meal", "X private message", x.user.clientId]) assert.equal(text.includes(secret), false, `coach B's workspace doesn't contain ${secret}`);

    assert.equal((await media(f, b, photoId)).status, 404, "B can't open A's client's photo");
    assert.equal((await media(f, b, photoId, "DELETE")).status, 404, "or delete it");
    assert.equal((await media(f, x, photoId)).status, 200, "the photo is still there");

    assert.ok(refused((await f.call("/api/invitations", { method: "POST", account: b, body: { clientId: x.user.clientId } })).status), "B can't invite into A's client record");
    assert.ok(refused((await f.call("/api/commands", { method: "POST", account: b, body: { action: "checkin.review", clientId: x.user.clientId, revision: 0, payload: { id: "any", response: "hi" } } })).status));
    assert.ok(refused((await f.call(`/api/wearables/days?clientId=${x.user.clientId}`, { account: b })).status), "B can't read A's client's wearable days");
    assert.ok(refused((await f.call("/api/intelligence/explain", { method: "POST", account: b, body: { clientId: x.user.clientId } })).status));
    assert.ok(refused((await f.call("/api/wearables/sync", { method: "POST", account: b, body: { clientId: x.user.clientId, provider: "whoop" } })).status));
    assert.ok(refused((await f.call("/api/transcriptions", { method: "POST", account: b, body: { clientId: x.user.clientId, mediaId: photoId, consent: true } })).status));

    // B tagging a record with A's client id must not reach A's workspace or the client.
    await patch(f, b, (d) => d.foodLogs.push({ id: "b-into-x", clientId: x.user.clientId, date: today, name: "Injected by B", kcal: 1 }));
    const aWorkspace = (await f.db.get("SELECT workspace_id FROM users WHERE email='coach@test.app'")).workspace_id;
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE workspace_id=$1 AND record_key='id:b-into-x'", [aWorkspace]), 0, "nothing lands in A's workspace");
    assert.equal(JSON.stringify((await f.call("/api/workspace", { account: x })).data).includes("Injected by B"), false, "X doesn't see it");
    assert.equal(JSON.stringify(await f.call("/api/account/export", { account: x })).includes("Injected by B"), false, "or get it in their export");

    const exported = await f.call("/api/account/export", { account: b });
    assert.equal(JSON.stringify(exported).includes("X private"), false, "B's export holds none of A's data");
  } finally {
    await f.close();
  }
});

test("audit security: one client can't see or change another client of the same coach", async () => {
  const { f, x, y, photoId } = await world();
  try {
    const view = await f.call("/api/workspace", { account: y });
    assert.equal(view.status, 200);
    const text = JSON.stringify(view.data);
    for (const secret of ["Client X", "X private meal", "X private message", x.user.clientId]) assert.equal(text.includes(secret), false, `Y's view doesn't contain ${secret}`);
    assert.deepEqual(view.data.clients.map((c) => c.id), [y.user.clientId], "Y sees only their own client record");

    assert.ok(refused((await media(f, y, photoId)).status), "Y can't open X's photo");
    assert.ok(refused((await media(f, y, photoId, "DELETE")).status), "or delete it");
    assert.ok(refused((await f.call(`/api/wearables/days?clientId=${x.user.clientId}`, { account: y })).status));
    assert.ok(refused((await f.call("/api/commands", { method: "POST", account: y, body: { action: "checkin.submit", clientId: x.user.clientId, revision: 0, payload: { id: "y-as-x", answers: { weight: 70 } } } })).status), "Y can't submit X's check-in");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM checkins WHERE record_key='id:y-as-x'"), 0);

    const write = await patch(f, y, (d) => d.foodLogs.push({ id: "y-into-x", clientId: x.user.clientId, date: today, name: "Injected", kcal: 1 }));
    assert.notEqual(write.status, 200);
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM food_logs WHERE record_key='id:y-into-x'"), 0);
    const upload = await fetch(`${f.base}/api/media`, { method: "POST", headers: { Cookie: y.cookie, "X-CSRF-Token": y.csrf, "X-Avalen": "1", "Content-Type": "image/png", "X-Client-Id": x.user.clientId, "X-File-Name": "p.png" }, body: png });
    assert.ok(refused(upload.status), "Y can't upload into X's record");

    const exported = await f.call("/api/account/export", { account: y });
    assert.equal(JSON.stringify(exported).includes("X private"), false, "Y's export holds none of X's data");
  } finally {
    await f.close();
  }
});

test("audit security: a client can't use coach-only actions", async () => {
  const { f, x } = await world();
  try {
    const attempts = [
      ["/api/invitations", "POST", { clientId: x.user.clientId }],
      ["/api/payments/account", "GET"],
      ["/api/payments/account", "PUT", { apiKey: "x" }],
      ["/api/import", "POST", { data: {}, revision: 0 }],
      ["/api/coach-code", "GET"],
      ["/api/coach-code/replace", "POST", {}],
      ["/api/intelligence/explain", "POST", { clientId: x.user.clientId }],
    ];
    for (const [path, method, body] of attempts) {
      const res = await f.call(path, { method, account: x, body });
      assert.ok(refused(res.status), `${method} ${path} refused for a client (got ${res.status})`);
    }
    assert.equal((await patch(f, x, (d) => (d.clients[0].program.days[0].name = "Self-assigned"))).status, 403, "a client can't edit their programme");
    const coachSettings = JSON.stringify((await f.call("/api/workspace", { account: f.coach })).data.settings);
    await patch(f, x, (d) => (d.settings = { ...(d.settings || {}), brand: "Mine" }));
    assert.equal(JSON.stringify((await f.call("/api/workspace", { account: f.coach })).data.settings), coachSettings, "or the coach's settings");
  } finally {
    await f.close();
  }
});

test("audit security: sign-in, session and request-origin checks are enforced on the server", async () => {
  const { f, a } = await world();
  try {
    for (const path of ["/api/workspace", "/api/account/export", "/api/coach-code", "/api/wearables/status", "/api/jobs/anything"])
      assert.equal((await f.call(path)).status, 401, `${path} needs a session`);
    const anon = await fetch(`${f.base}/api/media/00000000-0000-0000-0000-000000000000`);
    assert.equal(anon.status, 401, "media needs a session");

    const seen = await f.call("/api/workspace", { account: a });
    const send = (headers, cookie = a.cookie) =>
      fetch(`${f.base}/api/workspace`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie, ...headers }, body: JSON.stringify({ revision: seen.revision, changes: [] }) });
    assert.equal((await send({ "X-Avalen": "1" })).status, 403, "no CSRF token");
    assert.equal((await send({ "X-Avalen": "1", "X-CSRF-Token": "wrong" })).status, 403, "wrong CSRF token");
    assert.equal((await send({ "X-CSRF-Token": a.csrf })).status, 403, "missing app header");
    assert.equal((await send({ "X-Avalen": "1", "X-CSRF-Token": a.csrf, Origin: "https://evil.example" })).status, 403, "another site's origin");
    assert.equal((await send({ "X-Avalen": "1", "X-CSRF-Token": a.csrf }, "avalen_session=forged-token")).status, 401, "a forged session cookie");

    // An expired session stops working.
    const token = /avalen_session=([^;]+)/.exec(a.cookie)[1];
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM sessions WHERE token=$1", [token]), 0, "the session table never holds the raw cookie value");
    await f.db.run("UPDATE sessions SET expires=$1", [Date.now() - 1000]);
    assert.equal((await f.call("/api/workspace", { account: a })).status, 401, "an expired session is refused");
  } finally {
    await f.close();
  }
});

test("audit security: passwords are stored hashed and never returned; sign-in attempts are limited", async () => {
  const f = await fixture();
  try {
    const row = await f.db.get("SELECT password FROM users WHERE email='coach@test.app'");
    assert.notEqual(row.password, "strong-password-123");
    assert.match(row.password, /^[\w-]{43}:[0-9a-f]{128}$/, "a per-user salt and a 64-byte scrypt hash");
    const login = await f.call("/api/login", { method: "POST", body: { email: "coach@test.app", password: "strong-password-123" } });
    const session = await f.call("/api/session", { account: login });
    const exported = await f.call("/api/account/export", { account: login });
    for (const res of [login, session, exported]) assert.equal(JSON.stringify(res).includes(row.password.split(":")[1]), false, "no response contains the hash");
    for (const res of [login, session]) assert.equal(/"password"/.test(JSON.stringify(res)), false);

    assert.equal((await f.call("/api/signup/coach", { method: "POST", body: { name: "S", email: "short@test.app", password: "short" } })).status, 400, "short passwords are refused");
    assert.equal((await f.call("/api/signup/coach", { method: "POST", body: { name: "S", email: "not-an-email", password: "long-enough-password" } })).status, 400);
    const injection = await f.call("/api/login", { method: "POST", body: { email: "' OR '1'='1' --@x.io", password: "anything-at-all" } });
    assert.ok([400, 401].includes(injection.status), "an SQL-shaped email is refused like any wrong email");
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM users"), 1, "and the users table is intact");
    let status = 0;
    for (let i = 0; i < 16; i++) status = (await f.call("/api/login", { method: "POST", body: { email: "coach@test.app", password: `wrong-password-${i}` } })).status;
    assert.equal(status, 429, "repeated wrong passwords are slowed down");
  } finally {
    await f.close();
  }
});

test("audit security: malformed input is refused cleanly and the server's files can't be reached", async () => {
  const { f, a } = await world();
  try {
    const raw = (path, body, headers = {}) => fetch(`${f.base}${path}`, { method: "POST", headers: { "X-Avalen": "1", "Content-Type": "application/json", Cookie: a.cookie, "X-CSRF-Token": a.csrf, ...headers }, body });
    assert.equal((await raw("/api/login", "{not json")).status, 400);
    assert.equal((await raw("/api/login", JSON.stringify({ email: "a@b.co", password: "x".repeat(5000) }))).status, 413, "oversized sign-in body");
    const seen = await f.call("/api/workspace", { account: a });
    for (const changes of [null, "nope", [{ area: "nonexistent", op: "set" }], [{ area: "foodLogs", op: "delete", key: "id:missing" }]]) {
      const res = await f.call("/api/workspace", { method: "PATCH", account: a, body: { revision: seen.revision, changes } });
      assert.ok(res.status >= 400 && res.status < 500, `malformed change ${JSON.stringify(changes)} refused with a 4xx (got ${res.status})`);
    }
    for (const path of ["/../.env", "/..%2f.env", "/%2e%2e/%2e%2e/package.json", "/..%2f..%2fserver%2fsecrets.key", "/%2e%2e%2f.avalen-data"]) {
      const res = await fetch(`${f.base}${path}`);
      const text = await res.text();
      assert.equal(/DATABASE_URL|AVALEN_|"dependencies"/.test(text), false, `${path} serves no server file (got ${res.status})`);
    }
  } finally {
    await f.close();
  }
});

// Found by the audit on 2026-11-14 and fixed: workouts were refused for a client who
// isn't on the coach's list, but other record types were stored in the coach's own
// workspace with a stray relationship for that client id.
test("audit security: a coach's save refuses records for a client not on their list", async () => {
  const { f, b, x } = await world();
  try {
    for (const [area, row] of [
      ["foodLogs", { id: "b-into-x", clientId: x.user.clientId, date: today, name: "Injected", kcal: 1 }],
      ["messages", { id: "b-msg", clientId: x.user.clientId, from: "coach", text: "Injected", at: new Date().toISOString(), read: false }],
      ["measurements", { id: "b-m", clientId: "made-up-client", date: today, weight: 80 }],
    ]) {
      const write = await patch(f, b, (d) => d[area].push(row));
      assert.equal(write.status, 404, `${area}: ${write.error}`);
    }
    for (const table of ["food_logs", "messages", "measurements"]) assert.equal(await count(f, `SELECT COUNT(*) AS n FROM ${table} WHERE record_key LIKE 'id:b-%'`), 0, `${table} holds nothing`);
    const bWorkspace = (await f.db.get("SELECT workspace_id FROM users WHERE email='b@test.app'")).workspace_id;
    assert.equal(await count(f, "SELECT COUNT(*) AS n FROM coaching_relationships WHERE workspace_id=$1", [bWorkspace]), 0, "no stray relationship");
    assert.equal((await patch(f, b, (d) => d.foodLogs.push({ id: "b-own", clientId: undefined, date: today, name: "No client", kcal: 1 }))).status, 200, "rows without a client are unaffected");
  } finally {
    await f.close();
  }
});

test("audit security: a coach can't add a departed client's own records, which would never be stored", async () => {
  const { f, a, x } = await world();
  try {
    assert.equal((await f.call("/api/account/leave-coach", { method: "POST", account: x, body: { confirm: true } })).status, 200);
    for (const [area, row] of [
      ["foodLogs", { id: "after-left", clientId: x.user.clientId, date: today, name: "Coach-added", kcal: 1 }],
      ["measurements", { id: "after-left-m", clientId: x.user.clientId, date: today, weight: 80 }],
      ["sessions", { id: "after-left-w", clientId: x.user.clientId, date: today, dayId: "d", title: "T", sets: [{ name: "Row", set: 1, weight: 50, reps: 10, kind: "Standard", skipped: false }], startedAt: 1, finishedAt: "x", duration: 1, prs: [] }],
    ]) {
      const write = await patch(f, a, (d) => d[area].push(row));
      assert.equal(write.status, 409, `${area}: ${write.error}`);
      assert.match(write.error, /ended coaching/);
    }
    const message = await patch(f, a, (d) => d.messages.push({ id: "note-after-left", clientId: x.user.clientId, from: "coach", text: "Kept by the coach", at: new Date().toISOString(), read: false }));
    assert.equal(message.status, 200, "the coach's own records for a former client still save");
    assert.equal((await f.call("/api/workspace", { account: a })).data.messages.some((m) => m.id === "note-after-left"), true, "and are still there after reloading");
  } finally {
    await f.close();
  }
});
