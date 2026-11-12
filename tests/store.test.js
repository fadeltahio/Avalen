import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import {
  attentionFor,
  dayKey,
  finishSession,
  historyFor,
  metrics,
  offsetDay,
  scheduleDay,
} from "../src/avalen/store.js";
test("attention flags explain plateau, misses, overdue and nutrition", () => {
  const d = createWorkspace();
  assert.ok(!attentionFor(d, d.clients[1]).some((f) => f.key === "plateau"));
  d.clients[1].goal = "Lose body fat";
  assert.ok(attentionFor(d, d.clients[1]).some((f) => f.key === "plateau"));
  assert.ok(attentionFor(d, d.clients[2]).some((f) => f.key === "training"));
  assert.ok(attentionFor(d, d.clients[5]).some((f) => f.key === "billing"));
  assert.ok(attentionFor(d, d.clients[4]).some((f) => f.key === "nutrition"));
  d.dismissed.push({
    clientId: d.clients[1].id,
    key: "plateau",
    until: offsetDay(7),
  });
  assert.ok(!attentionFor(d, d.clients[1]).some((f) => f.key === "plateau"));
});
test("completion is idempotent, computes PR and preserves historical sets", () => {
  const d = createWorkspace(),
    c = d.clients[0],
    day = scheduleDay(c, dayKey());
  const old = d.sessions.length;
  const draft = {
    id: "test",
    clientId: c.id,
    date: dayKey(),
    dayId: day.id,
    title: day.name,
    startedAt: Date.now() - 10000,
    sets: [{ name: "Bench press", weight: 100, reps: 10 }],
  };
  d.drafts[c.id] = draft;
  finishSession(d, draft);
  finishSession(d, draft);
  assert.equal(d.sessions.length, old + 1);
  assert.deepEqual(d.sessions.at(-1).prs, ["Bench press"]);
  assert.equal(d.drafts[c.id], undefined);
  assert.equal(historyFor(d, c.id, "Bench press")[0].weight, 100);
  assert.ok(metrics(d, c.id).volume > 0);
});
test("empty sessions cannot complete and travel plan expires automatically", () => {
  const d = createWorkspace(),
    c = d.clients[0],
    before = d.sessions.length;
  finishSession(d, { id: "empty", clientId: c.id, date: dayKey(), sets: [] });
  assert.equal(before, d.sessions.length);
  c.travel = {
    start: dayKey(),
    end: dayKey(),
    days: [{ id: "travel", name: "Travel workout" }],
  };
  assert.equal(scheduleDay(c, dayKey()).name, "Travel workout");
  assert.notEqual(scheduleDay(c, offsetDay(2))?.name, "Travel workout");
});
test('timed sets retain seconds without inflating strength volume or personal records', () => {
 const d=createWorkspace(),c=d.clients[0]; const before=metrics(d,c.id).volume;
 const draft={id:'timed-test',clientId:c.id,date:dayKey(),title:'Holds',startedAt:Date.now()-1000,sets:[{name:'Loaded hold',kind:'Duration',weight:20,reps:45}]};
 finishSession(d,draft);assert.equal(metrics(d,c.id).volume,before);assert.deepEqual(d.sessions.at(-1).prs,[]);assert.equal(d.sessions.at(-1).sets[0].reps,45);assert.equal(metrics(d,c.id).exerciseMax['Loaded hold'],undefined);
});
