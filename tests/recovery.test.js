import test from "node:test";
import assert from "node:assert/strict";
import { musclesFor, planPressure, recoveryMap, statusLine } from "../src/avalen/recovery.js";

const HOUR = 3600000;
const now = Date.parse("2026-11-10T12:00:00Z");
const ago = (hours) => new Date(now - hours * HOUR).toISOString();
const sets = (name, count, effort = "Good", extra = {}) =>
  Array.from({ length: count }, (_, set) => ({ name, set: set + 1, weight: 60, reps: 10, effort, ...extra }));
const session = (hoursAgo, rows) => ({ clientId: "c1", finishedAt: ago(hoursAgo), date: ago(hoursAgo).slice(0, 10), title: "Session", sets: rows });
const find = (data, id, at = now) => recoveryMap(data, "c1", at).muscles.find((muscle) => muscle.id === id);

test("exercises map to the muscles they train, specific movements first", () => {
  assert.deepEqual(musclesFor({ name: "Bench press" }).primary, ["chest"]);
  assert.deepEqual(musclesFor({ name: "Romanian deadlift" }).primary, ["hamstrings"]);
  assert.deepEqual(musclesFor({ name: "Leg curl" }).primary, ["hamstrings"]);
  assert.deepEqual(musclesFor({ name: "Triceps pushdown" }).primary, ["triceps"]);
  assert.deepEqual(musclesFor({ name: "Seated cable row" }).primary, ["back"]);
  assert.deepEqual(musclesFor({ name: "Incline dumbbell press" }).primary, ["chest"]);
  assert.deepEqual(musclesFor({ name: "Coach special", group: "Calves" }).primary, ["calves"]);
  assert.deepEqual(musclesFor({ name: "Coach special" }).primary, []);
});

test("a muscle moves from hot through recovering to ready as time passes", () => {
  const data = { sessions: [session(4, sets("Bench press", 5))] };
  assert.equal(find(data, "chest").state, "hot");
  assert.equal(find(data, "chest", now + 30 * HOUR).state, "recovering");
  assert.equal(find(data, "chest", now + 60 * HOUR).state, "ready");
});

test("secondary muscles carry half the load and recover sooner than the primary", () => {
  const data = { sessions: [session(2, sets("Bench press", 10))] };
  const chest = find(data, "chest"), triceps = find(data, "triceps");
  assert.equal(chest.sets, 10);
  assert.equal(triceps.sets, 5);
  assert.ok(triceps.hoursLeft < chest.hoursLeft);
});

test("more sets and harder sets take longer, within limits", () => {
  const small = find({ sessions: [session(1, sets("Bench press", 2))] }, "chest");
  const large = find({ sessions: [session(1, sets("Bench press", 10))] }, "chest");
  const hard = find({ sessions: [session(1, sets("Bench press", 5, "Hard"))] }, "chest");
  const good = find({ sessions: [session(1, sets("Bench press", 5))] }, "chest");
  assert.ok(small.hoursLeft < large.hoursLeft);
  assert.ok(good.hoursLeft < hard.hoursLeft);
  const huge = find({ sessions: [session(1, sets("Bench press", 60))] }, "chest");
  assert.ok(huge.hoursLeft <= 60 * 1.3);
});

test("training again before recovery adds to what was still owed", () => {
  const once = find({ sessions: [session(10, sets("Bench press", 5))] }, "chest");
  const twice = find({ sessions: [session(30, sets("Bench press", 5)), session(10, sets("Bench press", 5))] }, "chest");
  assert.ok(twice.hoursLeft > once.hoursLeft);
});

test("skipped sets, other clients and future sessions are ignored", () => {
  const skipped = { sessions: [session(2, sets("Bench press", 5, "Good", { skipped: true }))] };
  assert.equal(find(skipped, "chest").state, "idle");
  assert.equal(find({ sessions: [{ ...session(2, sets("Bench press", 5)), clientId: "other" }] }, "chest").state, "idle");
  assert.equal(find({ sessions: [session(-5, sets("Bench press", 5))] }, "chest").state, "idle");
});

test("a muscle untrained for two weeks is idle, not ready", () => {
  const data = { sessions: [session(24 * 15, sets("Bench press", 5))] };
  const chest = find(data, "chest");
  assert.equal(chest.state, "idle");
  assert.equal(statusLine(chest), "Not trained lately");
  assert.equal(recoveryMap({ sessions: [] }, "c1", now).logged, false);
});

test("a session without finishedAt still counts from its date", () => {
  const row = { clientId: "c1", date: "2026-11-09", title: "Older record", sets: sets("Back squat", 5) };
  assert.notEqual(find({ sessions: [row] }, "quads").state, "idle");
});

test("plan pressure names planned muscles that are still recovering", () => {
  const map = recoveryMap({ sessions: [session(4, sets("Bench press", 5))] }, "c1", now);
  const push = { exercises: [{ name: "Bench press" }, { name: "Lateral raise" }] };
  const legs = { exercises: [{ name: "Back squat" }] };
  assert.deepEqual(planPressure(map, push).map((muscle) => muscle.id), ["chest", "shoulders"]);
  assert.deepEqual(planPressure(map, legs), []);
  assert.deepEqual(planPressure(map, null), []);
});
