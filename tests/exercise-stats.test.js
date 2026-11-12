import test from "node:test";
import assert from "node:assert/strict";
import { averageValue, chartTop, datePosition, entriesBetween, entryValue, exerciseEntries, exerciseMetric, exerciseRecords, findExercise, setLabel } from "../src/avalen/exercise-stats.js";

const set = (name, weight, reps, extra = {}) => ({ name, weight, reps, kind: "Strength", ...extra });
const sessions = [
  { id: "new", clientId: "a", date: "2026-10-20", sets: [set("Press", 70, 5), set("Press", 60, 8), set("Row", 50, 10)] },
  { id: "old", clientId: "a", date: "2026-10-01", sets: [set("Press", 60, 8), set("Press", 90, 3, { skipped: true })] },
  { id: "other", clientId: "b", date: "2026-10-05", sets: [set("Press", 200, 1)] },
];

test("entries hold one client's logged sets, oldest first", () => {
  const entries = exerciseEntries(sessions, "a", "Press");
  assert.deepEqual(entries.map((entry) => entry.id), ["old", "new"]);
  assert.equal(entries[0].sets.length, 1, "a skipped set never counts");
});

test("the measure follows what was actually logged", () => {
  const entries = exerciseEntries(sessions, "a", "Press");
  const load = exerciseMetric(entries);
  assert.equal(load.key, "load");
  assert.equal(entryValue(entries[1], load), 830);
  assert.equal(averageValue(entries, load), 655);
  const bodyweight = exerciseMetric([{ sets: [set("Push-up", 0, 12), set("Push-up", 0, 10)] }]);
  assert.equal(bodyweight.key, "reps");
  assert.equal(entryValue({ sets: [set("Push-up", 0, 12), set("Push-up", 0, 10)] }, bodyweight), 22);
  const timed = exerciseMetric([{ sets: [set("Plank", 0, 45, { kind: "Duration" })] }]);
  assert.equal(timed.key, "time");
  assert.equal(setLabel({ reps: 45 }, timed), "45 sec");
  assert.equal(averageValue([], load), null, "an empty range has no average, not zero");
});

test("records rank distinct sets and keep the day they were first reached", () => {
  const entries = exerciseEntries(sessions, "a", "Press");
  const records = exerciseRecords(entries, exerciseMetric(entries));
  assert.deepEqual(records.map((row) => [row.weight, row.reps, row.date]), [[70, 5, "2026-10-20"], [60, 8, "2026-10-01"]]);
  const mixed = [{ date: "2026-10-01", sets: [set("Carry", 40, 10), set("Carry", 100, 60, { kind: "Duration" })] }];
  assert.deepEqual(exerciseRecords(mixed, { key: "load" }).map((row) => row.weight), [40], "a timed set is not a weight record");
});

test("the chart scale and date positions stay inside the plot", () => {
  assert.equal(chartTop(2450), 2500);
  assert.equal(chartTop(830), 850);
  assert.equal(chartTop(0), 1);
  assert.equal(datePosition("2026-10-01", "2026-10-01", "2026-10-31"), 0);
  assert.equal(datePosition("2026-10-31", "2026-10-01", "2026-10-31"), 1);
  assert.equal(datePosition("2026-10-01", "2026-10-01", "2026-10-01"), 0);
  assert.deepEqual(entriesBetween(exerciseEntries(sessions, "a", "Press"), "2026-10-10", "2026-10-31").map((entry) => entry.id), ["new"]);
});

test("an exercise is found by plan, then library, then the client's own logs", () => {
  const client = { id: "a", program: { days: [{ exercises: [{ name: "Press", notes: "Planned" }] }] } };
  const data = { library: [{ name: "Press", notes: "Library" }, { name: "Squat" }], sessions };
  assert.equal(findExercise(data, client, "Press").notes, "Planned");
  assert.equal(findExercise(data, client, "Squat").name, "Squat");
  assert.deepEqual(findExercise(data, client, "Row"), { name: "Row", group: "" });
  assert.equal(findExercise(data, { id: "b", program: { days: [] } }, "Row"), null, "another client's log does not expose it");
  assert.equal(findExercise(data, client, "Unknown"), null);
  assert.equal(findExercise(data, client, null), null);
});
