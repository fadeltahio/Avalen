import test from "node:test";
import assert from "node:assert/strict";
import { dismissFlag, reviewQueue } from "../src/avalen/coach-review.js";
import { dayKey, offsetDay } from "../src/avalen/store.js";
import { createWorkspace } from "../src/avalen/seed.js";

// The demo's first client already has one pending review flag ("review", a
// check-in to look at), which createWorkspace() wires up with everything
// reviewQueue's helpers (metrics, attentionFor) need — unlike a hand-built fixture.
function workspace() {
  const d = createWorkspace();
  assert.deepEqual(reviewQueue(d).find((r) => r.client.id === d.clients[0].id)?.flags.map((f) => f.key), ["review"]);
  return d;
}

test("dismissFlag snoozes a flag for the given days and records it on the client's timeline", () => {
  const d = workspace(), id = d.clients[0].id;
  dismissFlag(d, id, "review", { days: 7, title: "Review snoozed", detail: "Snoozed for a week." });
  assert.deepEqual(d.dismissed.at(-1), { clientId: id, key: "review", until: offsetDay(7) });
  assert.equal(d.timeline[0].title, "Review snoozed");
  assert.equal(d.timeline[0].detail, "Snoozed for a week.");
  // The dismissed flag no longer puts this client in the queue.
  assert.equal(reviewQueue(d).some((r) => r.client.id === id), false);
});

test("days: 0 snoozes only until tomorrow, matching the dashboard's \"snooze until tomorrow\"", () => {
  const d = workspace(), id = d.clients[0].id;
  dismissFlag(d, id, "review", { days: 0, title: "Review snoozed", detail: "x" });
  assert.equal(d.dismissed.at(-1).until, dayKey());
  // `until` is inclusive of today, so it is still hidden today...
  assert.equal(reviewQueue(d).some((r) => r.client.id === id), false);
});

test("defaults to a 7-day snooze when no duration is given", () => {
  const d = workspace(), id = d.clients[0].id;
  dismissFlag(d, id, "load-ex1", { title: "Progression held", detail: "x" });
  assert.equal(d.dismissed.at(-1).until, offsetDay(7));
});

test("dismissed is created on demand for a workspace that has never dismissed anything", () => {
  const d = workspace(), id = d.clients[0].id;
  delete d.dismissed;
  dismissFlag(d, id, "review", { title: "x", detail: "y" });
  assert.equal(d.dismissed.length, 1);
});
