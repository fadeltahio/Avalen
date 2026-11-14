import test from "node:test";
import assert from "node:assert/strict";
import { workspaceChanges, applyChanges } from "../src/avalen/ecosystem/changes.js";
import { fixture } from "./helpers/service.js";

test("changes list exactly the records an edit added, edited or removed", () => {
  const before = { foodLogs: [{ id: "a", kcal: 1 }, { id: "b", kcal: 2 }], settings: { theme: "dark" } };
  const after = { foodLogs: [{ id: "a", kcal: 1 }, { id: "b", kcal: 3 }, { id: "c", kcal: 4 }], settings: { theme: "light" } };
  const changes = workspaceChanges(before, after);
  assert.deepEqual(changes.foodLogs.rows.map((r) => [r.key, r.before?.kcal ?? null, r.after?.kcal ?? null, r.prev]), [["id:b", 2, 3, "id:a"], ["id:c", null, 4, "id:b"]]);
  assert.deepEqual(changes.settings, { value: { before: { theme: "dark" }, after: { theme: "light" } } });
  assert.deepEqual(workspaceChanges(before, structuredClone(before)), {});
});

test("changes apply on top of someone else's edits to other records, keeping each new record's place", () => {
  const seen = { foodLogs: [{ id: "a" }, { id: "b" }], timeline: [{ id: "t1" }] };
  const mine = workspaceChanges(seen, { foodLogs: [{ id: "a" }, { id: "b" }, { id: "mine" }], timeline: [{ id: "new" }, { id: "t1" }] });
  const latest = { foodLogs: [{ id: "a" }, { id: "b", kcal: 5 }, { id: "theirs" }], timeline: [{ id: "t1" }] };
  const { merged, conflicts } = applyChanges(latest, mine);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(merged.foodLogs.map((r) => r.id), ["a", "b", "mine", "theirs"]);
  assert.equal(merged.foodLogs[1].kcal, 5, "their edit is kept");
  assert.deepEqual(merged.timeline.map((r) => r.id), ["new", "t1"], "an entry added at the top stays at the top");
});

test("an edit to a record someone else changed meanwhile is refused", () => {
  const seen = { foodLogs: [{ id: "a", kcal: 1 }] };
  const mine = workspaceChanges(seen, { foodLogs: [{ id: "a", kcal: 2 }] });
  assert.deepEqual(applyChanges({ foodLogs: [{ id: "a", kcal: 9 }] }, mine).conflicts, ["foodLogs"]);
  assert.deepEqual(applyChanges({ foodLogs: [] }, mine).conflicts, ["foodLogs"], "or deleted meanwhile");
  const setting = workspaceChanges({ settings: { theme: "dark" } }, { settings: { theme: "light" } });
  assert.deepEqual(applyChanges({ settings: { theme: "system" } }, setting).conflicts, ["settings"]);
});

// Saves through the server, the way the app now sends them.
async function patch(f, account, seen, edit) {
  const next = structuredClone(seen.data);
  edit(next);
  return f.call("/api/workspace", { method: "PATCH", account, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } });
}
async function twoClients(f) {
  const { code } = await f.call("/api/coach-code", { account: f.coach });
  const join = (name, email) => f.call("/api/signup/client", { method: "POST", body: { name, email, password: "client-password-123", code } });
  return [await join("Maya Chen", "maya@test.app"), await join("Noah Patel", "noah@test.app")];
}
const food = (client, id) => ({ id, clientId: client.user.clientId, date: "2026-11-14", name: "Oats", meal: "Breakfast", kcal: 300, p: 10, c: 50, f: 6 });

test("two clients logging food from screens loaded at the same time both save", async () => {
  const f = await fixture();
  try {
    const [maya, noah] = await twoClients(f);
    const mayaSeen = await f.call("/api/workspace", { account: maya }), noahSeen = await f.call("/api/workspace", { account: noah });
    assert.equal((await patch(f, maya, mayaSeen, (d) => d.foodLogs.push(food(maya, "maya-oats")))).status, 200);
    const late = await patch(f, noah, noahSeen, (d) => d.foodLogs.push(food(noah, "noah-oats")));
    assert.equal(late.status, 200, late.error);
    const coach = await f.call("/api/workspace", { account: f.coach });
    assert.deepEqual(coach.data.foodLogs.map((r) => r.id).sort(), ["maya-oats", "noah-oats"]);
  } finally {
    await f.close();
  }
});

test("a coach editing a programme and a client logging food at the same time both save", async () => {
  const f = await fixture();
  try {
    const [maya] = await twoClients(f);
    const coachSeen = await f.call("/api/workspace", { account: f.coach }), mayaSeen = await f.call("/api/workspace", { account: maya });
    assert.equal((await patch(f, maya, mayaSeen, (d) => d.foodLogs.push(food(maya, "lunch")))).status, 200);
    const plan = await patch(f, f.coach, coachSeen, (d) => {
      d.clients.find((c) => c.id === maya.user.clientId).program.days[0].name = "Upper Body · Quality First";
    });
    assert.equal(plan.status, 200, plan.error);
    const latest = await f.call("/api/workspace", { account: f.coach });
    assert.equal(latest.data.clients.find((c) => c.id === maya.user.clientId).program.days[0].name, "Upper Body · Quality First");
    assert.ok(latest.data.foodLogs.some((r) => r.id === "lunch"), "the client's log wasn't overwritten by the coach's older copy");
  } finally {
    await f.close();
  }
});

test("two edits to the same record: the second is refused and nothing is lost", async () => {
  const f = await fixture();
  try {
    const first = await f.call("/api/workspace", { account: f.coach }), second = structuredClone(first);
    const clientId = first.data.clients[0].id;
    assert.equal((await patch(f, f.coach, first, (d) => (d.clients[0].goal = "Run a 10k"))).status, 200);
    const stale = await patch(f, f.coach, second, (d) => (d.clients[0].goal = "Lose 5 kg"));
    assert.equal(stale.status, 409);
    assert.match(stale.error, /changed this just now/);
    assert.equal((await f.call("/api/workspace", { account: f.coach })).data.clients.find((c) => c.id === clientId).goal, "Run a 10k");
  } finally {
    await f.close();
  }
});

test("the server's rules still apply to change-only saves", async () => {
  const f = await fixture();
  try {
    const [maya] = await twoClients(f);
    const seen = await f.call("/api/workspace", { account: maya });
    const coachOnly = await patch(f, maya, seen, (d) => (d.clients[0].program.days[0].name = "My own plan"));
    assert.equal(coachOnly.status, 403, "a client still can't change their coach's programme");
    const otherClient = await patch(f, maya, seen, (d) => d.foodLogs.push({ ...food(maya, "spoof"), clientId: "someone-else" }));
    assert.equal(otherClient.status, 403, "or write records for another client");
  } finally {
    await f.close();
  }
});
