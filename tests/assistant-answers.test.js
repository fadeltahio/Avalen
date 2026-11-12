import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { attentionFor, dayKey } from "../src/avalen/store.js";
import { PROMPTS, answer, intentFor } from "../src/avalen/assistant-answers.js";

const today = dayKey();

test("free questions route to the right preset for each role", () => {
  assert.equal(intentFor("client", "how much protein today?"), "protein");
  assert.equal(intentFor("client", "what's my next session"), "next");
  assert.equal(intentFor("client", "show my PRs"), "lifts");
  assert.equal(intentFor("coach", "which check ins are late"), "checkins");
  assert.equal(intentFor("coach", "who missed training"), "missed");
  assert.equal(intentFor("coach", "anyone overdue on payment"), "billing");
  assert.equal(intentFor("client", "what is the meaning of life"), null);
  for (const role of ["client", "coach"]) for (const [intent] of PROMPTS[role]) assert.ok(intent);
});

test("client answers come only from saved records", () => {
  const data = createWorkspace(), client = data.clients[0];
  const protein = answer("protein", { data, client, role: "client", today });
  const eaten = data.foodLogs.filter(f => f.clientId === client.id && f.date === today).reduce((n, f) => n + Number(f.p || 0), 0);
  assert.match(protein.points[0][1], new RegExp(`^${Math.round(eaten * 10) / 10} / ${client.nutrition.p} g$`));
  const lifts = answer("lifts", { data, client, role: "client", today });
  for (const [name] of lifts.points) assert.ok(data.sessions.some(s => s.clientId === client.id && s.sets.some(x => x.name === name && !x.skipped)));
  const fresh = { ...client, id: "nobody", schedule: [] };
  assert.match(answer("lifts", { data, client: fresh, role: "client", today }).text, /No weighted sets/);
  assert.match(answer("week", { data, client: fresh, role: "client", today }).text, /Nothing is logged/);
  assert.match(answer("next", { data, client: fresh, role: "client", today }).text, /No upcoming workout/);
});

test("coach answers match the attention flags and link each client", () => {
  const data = createWorkspace();
  const flagged = data.clients.filter(c => !c.paused && attentionFor(data, c).length);
  const reply = answer("attention", { data, role: "coach", today });
  assert.equal(reply.points.length, Math.min(5, flagged.length));
  for (const [, , id] of reply.points) assert.ok(flagged.some(c => c.id === id));
  const summary = answer("summary", { data, role: "coach", selectedClientId: data.clients[0].id, today });
  assert.equal(summary.clientId, data.clients[0].id);
  assert.equal(summary.points.length, 4);
});

test("unknown questions say plainly that open AI is not connected", () => {
  const data = createWorkspace();
  const reply = answer(null, { data, client: data.clients[0], role: "client", today });
  assert.equal(reply.fallback, true);
  assert.match(reply.text, /isn’t set up yet/);
});
