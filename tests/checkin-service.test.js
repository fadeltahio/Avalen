import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { foundations } from "../src/avalen/ecosystem/memory.js";
import { command } from "../src/avalen/ecosystem/actions.js";
import { reminderDue } from "../src/avalen/ecosystem/checkin-service.js";
import { zonedDay, utcAdd } from "../src/avalen/ecosystem/time.js";
test("late voice/text check-ins keep their due period, summary provenance, measurements and one submission", () => {
  const data = foundations(createWorkspace()),
    client = data.clients[0];
  data.checkins = [];
  client.checkinPlan = {
    intervalDays: 7,
    startDate: utcAdd(zonedDay("UTC"), -3),
    timezone: "UTC",
    fields: [
      {
        id: "weight",
        label: "Weight",
        type: "number",
        min: 20,
        max: 400,
        unit: "kg",
        measurementKey: "weight",
        enabled: true,
        required: true,
      },
    ],
  };
  const user = { role: "client", id: "one", client_id: client.id };
  const input = {
    action: "checkin.submit",
    clientId: client.id,
    payload: {
      id: "first",
      answers: { weight: 81 },
      updateText: "Work was busy.",
    },
  };
  command(data, user, input);
  assert.equal(data.checkins[0].periodDate, client.checkinPlan.startDate);
  assert.equal(
    data.checkins[0].summary.source,
    "Stored records · rule-based summary",
  );
  assert.ok(
    data.checkins[0].summary.reported.includes("Client update: Work was busy."),
  );
  assert.throws(
    () =>
      command(data, user, {
        ...input,
        payload: { ...input.payload, id: "duplicate" },
      }),
    /already/,
  );
  assert.equal(
    data.measurements.find(
      (m) => m.clientId === client.id && m.date === zonedDay("UTC"),
    ).weight,
    81,
  );
  assert.throws(
    () =>
      command(data, user, {
        action: "checkin.review",
        clientId: client.id,
        payload: { id: "first" },
      }),
    /coach/,
  );
  command(
    data,
    { id: "coach", role: "coach" },
    {
      action: "checkin.review",
      clientId: client.id,
      payload: {
        id: "first",
        response: "Let’s review your schedule.",
        followUp: true,
      },
    },
  );
  assert.equal(data.checkins[0].reviewed, true);
  assert.equal(data.checkins[0].followUp, true);
  assert.equal(data.messages.at(-1).text, "Let’s review your schedule.");
});
test("reminder uses client local date/time across midnight and paused clients receive none", () => {
  const client = {
    id: "one",
    created: "2026-01-01",
    checkinPlan: {
      startDate: "2026-10-17",
      intervalDays: 7,
      timezone: "Pacific/Auckland",
      reminderTime: "08:00",
    },
  };
  assert.equal(reminderDue(client, [], new Date("2026-10-16T18:59:00Z")), null);
  assert.equal(
    reminderDue(client, [], new Date("2026-10-16T19:00:00Z")).periodDate,
    "2026-10-17",
  );
  client.paused = true;
  assert.equal(reminderDue(client, [], new Date("2026-10-17T10:00:00Z")), null);
});
test("a fixed weekly cadence stays on the coach-selected weekday after a late submission", async () => {
  const { checkinSchedule } = await import("../src/avalen/checkin-model.js");
  const client = {
    id: "one",
    checkinPlan: {
      startDate: "2026-10-12",
      intervalDays: 7,
      scheduleMode: "weekly",
      preferredWeekday: 1,
      timezone: "UTC",
    },
  };
  const next = checkinSchedule(
    client,
    [
      {
        id: "late",
        clientId: "one",
        date: "2026-10-14",
        periodDate: "2026-10-12",
      },
    ],
    "2026-10-15",
  );
  assert.equal(next.dueDate, "2026-10-19");
});

test("progress photos are optional on every check-in, even when the coach didn't ask for them, and are still checked", () => {
  const fresh = () => {
    const data = foundations(createWorkspace()), client = data.clients[0];
    data.checkins = [];
    client.checkinPlan = { intervalDays: 7, startDate: utcAdd(zonedDay("UTC"), -3), timezone: "UTC", fields: [{ id: "weight", label: "Weight", type: "number", min: 20, max: 400, unit: "kg", enabled: true, required: true }] };
    return { data, client, user: { role: "client", id: "one", client_id: client.id } };
  };
  const files = { "img-1": { client_id: null, type: "image/jpeg" }, "img-2": { client_id: null, type: "image/png" }, "voice-1": { client_id: null, type: "audio/webm" } };
  const mediaFor = (clientId) => (_user, id) => (files[id] ? { ...files[id], client_id: files[id].client_id ?? clientId } : null);

  const a = fresh();
  command(a.data, a.user, { action: "checkin.submit", clientId: a.client.id, payload: { id: "c1", answers: { weight: 80, photos: [{ id: "img-1", name: "front.jpg" }, { id: "img-2", name: "side.png" }] } } }, mediaFor(a.client.id));
  const row = a.data.checkins.find((r) => r.id === "c1");
  const field = row.schema.find((f) => f.type === "photos");
  assert.ok(field && field.enabled && !field.required, "photos field is added as optional");
  assert.equal(row.answers.photos.length, 2);

  const b = fresh();
  command(b.data, b.user, { action: "checkin.submit", clientId: b.client.id, payload: { id: "c2", answers: { weight: 80 } } }, mediaFor(b.client.id));
  assert.equal(b.data.checkins[0].schema.some((f) => f.type === "photos"), false, "no photos, no photo field");

  const c = fresh();
  assert.throws(() => command(c.data, c.user, { action: "checkin.submit", clientId: c.client.id, payload: { id: "c3", answers: { weight: 80, photos: Array.from({ length: 5 }, (_, i) => ({ id: `img-${(i % 2) + 1}` })) } } }, mediaFor(c.client.id)), /up to four/);
  assert.throws(() => command(c.data, c.user, { action: "checkin.submit", clientId: c.client.id, payload: { id: "c4", answers: { weight: 80, photos: [{ id: "voice-1" }] } } }, mediaFor(c.client.id)), /progress photos/);
  assert.throws(() => command(c.data, c.user, { action: "checkin.submit", clientId: c.client.id, payload: { id: "c5", answers: { weight: 80, photos: [{ id: "img-1" }] } } }, mediaFor("another-client")), /progress photos/);
});
