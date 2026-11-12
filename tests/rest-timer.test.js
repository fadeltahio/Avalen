import { test } from "node:test";
import assert from "node:assert/strict";
import { restState, changeRest } from "../src/avalen/rest-timer.js";
test("rest uses deadlines, including a long background gap", () => {
  const draft = { restUntil: 100000, restTotalMs: 90000 };
  assert.equal(restState(draft, 25000).remaining, 75000);
  assert.equal(restState(draft, 200000).phase, "complete");
  assert.equal(restState(draft, 200000).progress, 0);
});
test("paused rest survives serialization, extends and resumes with the exact remaining time", () => {
  const draft = { restUntil: 100000, restTotalMs: 90000 };
  changeRest(draft, "pause", 30000);
  const restored = JSON.parse(JSON.stringify(draft));
  assert.equal(restState(restored, 300000).remaining, 70000);
  changeRest(restored, "extend", 300000);
  assert.equal(restored.restRemainingMs, 100000);
  changeRest(restored, "resume", 300000);
  assert.equal(restored.restUntil, 400000);
  assert.equal(restored.restRemainingMs, undefined);
  assert.equal(restState(restored, 310000).remaining, 90000);
  changeRest(restored, "skip", 310000);
  assert.equal(restored.restUntil, 0);
  assert.equal(restored.restTotalMs, undefined);
});
test("expired rest cannot be paused into a fake running state", () => {
  const draft = { restUntil: 100000 };
  changeRest(draft, "pause", 200000);
  assert.equal(restState(draft, 200000).phase, "complete");
  changeRest(draft, "extend", 200000);
  assert.equal(restState(draft, 200000).remaining, 30000);
});

test('existing drafts without a stored rest duration still show elapsed ring progress', () => {
  const legacy = {restUntil: 100000, index:0, exercises:[{rest:90}]};
  assert.equal(restState(legacy, 55000).progress, .5);
});
