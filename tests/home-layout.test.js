import test from "node:test";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import assert from "node:assert/strict";
import { fixture } from "./helpers/service.js";
import { CLIENT_WIDGETS, COACH_WIDGETS, cleanLayout, layoutFrom, resolveLayout } from "../src/avalen/home-layout.js";

const ids = (rows) => rows.filter((r) => r.visible).map((r) => r.id);

test("no saved layout shows every widget in the default order", () => {
  assert.deepEqual(ids(resolveLayout(undefined, CLIENT_WIDGETS)), CLIENT_WIDGETS.map((w) => w.id));
  assert.deepEqual(ids(resolveLayout(null, COACH_WIDGETS, "coach")), COACH_WIDGETS.map((w) => w.id));
});

test("a saved layout keeps its order and hidden widgets; widgets added later appear in their default place", () => {
  const saved = { order: ["wearables", "session", "essentials", "nutrition", "coach"], hidden: ["nutrition"] };
  const rows = resolveLayout(saved, CLIENT_WIDGETS);
  // recovery, updates and training are unknown to the saved order: each follows the
  // widget that comes before it in the default order (recovery follows wearables).
  assert.deepEqual(rows.map((r) => r.id), ["wearables", "recovery", "session", "essentials", "nutrition", "updates", "training", "coach"]);
  assert.equal(rows.find((r) => r.id === "nutrition").visible, false);
  assert.ok(rows.find((r) => r.id === "recovery").visible, "a new widget is never hidden by an old layout");
  assert.deepEqual(layoutFrom(rows).hidden, ["nutrition"]);
  assert.deepEqual(ids(resolveLayout({ order: ["gone", "session", "session"], hidden: ["gone"] }, CLIENT_WIDGETS)).slice(0, 1), ["session"]);
});

test("layouts are validated", () => {
  assert.deepEqual(cleanLayout({ order: ["session", "session", "coach"], hidden: [] }), { order: ["session", "coach"], hidden: [] });
  assert.equal(cleanLayout(null), null);
  assert.throws(() => cleanLayout({ order: "session" }), /Invalid home layout/);
  assert.throws(() => cleanLayout({ order: ["<script>"] }), /Invalid home layout/);
  assert.throws(() => cleanLayout({ order: Array.from({ length: 41 }, (_, i) => `w${"x".repeat(i % 5)}`) }), /Invalid home layout/);
});

test("server: a client saves their own home layout; a malformed one is refused", async () => {
  const f = await fixture();
  try {
    const clientId = f.coach.data.clients[0].id;
    const invite = await f.call("/api/invitations", { method: "POST", account: f.coach, body: { clientId } });
    const client = await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "client@test.app", password: "client-password-123" } });
    let ws = await f.call("/api/workspace", { account: client });
    const bad = structuredClone(ws.data);
    bad.clients[0].homeLayout = { order: ["<img>"], hidden: [] };
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: ws.revision, changes: workspaceChanges(ws.data, bad) } })).status, 400);
    const good = structuredClone(ws.data);
    good.clients[0].homeLayout = { order: ["wearables", "session"], hidden: ["recovery"] };
    const saved = await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: ws.revision, changes: workspaceChanges(ws.data, good) } });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.clients[0].homeLayout, { order: ["wearables", "session"], hidden: ["recovery"] });
    const coachWs = await f.call("/api/workspace", { account: f.coach });
    const coachNext = structuredClone(coachWs.data);
    coachNext.coach.homeLayout = { order: ["recovery", "queue"], hidden: ["progress"] };
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: f.coach, body: { revision: coachWs.revision, changes: workspaceChanges(coachWs.data, coachNext) } })).status, 200);
  } finally {
    await f.close();
  }
});
