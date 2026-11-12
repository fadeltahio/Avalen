import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { foundations, recordChanges } from "../src/avalen/ecosystem/memory.js";
import { mergeEdit, projection } from "../server/permissions.js";
test("memory snapshots earlier programmes and keeps private reasons out of client projection", () => {
  const before = foundations(createWorkspace()),
    after = structuredClone(before),
    client = after.clients[0];
  client.program.days[0].exercises[0].reps = 8;
  recordChanges(before, after, { id: "coach", role: "coach" });
  assert.equal(after.revisions.length, 2);
  const event = after.timeline[0];
  assert.equal(event.before.days[0].exercises[0].reps, 10);
  event.detail = "Private reasoning";
  const visible = projection(after, { role: "client", client_id: client.id });
  assert.equal(visible.clients.length, 1);
  assert.equal(visible.revisions.length, 0);
  assert.ok(!JSON.stringify(visible).includes("Private reasoning"));
  assert.equal(visible.notifications.length, 1);
});
test("client cannot change another client or change prescriptions or manufacture server events", () => {
  const data = foundations(createWorkspace()),
    user = { id: "client", role: "client", client_id: data.clients[0].id },
    view = projection(data, user);
  const attack = structuredClone(view);
  attack.clients[0].program.name = "Forged";
  assert.throws(() => mergeEdit(data, attack, user), /coach/);
  const events = structuredClone(view);
  events.revisions.push({ id: "fake" });
  assert.throws(() => mergeEdit(data, events, user), /dedicated/);
  const wrong = structuredClone(view);
  wrong.measurements.push({
    id: "fake",
    clientId: data.clients[1].id,
    date: "2026-10-16",
    weight: 70,
  });
  assert.throws(() => mergeEdit(data, wrong, user), /another/);
});
test("completed workout history cannot be overwritten by either role", () => {
  const data = foundations(createWorkspace()),
    user = { role: "coach" },
    next = structuredClone(data);
  next.sessions[0].sets[0].reps = 500;
  assert.throws(() => mergeEdit(data, next, user), /cannot be rewritten/);
});
test("coach cannot grant external AI consent on behalf of a client", async () => {
  const { command } = await import("../src/avalen/ecosystem/actions.js");
  const data = foundations(createWorkspace()),
    client = data.clients[0];
  assert.throws(
    () =>
      command(
        data,
        { role: "coach", id: "coach" },
        {
          action: "privacy.aiConsent",
          clientId: client.id,
          payload: { enabled: true },
        },
      ),
    /Only the client/,
  );
  command(
    data,
    { role: "client", id: "owner", client_id: client.id },
    {
      action: "privacy.aiConsent",
      clientId: client.id,
      payload: { enabled: true },
    },
  );
  assert.equal(client.externalAIConsent.enabled, true);
  const forged = structuredClone(data);
  forged.clients[0].externalAIConsent.enabled = false;
  assert.throws(
    () => mergeEdit(data, forged, { role: "coach" }),
    /Only the client/,
  );
});
test("record IDs and attachment references cannot be reassigned across clients", async () => {
  const { validateMediaChanges } = await import(
    "../server/media-permissions.js"
  );
  const data = foundations(createWorkspace()),
    client = data.clients[0],
    other = data.clients[1],
    user = { role: "client", client_id: client.id },
    view = projection(data, user);
  const foreign = data.foodLogs.find((f) => f.clientId === other.id);
  view.foodLogs.push({ ...foreign, clientId: client.id });
  assert.throws(() => mergeEdit(data, view, user), /identifiers/);
  const next = structuredClone(data);
  next.messages.push({
    id: "new",
    clientId: client.id,
    from: "client",
    file: { id: "foreign-file", type: "video/mp4" },
  });
  assert.throws(
    () =>
      validateMediaChanges(data, next, user, () => ({
        id: "foreign-file",
        client_id: other.id,
      })),
    /not assigned/,
  );
});
