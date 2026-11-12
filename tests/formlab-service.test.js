import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { foundations } from "../src/avalen/ecosystem/memory.js";
import { command } from "../src/avalen/ecosystem/actions.js";
test("human technique reviews validate ownership, normalized annotations and immutable review versions", () => {
  const data = foundations(createWorkspace()),
    client = data.clients[0],
    actor = { role: "client", id: "client", client_id: client.id },
    exercise = client.program.days[0].exercises[0],
    file = { id: "video", type: "video/mp4", duration: 5 };
  const media = () => ({ ...file, client_id: client.id });
  command(
    data,
    actor,
    {
      action: "form.submit",
      clientId: client.id,
      payload: { file, exerciseId: exercise.id, consent: true },
    },
    media,
  );
  const row = data.formSubmissions[0];
  assert.equal(row.status, "pending");
  const payload = {
    id: row.id,
    feedback: "Steady setup.",
    annotations: [
      {
        id: "annotation",
        time: 2,
        text: "Keep your wrists stacked.",
        shapes: [{ type: "arrow", x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.6 }],
      },
    ],
  };
  assert.throws(
    () =>
      command(
        data,
        actor,
        { action: "form.review", clientId: client.id, payload },
        media,
      ),
    /coach/,
  );
  command(
    data,
    { role: "coach", id: "coach" },
    { action: "form.review", clientId: client.id, payload },
    media,
  );
  assert.equal(row.status, "reviewed");
  assert.equal(row.reviews[0].annotations[0].time, 2);
  const bad = structuredClone(payload);
  bad.annotations[0].shapes[0].x1 = 2;
  assert.throws(
    () =>
      command(
        data,
        { role: "coach" },
        { action: "form.review", clientId: client.id, payload: bad },
        media,
      ),
    /coordinates/,
  );
  command(
    data,
    { role: "coach", id: "coach" },
    {
      action: "form.review",
      clientId: client.id,
      payload: { ...payload, feedback: "Follow-up: clearer tempo." },
    },
    media,
  );
  assert.equal(row.reviews.length, 2);
  assert.equal(row.reviews[0].feedback, "Steady setup.");
  command(
    data,
    actor,
    { action: "form.viewed", clientId: client.id, payload: { id: row.id } },
    media,
  );
  assert.ok(row.viewedAt);
  assert.throws(
    () =>
      command(
        data,
        { ...actor, client_id: "other" },
        { action: "form.viewed", clientId: client.id, payload: { id: row.id } },
        media,
      ),
    /not found/,
  );
});
