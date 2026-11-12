import test from "node:test";
import assert from "node:assert/strict";
import {
  proposeSchedule,
  applyProposal,
  scheduleRules,
} from "../src/avalen/ecosystem/scheduling.js";
import { foundations } from "../src/avalen/ecosystem/memory.js";
function setup() {
  const client = {
    id: "one",
    program: { days: [{ id: "upper" }, { id: "lower" }] },
    schedule: [
      { date: "2026-10-12", dayId: "upper" },
      { date: "2026-10-13", dayId: "lower" },
      { date: "2026-10-15", dayId: "upper" },
      { date: "2026-10-17", dayId: "lower" },
    ],
    scheduleRules: {
      independent: true,
      requireApproval: false,
      allowedDays: [0, 1, 2, 3, 4, 5, 6],
      minSpacingDays: 1,
      maxWeekly: 4,
      preserveOrder: true,
    },
  };
  return { client, sessions: [{ clientId: "one", date: "2026-10-12" }] };
}
test("deterministic rescheduling protects completed dates and detects sequence, conflicts and frequency", () => {
  const { client, sessions } = setup();
  assert.throws(
    () =>
      proposeSchedule(
        client,
        sessions,
        { mode: "move", from: "2026-10-12", to: "2026-10-14" },
        "2026-10-13",
      ),
    /Completed/,
  );
  const p = proposeSchedule(
    client,
    sessions,
    { mode: "move", from: "2026-10-13", to: "2026-10-14" },
    "2026-10-13",
  );
  assert.equal(p.issues.length, 0);
  assert.equal(p.proposed[0].date, "2026-10-12");
  assert.ok(
    proposeSchedule(
      client,
      sessions,
      { mode: "move", from: "2026-10-13", to: "2026-10-15" },
      "2026-10-13",
    ).issues.some((i) => i.hard),
  );
  assert.ok(
    proposeSchedule(
      client,
      sessions,
      { mode: "move", from: "2026-10-13", to: "2026-10-18" },
      "2026-10-13",
    ).issues.some((i) => i.text.includes("order")),
  );
});
test("week arrangement respects blocked days and never inserts missed sessions implicitly", () => {
  const { client, sessions } = setup();
  const p = proposeSchedule(
    client,
    sessions,
    { mode: "week", unavailable: ["2026-10-15"] },
    "2026-10-14",
  );
  assert.equal(
    p.proposed.find((s) => s.originalDate === "2026-10-13").date,
    "2026-10-13",
  );
  assert.ok(
    !p.proposed
      .filter((s) => s.originalDate >= "2026-10-14")
      .some((s) => s.date === "2026-10-15"),
  );
  assert.match(p.explanation, /not added/);
});
test("server application rechecks policy and stale state before applying", () => {
  const { client, sessions } = setup(),
    today = new Date().toISOString().slice(0, 10);
  const base = new Date(today + "T12:00:00Z");
  const date = (n) =>
    new Date(base.getTime() + n * 86400000).toISOString().slice(0, 10);
  client.schedule = [
    { date: date(1), dayId: "upper" },
    { date: date(4), dayId: "lower" },
  ];
  const p = proposeSchedule(
      client,
      [],
      { mode: "move", from: date(1), to: date(2) },
      today,
    ),
    data = foundations({ clients: [client], sessions: [], timeline: [] });
  client.scheduleRules.requireApproval = true;
  assert.equal(
    applyProposal(data, { role: "client", id: "client" }, client, p),
    "pending",
  );
  assert.deepEqual(client.schedule, p.original);
  assert.equal(
    applyProposal(data, { role: "coach", id: "coach" }, client, p),
    "approved",
  );
  assert.equal(client.schedule[0].date, date(2));
  assert.throws(
    () => applyProposal(data, { role: "coach" }, client, p),
    /changed/,
  );
  assert.equal(data.timeline[0].type, "schedule-decision");
});
