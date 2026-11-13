import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { fixture } from "./helpers/service.js";
import { civilDay, googleDays, localDay, validWhoopSignature, whoopDays } from "../server/wearables.js";
import { cleanMetrics, latestDay, sampleDays, shareFor, visibleMetrics, wearableFlag } from "../src/avalen/wearables-model.js";
import { reviewQueue } from "../src/avalen/coach-review.js";

// Shapes follow the WHOOP v2 API reference.
const whoopSleep = (id, end, offset, overrides = {}) => ({
  id, cycle_id: 1, user_id: 77, start: "2026-11-11T22:40:00.000Z", end, timezone_offset: offset, nap: false, score_state: "SCORED",
  score: { stage_summary: { total_in_bed_time_milli: 28800000, total_awake_time_milli: 1800000, total_light_sleep_time_milli: 12600000, total_slow_wave_sleep_time_milli: 6300000, total_rem_sleep_time_milli: 6300000 },
    respiratory_rate: 15.62, sleep_performance_percentage: 88, sleep_consistency_percentage: 70, sleep_efficiency_percentage: 93.4 },
  ...overrides,
});
const whoopRecovery = (sleepId, score = 62) => ({ cycle_id: 1, sleep_id: sleepId, user_id: 77, score_state: "SCORED", score: { user_calibrating: false, recovery_score: score, resting_heart_rate: 54, hrv_rmssd_milli: 61.25, spo2_percentage: 96.2, skin_temp_celsius: 33.71 } });
const whoopCycle = (start, offset) => ({ id: 9, user_id: 77, start, end: null, timezone_offset: offset, score_state: "SCORED", score: { strain: 12.34, kilojoule: 9204.6, average_heart_rate: 71, max_heart_rate: 160 }, step_count: 8421 });

test("WHOOP sleep and recovery land on the local day you woke up; strain on the cycle's day", () => {
  assert.equal(localDay("2026-11-12T03:30:00.000Z", "-05:00"), "2026-11-11");
  assert.equal(localDay("2026-11-11T23:30:00.000Z", "+02:00"), "2026-11-12");
  const days = whoopDays({
    sleeps: [whoopSleep("s-1", "2026-11-12T05:10:00.000Z", "+02:00"), whoopSleep("nap", "2026-11-12T13:00:00.000Z", "+02:00", { nap: true }), whoopSleep("s-0", "2026-11-11T05:00:00.000Z", "+02:00", { score_state: "PENDING_SCORE" })],
    recoveries: [whoopRecovery("s-1"), whoopRecovery("missing-sleep", 10)],
    cycles: [whoopCycle("2026-11-12T05:10:00.000Z", "+02:00")],
  });
  assert.equal(days.length, 1);
  assert.deepEqual(days[0], { date: "2026-11-12", metrics: {
    sleepMinutes: 420, sleepScore: 88, sleepEfficiency: 93, respiratoryRate: 15.6,
    recoveryScore: 62, hrvMs: 61.3, restingHr: 54, spo2: 96, skinTempC: 33.7,
    strain: 12.3, totalKcal: 2200, steps: 8421,
  } });
});

test("Google Health readings are summed per civil day; efficiency is calculated, naps skipped", () => {
  assert.equal(civilDay("2026-11-12T07:01:00"), "2026-11-12");
  assert.equal(civilDay({ date: { year: 2026, month: 11, day: 2 } }), "2026-11-02");
  const days = googleDays({
    sleep: [
      { sleep: { interval: { civilEndTime: "2026-11-12T06:58:00" }, summary: { minutesAsleep: "402", minutesInSleepPeriod: "451" }, metadata: { mainSleep: true, nap: false } } },
      { sleep: { interval: { civilEndTime: "2026-11-12T15:20:00" }, summary: { minutesAsleep: "35", minutesInSleepPeriod: "40" }, metadata: { mainSleep: false, nap: true } } },
    ],
    hrv: [{ dailyHeartRateVariability: { date: { year: 2026, month: 11, day: 12 }, averageHeartRateVariabilityMilliseconds: 44.67 } }],
    resting: [{ dailyRestingHeartRate: { date: "2026-11-12", beatsPerMinute: "57" } }],
    steps: [
      { steps: { interval: { civilStartTime: "2026-11-12T08:00:00" }, count: "1200" } },
      { steps: { interval: { civilStartTime: "2026-11-12T09:00:00" }, count: "3400" } },
      { steps: { interval: { civilStartTime: "2026-11-11T21:00:00" }, count: "800" } },
    ],
    active: [{ activeEnergyBurned: { interval: { civilStartTime: "2026-11-12T09:00:00" }, kcal: 120.6 } }, { activeEnergyBurned: { interval: { civilStartTime: "2026-11-12T18:00:00" }, kcal: 210 } }],
  });
  const today = days.find((d) => d.date === "2026-11-12");
  assert.deepEqual(today.metrics, { sleepMinutes: 402, sleepEfficiency: 89, hrvMs: 44.7, restingHr: 57, steps: 4600, activeKcal: 331 });
  assert.deepEqual(days.find((d) => d.date === "2026-11-11").metrics, { steps: 800 });
});

test("WHOOP webhook signatures are base64 HMAC-SHA256 of timestamp + raw body", () => {
  const raw = Buffer.from('{"user_id":77,"id":"s-1","type":"sleep.updated","trace_id":"t-1"}');
  const sig = createHmac("sha256", "app-secret").update("1731400000000").update(raw).digest("base64");
  assert.equal(validWhoopSignature(raw, "1731400000000", sig, "app-secret"), true);
  assert.equal(validWhoopSignature(raw, "1731400000001", sig, "app-secret"), false);
  assert.equal(validWhoopSignature(Buffer.from(raw.toString().replace("77", "78")), "1731400000000", sig, "app-secret"), false);
  assert.equal(validWhoopSignature(raw, "1731400000000", sig, "other-secret"), false);
});

test("readings are range-checked, sharing hides groups from the coach, and flags use each device's own numbers", () => {
  assert.deepEqual(cleanMetrics({ sleepMinutes: "425", hrvMs: 52.456, extra: 9 }), { sleepMinutes: 425, hrvMs: 52.46 });
  assert.throws(() => cleanMetrics({ restingHr: 400 }), /Resting heart rate must be between/);
  assert.throws(() => cleanMetrics({}), /at least one/);
  const share = shareFor({ wearables: { share: { recovery: false } } });
  assert.deepEqual(share, { sleep: true, recovery: false, activity: true });
  assert.deepEqual(visibleMetrics({ sleepMinutes: 400, recoveryScore: 20, hrvMs: 40, steps: 9000 }, share), { sleepMinutes: 400, steps: 9000 });
  const today = "2026-11-12";
  assert.equal(wearableFlag({ date: today, provider: "whoop", metrics: { recoveryScore: 22, hrvMs: 31 } }, today).title, "Low recovery today");
  assert.equal(wearableFlag({ date: today, provider: "whoop", metrics: { recoveryScore: 34 } }, today), null);
  assert.equal(wearableFlag({ date: "2026-11-11", provider: "apple", metrics: { sleepMinutes: 250 } }, today).tone, "amber");
  assert.equal(wearableFlag({ date: "2026-11-09", provider: "whoop", metrics: { recoveryScore: 5 } }, today), null, "old readings never raise a flag");
  assert.equal(latestDay([{ date: today, provider: "apple", metrics: {} }, { date: today, provider: "whoop", metrics: {} }, { date: "2026-11-11", provider: "google", metrics: {} }]).provider, "whoop");
});

test("demo samples exist only in the demo workspace, are marked, and feed the review queue", () => {
  const clients = [{ id: "client-0", name: "A" }, { id: "client-3", name: "B" }, { id: "real", name: "C" }];
  assert.deepEqual(sampleDays({ clients }, "2026-11-12"), []);
  const samples = sampleDays({ demo: true, clients }, "2026-11-12");
  assert.ok(samples.length && samples.every((d) => d.sample === true && d.clientId !== "real"));
  const data = { clients: clients.map((c) => ({ ...c, program: { name: "P" }, schedule: [], habits: [], subscription: {} })), checkins: [], messages: [], formSubmissions: [], scheduleProposals: [], sessions: [], foodLogs: [], measurements: [], dismissed: [] };
  const latest = { latest: { date: new Date().toISOString().slice(0, 10), provider: "whoop", metrics: { recoveryScore: 20 } } };
  const row = reviewQueue(data, { "client-3": latest }).find((r) => r.client.id === "client-3");
  assert.ok(row.flags.some((f) => f.key === "recovery" && f.tone === "red"));
});

test("server: client connects WHOOP and Apple Health; the coach sees only what is shared; tokens never leave the server", async () => {
  const calls = [];
  let tokenNumber = 0;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const now = new Date();
  const wake = new Date(now.getTime() - 3 * 3600e3).toISOString();
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const u = new URL(url);
    if (u.pathname === "/oauth/oauth2/token") {
      const body = new URLSearchParams(options.body);
      tokenNumber++;
      return json({ access_token: `ACCESS-${tokenNumber}`, refresh_token: `REFRESH-${tokenNumber}`, expires_in: body.get("grant_type") === "authorization_code" ? 1 : 3600, scope: "offline read:recovery", token_type: "bearer", _grant: body.get("grant_type") });
    }
    if (u.pathname === "/developer/v2/user/profile/basic") return json({ user_id: 77, email: "c@x", first_name: "C", last_name: "O" });
    if (u.pathname === "/developer/v2/activity/sleep") return json({ records: [whoopSleep("s-1", wake, "+00:00")], next_token: "" });
    if (u.pathname === "/developer/v2/recovery") return json({ records: [whoopRecovery("s-1", 21)], next_token: "" });
    if (u.pathname === "/developer/v2/cycle") return json({ records: [whoopCycle(wake, "+00:00")], next_token: "" });
    if (u.pathname === "/developer/v2/user/access") return new Response(null, { status: 204 });
    return json({ error: "unexpected" }, 404);
  };
  const f = await fixture({ fetchImpl, publicUrl: "https://coach.example", secretsKey: randomBytes(32).toString("base64"), wearableEnv: { AVALEN_WHOOP_CLIENT_ID: "whoop-app", AVALEN_WHOOP_CLIENT_SECRET: "whoop-secret" } });
  try {
    const clientId = f.coach.data.clients[0].id;
    const invite = await f.call("/api/invitations", { method: "POST", account: f.coach, body: { clientId } });
    const client = await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "client@test.app", password: "client-password-123" } });
    assert.equal(client.status, 200);

    const status = await f.call("/api/wearables/status", { account: client });
    assert.deepEqual([status.whoop.available, status.whoop.connected, status.google.available, status.google.configured], [true, false, false, false]);
    assert.equal((await f.call("/api/wearables/whoop/connect", { method: "POST", account: f.coach, body: {} })).status, 403, "only the client connects");
    assert.equal((await f.call("/api/wearables/google/connect", { method: "POST", account: client, body: {} })).status, 503);

    const start = await f.call("/api/wearables/whoop/connect", { method: "POST", account: client, body: {} });
    const auth = new URL(start.url);
    assert.equal(auth.origin + auth.pathname, "https://api.prod.whoop.com/oauth/oauth2/auth");
    assert.equal(auth.searchParams.get("redirect_uri"), "https://coach.example/api/wearables/whoop/callback");
    assert.match(auth.searchParams.get("scope"), /\boffline\b.*read:recovery/);
    const state = auth.searchParams.get("state");
    assert.equal(state.length, 8);

    const back = await fetch(`${f.base}/api/wearables/whoop/callback?code=CODE-1&state=${state}`, { redirect: "manual" });
    assert.equal(back.status, 302);
    assert.equal(back.headers.get("location"), "/#/client/you?devices=connected&provider=whoop");
    const exchange = calls.find((c) => c.url.endsWith("/oauth/oauth2/token"));
    assert.equal(new URLSearchParams(exchange.options.body).get("code"), "CODE-1");
    const replay = await fetch(`${f.base}/api/wearables/whoop/callback?code=CODE-1&state=${state}`, { redirect: "manual" });
    assert.equal(replay.headers.get("location"), "/#/client/you?devices=expired&provider=whoop", "a state works once");

    const stored = JSON.stringify(await f.db.all("SELECT * FROM wearable_links"));
    assert.ok(!stored.includes("ACCESS-") && !stored.includes("REFRESH-"), "tokens are sealed at rest");
    // The first access token expired at once, so the sync refreshed and used the new one.
    assert.ok(calls.some((c) => c.url.includes("/developer/v2/recovery") && c.options.headers.Authorization === "Bearer ACCESS-2"));

    const today = localDay(wake, "+00:00");
    const coachView = await f.call(`/api/wearables/days?clientId=${clientId}`, { account: f.coach });
    assert.equal(coachView.status, 200);
    const day = coachView.days.find((d) => d.provider === "whoop" && d.date === today);
    assert.equal(day.metrics.recoveryScore, 21);
    assert.equal(day.metrics.strain, 12.3);
    const summary = await f.call("/api/wearables/summary", { account: f.coach });
    assert.equal(summary.clients[clientId].latest.metrics.recoveryScore, 21);
    assert.equal((await f.call("/api/wearables/summary", { account: client })).status, 403);
    assert.equal((await f.call("/api/wearables/days?clientId=someone-else", { account: client })).status, 404);

    // The client stops sharing recovery: the coach no longer receives it; the client still does.
    const ws = await f.call("/api/workspace", { account: client });
    const next = structuredClone(ws.data);
    next.clients[0].wearables = { share: { sleep: true, recovery: false, activity: true } };
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: ws.revision, data: next } })).status, 200);
    const hidden = (await f.call(`/api/wearables/days?clientId=${clientId}`, { account: f.coach })).days.find((d) => d.provider === "whoop" && d.date === today);
    assert.equal(hidden.metrics.recoveryScore, undefined);
    assert.equal(hidden.metrics.hrvMs, undefined);
    assert.equal(hidden.metrics.sleepMinutes, 420);
    assert.equal((await f.call(`/api/wearables/days?clientId=${clientId}`, { account: client })).days.find((d) => d.provider === "whoop" && d.date === today).metrics.recoveryScore, 21);

    // Apple Health readings arrive from the iPhone app; bad values are refused.
    assert.equal((await f.call("/api/wearables/upload", { method: "POST", account: client, body: { provider: "apple", days: [{ date: today, metrics: { restingHr: 999 } }] } })).status, 400);
    assert.equal((await f.call("/api/wearables/upload", { method: "POST", account: f.coach, body: { provider: "apple", days: [{ date: today, metrics: { steps: 10 } }] } })).status, 403);
    const up = await f.call("/api/wearables/upload", { method: "POST", account: client, body: { provider: "apple", days: [{ date: today, metrics: { sleepMinutes: 401, hrvMs: 48, steps: 10234, activeKcal: 512 } }] } });
    assert.deepEqual([up.status, up.saved], [200, 1]);
    assert.ok((await f.call(`/api/wearables/days?clientId=${clientId}`, { account: f.coach })).days.some((d) => d.provider === "apple" && d.metrics.steps === 10234));

    // A signed webhook marks the link for a fresh sync; an unsigned one is refused.
    const raw = JSON.stringify({ user_id: 77, id: "s-1", type: "recovery.updated", trace_id: "trace-1" });
    const ts = String(Date.now());
    const sig = createHmac("sha256", "whoop-secret").update(ts).update(raw).digest("base64");
    assert.equal((await fetch(`${f.base}/api/wearables/whoop/webhook`, { method: "POST", body: raw, headers: { "X-WHOOP-Signature": "bad", "X-WHOOP-Signature-Timestamp": ts } })).status, 401);
    assert.equal((await fetch(`${f.base}/api/wearables/whoop/webhook`, { method: "POST", body: raw, headers: { "X-WHOOP-Signature": sig, "X-WHOOP-Signature-Timestamp": ts } })).status, 204);
    assert.equal((await f.db.get("SELECT last_sync_at FROM wearable_links")).last_sync_at, null);
    assert.equal(await f.wearables.runDue(), 1);
    assert.ok((await f.db.get("SELECT last_sync_at FROM wearable_links")).last_sync_at);

    // Nothing the browser receives contains a token.
    for (const path of ["/api/wearables/status", `/api/wearables/days?clientId=${clientId}`, "/api/workspace"])
      assert.ok(!JSON.stringify(await f.call(path, { account: client })).match(/ACCESS-|REFRESH-/));
    assert.ok(!JSON.stringify(await f.call("/api/wearables/summary", { account: f.coach })).match(/ACCESS-|REFRESH-/));

    // Disconnecting revokes access at WHOOP and, when asked, deletes the history.
    assert.equal((await f.call("/api/wearables/whoop?history=delete", { method: "DELETE", account: client })).status, 200);
    assert.ok(calls.some((c) => c.url.endsWith("/developer/v2/user/access") && c.options.method === "DELETE"));
    assert.equal((await f.db.get("SELECT COUNT(*) AS n FROM wearable_links")).n, 0);
    const after = await f.call(`/api/wearables/days?clientId=${clientId}`, { account: f.coach });
    assert.deepEqual([...new Set(after.days.map((d) => d.provider))], ["apple"]);
  } finally {
    await f.close();
  }
});

test("server: Google Health connects with offline access, handles an unlinked account, and syncs with day filters", async () => {
  const calls = [];
  let linked = false;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const today = new Date().toISOString().slice(0, 10);
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const u = new URL(url);
    if (u.host === "oauth2.googleapis.com") return json({ access_token: "G-ACCESS", refresh_token: "G-REFRESH", expires_in: 3599, token_type: "Bearer" });
    if (u.pathname === "/v4/users/me/identity") return linked ? json({ healthUserId: "hu-1" }) : json({ error: { status: "FAILED_PRECONDITION", message: "ACCOUNT_NOT_LINKED" } }, 400);
    const type = u.pathname.match(/dataTypes\/([^/]+)\/dataPoints$/)?.[1];
    if (type === "sleep") return json({ dataPoints: [{ sleep: { interval: { civilEndTime: `${today}T07:00:00` }, summary: { minutesAsleep: "390", minutesInSleepPeriod: "420" }, metadata: { mainSleep: true } } }] });
    if (type === "daily-heart-rate-variability") return json({ dataPoints: [{ dailyHeartRateVariability: { date: today, averageHeartRateVariabilityMilliseconds: 41 } }] });
    if (type === "daily-resting-heart-rate") return json({ dataPoints: [{ dailyRestingHeartRate: { date: today, beatsPerMinute: "58" } }] });
    if (type === "steps") return json({ dataPoints: [{ steps: { interval: { civilStartTime: `${today}T10:00:00` }, count: "5000" } }], nextPageToken: "p2" }, 200);
    if (type === "active-energy-burned") return json({ dataPoints: [] });
    return json({}, 404);
  };
  // The steps endpoint returns a next page; the second page must carry pageToken.
  const paged = async (url, options) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/steps/dataPoints") && u.searchParams.get("pageToken") === "p2")
      return new Response(JSON.stringify({ dataPoints: [{ steps: { interval: { civilStartTime: `${today}T15:00:00` }, count: "2500" } }] }), { status: 200 });
    return fetchImpl(url, options);
  };
  const f = await fixture({ fetchImpl: paged, publicUrl: "https://coach.example", secretsKey: randomBytes(32).toString("base64"), wearableEnv: { AVALEN_GOOGLE_HEALTH_CLIENT_ID: "g-app", AVALEN_GOOGLE_HEALTH_CLIENT_SECRET: "g-secret" } });
  try {
    const clientId = f.coach.data.clients[0].id;
    const invite = await f.call("/api/invitations", { method: "POST", account: f.coach, body: { clientId } });
    const client = await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "client@test.app", password: "client-password-123" } });
    const begin = async () => new URL((await f.call("/api/wearables/google/connect", { method: "POST", account: client, body: {} })).url);
    const auth = await begin();
    assert.equal(auth.origin + auth.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.deepEqual([auth.searchParams.get("access_type"), auth.searchParams.get("prompt")], ["offline", "consent"]);
    assert.match(auth.searchParams.get("scope"), /googlehealth\.sleep\.readonly/);
    assert.match(auth.searchParams.get("scope"), /googlehealth\.activity_and_fitness\.readonly/);
    const unlinked = await fetch(`${f.base}/api/wearables/google/callback?code=C&state=${auth.searchParams.get("state")}`, { redirect: "manual" });
    assert.equal(unlinked.headers.get("location"), "/#/client/you?devices=not-linked&provider=google");
    assert.equal((await f.db.get("SELECT COUNT(*) AS n FROM wearable_links")).n, 0);

    linked = true;
    const again = await begin();
    const ok = await fetch(`${f.base}/api/wearables/google/callback?code=C2&state=${again.searchParams.get("state")}`, { redirect: "manual" });
    assert.equal(ok.headers.get("location"), "/#/client/you?devices=connected&provider=google");
    const sleepCall = calls.find((c) => c.url.includes("/dataTypes/sleep/dataPoints"));
    assert.match(new URL(sleepCall.url).searchParams.get("filter"), /^sleep\.interval\.civil_end_time >= "\d{4}-\d{2}-\d{2}" AND sleep\.interval\.civil_end_time < "/);
    assert.equal(sleepCall.options.headers.Authorization, "Bearer G-ACCESS");
    const day = (await f.call(`/api/wearables/days?clientId=${clientId}`, { account: f.coach })).days.find((d) => d.provider === "google" && d.date === today);
    assert.deepEqual(day.metrics, { sleepMinutes: 390, sleepEfficiency: 93, hrvMs: 41, restingHr: 58, steps: 7500 });

    assert.equal((await f.call("/api/wearables/google", { method: "DELETE", account: client })).status, 200);
    assert.ok(calls.some((c) => c.url === "https://oauth2.googleapis.com/revoke" && new URLSearchParams(c.options.body).get("token") === "G-REFRESH"));
    assert.ok((await f.call(`/api/wearables/days?clientId=${clientId}`, { account: f.coach })).days.some((d) => d.provider === "google"), "history is kept unless the client deletes it");
  } finally {
    await f.close();
  }
});
