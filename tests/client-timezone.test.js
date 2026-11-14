import test, { mock } from "node:test";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/avalen/seed.js";
import { foundations } from "../src/avalen/ecosystem/memory.js";
import { command } from "../src/avalen/ecosystem/actions.js";
import { reminderDue } from "../src/avalen/ecosystem/checkin-service.js";
import { checkinPlanFor } from "../src/avalen/checkin-model.js";
import { clientTimezone, deviceTimezone } from "../src/avalen/ecosystem/time.js";
import { fixture } from "./helpers/service.js";

// 00:30 on 14 November in Cairo is still 22:30 on 13 November in UTC.
const CAIRO_HALF_PAST_MIDNIGHT = new Date("2026-11-13T22:30:00Z");

test("a client's day follows the coach's chosen zone, then the client's own, then the device", () => {
  assert.equal(clientTimezone({ checkinPlan: { timezone: "Asia/Riyadh" }, timezone: "Africa/Cairo" }), "Asia/Riyadh");
  assert.equal(clientTimezone({ checkinPlan: { timezone: "" }, timezone: "Africa/Cairo" }), "Africa/Cairo");
  assert.equal(clientTimezone({ checkinPlan: { timezone: "Not/AZone" }, timezone: "Africa/Cairo" }), "Africa/Cairo");
  assert.equal(clientTimezone({}), deviceTimezone());
  assert.equal(checkinPlanFor({ created: "2026-11-01" }).timezone, "", "a new plan follows the client's own zone instead of fixing UTC");
});

test("a check-in sent at 00:30 in Cairo is dated that Cairo day, not the previous UTC day", () => {
  mock.timers.enable({ apis: ["Date"], now: CAIRO_HALF_PAST_MIDNIGHT });
  try {
    const data = foundations(createWorkspace()),
      client = data.clients[0];
    data.checkins = [];
    client.timezone = "Africa/Cairo";
    client.checkinPlan = { intervalDays: 7, startDate: "2026-11-10", timezone: "", fields: [{ id: "weight", label: "Weight", type: "number", min: 20, max: 400, unit: "kg", measurementKey: "weight", enabled: true }] };
    command(data, { role: "client", id: "u", client_id: client.id }, { action: "checkin.submit", clientId: client.id, payload: { id: "late-night", answers: { weight: 80 } } });
    const row = data.checkins.find((r) => r.id === "late-night");
    assert.equal(row.date, "2026-11-14");
    assert.equal(data.measurements.find((m) => m.clientId === client.id && m.date === "2026-11-14")?.weight, 80, "the weight lands on the same day");
  } finally {
    mock.timers.reset();
  }
});

test("reminders go out at the client's local time", () => {
  const data = foundations(createWorkspace()),
    client = data.clients[0];
  data.checkins = [];
  client.timezone = "Africa/Cairo";
  client.checkinPlan = { intervalDays: 7, startDate: "2026-11-14", timezone: "", reminderTime: "08:00", fields: [] };
  assert.equal(reminderDue(client, data.checkins, new Date("2026-11-14T05:30:00Z")), null, "07:30 in Cairo is too early");
  assert.deepEqual(reminderDue(client, data.checkins, new Date("2026-11-14T06:30:00Z")), { periodDate: "2026-11-14", timezone: "Africa/Cairo" });
});

test("a client can record their own time zone, but not an invalid one", async () => {
  const f = await fixture();
  try {
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Omar Client", email: "zone@test.app", password: "client-password-123", code } });
    const save = async (timezone) => {
      const current = await f.call("/api/workspace", { account: client });
      const data = structuredClone(current.data);
      data.clients[0].timezone = timezone;
      return f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: current.revision, changes: workspaceChanges(current.data, data) } });
    };
    assert.equal((await save("Africa/Cairo")).status, 200);
    assert.equal((await f.call("/api/workspace", { account: f.coach })).data.clients.find((c) => c.email === "zone@test.app").timezone, "Africa/Cairo");
    const rejected = await save("Mars/Olympus");
    assert.equal(rejected.status, 400);
    assert.match(rejected.error, /valid time zone/);
  } finally {
    await f.close();
  }
});
