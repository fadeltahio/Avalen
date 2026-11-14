import test from "node:test";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers/service.js";
import { removeClientData } from "../src/avalen/account-deletion.js";

test("removing a client's data keeps an anonymous paused entry and payment records without personal details", () => {
  const data = {
    clients: [{ id: "a", name: "Ali", email: "a@x", phone: "+201", goal: "Strength", intake: { q: 1 }, wearables: { share: {} }, program: { days: [] } }, { id: "b", name: "Mona" }],
    messages: [{ clientId: "a", text: "hi" }, { clientId: "b", text: "yo" }],
    checkins: [{ clientId: "a" }], posts: [{ text: "for all" }, { clientId: "a" }],
    payments: [{ clientId: "a", amount: 100, phone: "+201", paymob: { phone: "+201", transactionId: "t" } }],
    drafts: { a: { x: 1 }, b: { y: 1 } },
  };
  removeClientData(data, "a");
  const a = data.clients[0];
  assert.deepEqual([a.name, a.goal, a.paused, a.email, a.phone, a.intake, a.wearables], ["Deleted client", "", true, undefined, undefined, undefined, undefined]);
  assert.ok(a.deletedAt && a.program, "coach-authored plan stays");
  assert.deepEqual(data.messages, [{ clientId: "b", text: "yo" }]);
  assert.deepEqual(data.checkins, []);
  assert.deepEqual(data.posts, [{ text: "for all" }]);
  assert.deepEqual(data.drafts, { b: { y: 1 } });
  assert.deepEqual(data.payments, [{ clientId: "a", amount: 100, paymob: { transactionId: "t" } }]);
});

async function withClient(f) {
  const clientId = f.coach.data.clients[0].id;
  const invite = await f.call("/api/invitations", { method: "POST", account: f.coach, body: { clientId } });
  const client = await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "client@test.app", password: "client-password-123" } });
  assert.equal(client.status, 200);
  return { clientId, client };
}

test("server: a client deletes their account and everything about them; the coach's workspace keeps working", async () => {
  const f = await fixture();
  try {
    const { clientId, client } = await withClient(f);
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await f.call("/api/wearables/upload", { method: "POST", account: client, body: { provider: "manual", days: [{ date: today, metrics: { sleepMinutes: 400 } }] } })).status, 200);
    const ws = await f.call("/api/workspace", { account: client });
    const next = structuredClone(ws.data);
    next.habitLogs = [{ clientId, date: today, values: { steps: 5000 } }];
    next.messages = [...next.messages, { id: "m1", clientId, from: "client", text: "Private note", at: new Date().toISOString() }];
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: ws.revision, changes: workspaceChanges(ws.data, next) } })).status, 200);
    const media = join(f.root, "media", "photo-1");
    writeFileSync(media, "x");
    const workspaceId = (await f.db.get("SELECT workspace_id FROM users WHERE email='client@test.app'")).workspace_id;
    await f.store.media.insert({ id: "photo-1", workspace_id: workspaceId, client_id: clientId, owner_id: "u", name: "p.jpg", type: "image/jpeg", size: 1, duration: null, created_at: new Date().toISOString(), expires_at: new Date().toISOString() });

    assert.equal((await f.call("/api/account/delete", { method: "POST", account: client, body: { password: "client-password-123" } })).status, 400, "needs DELETE");
    assert.equal((await f.call("/api/account/delete", { method: "POST", account: client, body: { password: "wrong", confirm: "DELETE" } })).status, 401);
    const done = await f.call("/api/account/delete", { method: "POST", account: client, body: { password: "client-password-123", confirm: "DELETE" } });
    assert.equal(done.status, 200);

    assert.equal((await f.call("/api/workspace", { account: client })).status, 401, "the old session no longer works");
    assert.equal((await f.call("/api/login", { method: "POST", body: { email: "client@test.app", password: "client-password-123" } })).status, 401);
    assert.equal((await f.db.get("SELECT COUNT(*) AS n FROM users WHERE client_id=$1", [clientId])).n, 0);
    assert.equal((await f.db.get("SELECT COUNT(*) AS n FROM wearable_days WHERE client_id=$1", [clientId])).n, 0);
    assert.equal((await f.db.get("SELECT COUNT(*) AS n FROM media WHERE client_id=$1", [clientId])).n, 0);
    assert.equal(existsSync(media), false, "files are removed from disk");

    const coachView = await f.call("/api/workspace", { account: f.coach });
    assert.equal(coachView.status, 200);
    const entry = coachView.data.clients.find((c) => c.id === clientId);
    assert.deepEqual([entry.name, entry.paused, entry.email], ["Deleted client", true, undefined]);
    assert.equal(coachView.data.messages.some((m) => m.clientId === clientId), false);
    assert.equal(coachView.data.habitLogs.some((m) => m.clientId === clientId), false);
    assert.equal(JSON.stringify(coachView.data).includes("Private note"), false);
  } finally {
    await f.close();
  }
});

test("server: the coach deletes their whole workspace; clients with an account keep it and their own records", async () => {
  const f = await fixture();
  try {
    const { client } = await withClient(f);
    const workspaceId = (await f.db.get("SELECT workspace_id FROM users WHERE role='coach'")).workspace_id;
    assert.equal((await f.call("/api/account/delete", { method: "POST", account: f.coach, body: { password: "strong-password-123", confirm: "DELETE" } })).status, 200);
    assert.equal((await f.db.get("SELECT COUNT(*) AS n FROM users WHERE role='coach'")).n, 0, "the coach's login is gone");
    assert.equal((await f.db.get("SELECT COUNT(*) AS n FROM coach_codes")).n, 0);
    assert.equal(await f.store.workspaces.retired(workspaceId), true, "the workspace stays only as a marker for the former client's records");
    assert.deepEqual(await f.store.workspaces.ids(), [], "and no background work runs on it");
    const after = await f.call("/api/workspace", { account: client });
    assert.equal(after.status, 200, "the client can still sign in");
    assert.ok(after.data.coachless, "and is told they're between coaches");
  } finally {
    await f.close();
  }
});
