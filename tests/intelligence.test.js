import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { foundations } from "../src/avalen/ecosystem/memory.js";
import {
  analyzeClient,
  decideInsight,
} from "../src/avalen/ecosystem/intelligence.js";
import { zonedDay, utcAdd } from "../src/avalen/ecosystem/time.js";
test("intelligence grounds observations in records and does not score missing nutrition days", () => {
  const data = foundations(createWorkspace()),
    client = data.clients[0],
    today = zonedDay("UTC");
  data.checkins = [
    {
      id: "one",
      clientId: client.id,
      date: utcAdd(today, -3),
      scores: { Energy: 1 },
    },
    {
      id: "two",
      clientId: client.id,
      date: utcAdd(today, -1),
      scores: { Energy: 2 },
    },
  ];
  data.nutritionDays = [];
  const insights = analyzeClient(data, client, { today });
  const energy = insights.find((i) => i.key === "energy-recovery");
  assert.ok(energy.evidence.some((e) => e.recordId === "one"));
  assert.ok(energy.evidence.some((e) => e.recordId === "two"));
  assert.ok(!insights.some((i) => i.key === "nutrition-pattern"));
  decideInsight(data, { role: "coach", id: "coach" }, client, {
    key: energy.key,
    decision: "reject",
    reason: "Already discussing work schedule.",
  });
  assert.ok(
    !analyzeClient(data, client, { today }).some((i) => i.key === energy.key),
  );
  assert.ok(data.timeline.some((e) => e.type === "intelligence"));
});
test("approved proposals require fresh evidence and exact before values", () => {
  const data = foundations(createWorkspace()),
    client = data.clients[0],
    today = zonedDay("UTC"),
    ex = client.program.days[0].exercises[0];
  data.sessions = [0, 1, 2].map((n) => ({
    id: `s-${n}`,
    clientId: client.id,
    date: utcAdd(today, -7 + n * 2),
    sets: Array.from({ length: ex.sets }, () => ({
      name: ex.name,
      reps: ex.reps,
      weight: ex.weight,
      kind: "Standard",
    })),
  }));
  data.checkins = [];
  const insight = analyzeClient(data, client, { today }).find(
    (i) => i.proposal,
  );
  assert.ok(insight);
  const p = {
    key: insight.key,
    decision: "approve",
    type: "training",
    exerciseId: ex.id,
    before: insight.proposal.before,
    values: { ...insight.proposal.before, weight: ex.weight + 2.5 },
    fingerprint: "stale",
  };
  assert.throws(
    () => decideInsight(data, { id: "coach" }, client, p),
    /evidence changed/,
  );
  p.fingerprint = insight.fingerprint;
  decideInsight(data, { id: "coach" }, client, p);
  assert.equal(ex.weight, p.values.weight);
  assert.equal(data.insightDecisions.at(-1).decision, "approve");
});
