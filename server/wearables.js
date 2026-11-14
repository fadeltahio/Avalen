// Wearable connections. Each client connects their own account; tokens are sealed
// at rest and never leave the server. Daily readings live in their own table, not
// in the shared workspace, so background syncs never collide with a person's edits.
//
// Sources:
//   WHOOP API v2: developer.whoop.com (OAuth, /developer/v2/{recovery,activity/sleep,cycle},
//   webhooks signed base64(HMAC-SHA256(timestamp + raw body, client secret))).
//   Google Health API v4: developers.google.com/health (users/me/dataTypes/{type}/dataPoints).
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { fail } from './permissions.js';
import { secretBox } from './paymob.js';
import { ACCOUNT_PROVIDERS, UPLOAD_PROVIDERS, cleanMetrics, isDay, shareFor, visibleMetrics, latestDay, shiftDay } from '../src/avalen/wearables-model.js';

const WHOOP = {
  auth: 'https://api.prod.whoop.com/oauth/oauth2/auth',
  token: 'https://api.prod.whoop.com/oauth/oauth2/token',
  api: 'https://api.prod.whoop.com/developer/v2',
  scope: 'offline read:recovery read:cycles read:sleep read:profile',
};
const GOOGLE = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  revoke: 'https://oauth2.googleapis.com/revoke',
  api: 'https://health.googleapis.com/v4/users/me',
  scope: ['sleep.readonly', 'health_metrics_and_measurements.readonly', 'activity_and_fitness.readonly']
    .map((s) => `https://www.googleapis.com/auth/googlehealth.${s}`).join(' '),
};
const SYNC_EVERY = { whoop: 12 * 3600e3, google: 4 * 3600e3 };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const round = (v, places = 1) => (v == null || !Number.isFinite(Number(v)) ? undefined : Math.round(Number(v) * 10 ** places) / 10 ** places);
const prune = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && Number.isFinite(v)));

// ---- Pure conversions (tested) ----

// Local calendar day of an ISO instant, using the provider's "+hh:mm" offset.
export function localDay(iso, offset = '+00:00') {
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset || '+00:00');
  const shift = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t + shift * 60000).toISOString().slice(0, 10);
}
const merge = (map, date, values) => {
  if (!date) return;
  map.set(date, { ...(map.get(date) || {}), ...prune(values) });
};

// WHOOP: sleep and recovery belong to the day you woke up; strain to the cycle's day.
export function whoopDays({ sleeps = [], recoveries = [], cycles = [] }) {
  const days = new Map(), sleepDay = new Map();
  for (const s of sleeps) {
    if (s.nap || s.score_state !== 'SCORED' || !s.score) continue;
    const date = localDay(s.end, s.timezone_offset);
    sleepDay.set(String(s.id), date);
    const st = s.score.stage_summary || {};
    const asleep = (st.total_light_sleep_time_milli || 0) + (st.total_slow_wave_sleep_time_milli || 0) + (st.total_rem_sleep_time_milli || 0);
    merge(days, date, {
      sleepMinutes: asleep ? Math.round(asleep / 60000) : undefined,
      sleepScore: round(s.score.sleep_performance_percentage, 0),
      sleepEfficiency: round(s.score.sleep_efficiency_percentage, 0),
      respiratoryRate: round(s.score.respiratory_rate),
    });
  }
  for (const r of recoveries) {
    if (r.score_state !== 'SCORED' || !r.score) continue;
    const date = sleepDay.get(String(r.sleep_id));
    merge(days, date, {
      recoveryScore: round(r.score.recovery_score, 0),
      hrvMs: round(r.score.hrv_rmssd_milli),
      restingHr: round(r.score.resting_heart_rate, 0),
      spo2: round(r.score.spo2_percentage, 0),
      skinTempC: round(r.score.skin_temp_celsius),
    });
  }
  for (const c of cycles) {
    const date = localDay(c.start, c.timezone_offset);
    merge(days, date, {
      strain: c.score_state === 'SCORED' && c.score ? round(c.score.strain) : undefined,
      totalKcal: c.score_state === 'SCORED' && c.score?.kilojoule != null ? Math.round(c.score.kilojoule / 4.184) : undefined,
      steps: c.step_count == null ? undefined : Math.round(c.step_count),
    });
  }
  return [...days].filter(([, m]) => Object.keys(m).length).map(([date, metrics]) => ({ date, metrics }));
}

// Google returns civil dates either as "YYYY-MM-DD..." strings or {year, month, day}.
export function civilDay(value) {
  if (!value) return null;
  if (typeof value === 'string') return isDay(value.slice(0, 10)) ? value.slice(0, 10) : null;
  const d = value.date || value;
  if (!d.year) return null;
  const text = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  return isDay(text) ? text : null;
}
export function googleDays({ sleep = [], hrv = [], resting = [], steps = [], active = [] }) {
  const days = new Map(), sums = new Map();
  for (const point of sleep) {
    const s = point.sleep;
    if (!s || s.metadata?.nap || s.metadata?.mainSleep === false) continue;
    const date = civilDay(s.interval?.civilEndTime) || localDay(s.interval?.endTime, s.interval?.endUtcOffset);
    const asleep = Number(s.summary?.minutesAsleep), period = Number(s.summary?.minutesInSleepPeriod);
    merge(days, date, {
      sleepMinutes: Number.isFinite(asleep) ? asleep : undefined,
      sleepEfficiency: asleep && period ? Math.round((asleep / period) * 100) : undefined,
    });
  }
  for (const p of hrv) merge(days, civilDay(p.dailyHeartRateVariability?.date), { hrvMs: round(p.dailyHeartRateVariability?.averageHeartRateVariabilityMilliseconds) });
  for (const p of resting) merge(days, civilDay(p.dailyRestingHeartRate?.date), { restingHr: round(p.dailyRestingHeartRate?.beatsPerMinute, 0) });
  const add = (date, key, value) => {
    if (!date || !Number.isFinite(value)) return;
    const row = sums.get(date) || {};
    row[key] = (row[key] || 0) + value;
    sums.set(date, row);
  };
  for (const p of steps) add(civilDay(p.steps?.interval?.civilStartTime) || localDay(p.steps?.interval?.startTime, p.steps?.interval?.startUtcOffset), 'steps', Number(p.steps?.count));
  for (const p of active) add(civilDay(p.activeEnergyBurned?.interval?.civilStartTime) || localDay(p.activeEnergyBurned?.interval?.startTime, p.activeEnergyBurned?.interval?.startUtcOffset), 'activeKcal', Number(p.activeEnergyBurned?.kcal));
  for (const [date, row] of sums) merge(days, date, { steps: row.steps == null ? undefined : Math.round(row.steps), activeKcal: row.activeKcal == null ? undefined : Math.round(row.activeKcal) });
  return [...days].filter(([, m]) => Object.keys(m).length).map(([date, metrics]) => ({ date, metrics }));
}

export function validWhoopSignature(raw, timestamp, signature, secret) {
  if (!raw || !timestamp || typeof signature !== 'string' || !secret) return false;
  const expected = createHmac('sha256', secret).update(String(timestamp)).update(raw).digest();
  let given;
  try { given = Buffer.from(signature, 'base64'); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---- Service ----

export function wearableService({ store, root, fetchImpl = globalThis.fetch, publicUrl = process.env.AVALEN_PUBLIC_URL, secretsKey, env = process.env, loadWorkspace }) {
  const links = store.wearables;
  const box = secretBox(root, secretsKey ?? env.AVALEN_SECRETS_KEY);
  const base = publicUrl ? String(publicUrl).replace(/\/+$/, '') : '';
  const apps = {
    whoop: { id: env.AVALEN_WHOOP_CLIENT_ID || '', secret: env.AVALEN_WHOOP_CLIENT_SECRET || '' },
    google: { id: env.AVALEN_GOOGLE_HEALTH_CLIENT_ID || '', secret: env.AVALEN_GOOGLE_HEALTH_CLIENT_SECRET || '' },
  };
  const configured = (provider) => Boolean(apps[provider]?.id && apps[provider]?.secret);
  const redirect = (provider) => `${base}/api/wearables/${provider}/callback`;
  const link = (ws, client, provider) => links.link(ws, client, provider);
  const refreshing = new Map();
  const account = (provider) => {
    if (!ACCOUNT_PROVIDERS.includes(provider)) fail(404, 'This connection isn’t available.');
  };

  async function call(url, options, label) {
    let response;
    try {
      response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
    } catch {
      fail(502, `${label} couldn’t be reached. Try again in a moment.`);
    }
    const text = await response.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch {}
    return { ok: response.ok, status: response.status, json };
  }
  const form = (values) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(values).toString() });

  async function status(user, data) {
    const client = user.role === 'client' ? user.client_id : null;
    const rows = client ? await links.linksFor(user.workspace_id, client) : [];
    const uploads = client ? await links.lastUploads(user.workspace_id, client) : [];
    const out = {};
    for (const provider of ACCOUNT_PROVIDERS) {
      const row = rows.find((r) => r.provider === provider);
      out[provider] = { available: configured(provider) && Boolean(base), configured: configured(provider), publicAddress: Boolean(base), connected: Boolean(row), connectedAt: row?.connected_at || null, lastSyncAt: row?.last_sync_at || null, error: row?.last_error || null };
    }
    for (const provider of UPLOAD_PROVIDERS) out[provider] = { lastUploadAt: uploads.find((u) => u.provider === provider)?.at || null };
    out.share = client ? shareFor(data?.clients.find((c) => c.id === client)) : null;
    return out;
  }

  async function start(user, provider) {
    account(provider);
    if (user.role !== 'client') fail(403, 'Only the client can connect their own wearable.');
    if (!configured(provider)) fail(503, `${provider === 'whoop' ? 'WHOOP' : 'Google Health'} isn’t set up on this Avalen server yet.`);
    if (!base) fail(503, 'Wearable connections need the server’s public address (AVALEN_PUBLIC_URL).');
    await links.deleteExpiredStates(Date.now());
    // WHOOP's OAuth guide says a self-generated state "must be eight characters long".
    const state = randomBytes(provider === 'whoop' ? 6 : 24).toString('base64url');
    await links.saveState(hash(state), user.workspace_id, user.client_id, provider, Date.now() + 600000);
    const params = provider === 'whoop'
      ? { response_type: 'code', client_id: apps.whoop.id, redirect_uri: redirect('whoop'), scope: WHOOP.scope, state }
      : { response_type: 'code', client_id: apps.google.id, redirect_uri: redirect('google'), scope: GOOGLE.scope, state, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' };
    return { url: `${provider === 'whoop' ? WHOOP.auth : GOOGLE.auth}?${new URLSearchParams(params)}` };
  }

  // Returns the app address to send the browser back to.
  async function callback(provider, query) {
    account(provider);
    const back = (result) => `/#/client/you?devices=${encodeURIComponent(result)}&provider=${provider}`;
    const state = query.get('state') || '';
    const row = state ? await links.takeState(hash(state)) : null;
    if (!row || row.provider !== provider || row.expires < Date.now()) return back('expired');
    if (query.get('error') || !query.get('code')) return back('cancelled');
    const app = apps[provider];
    const token = await call(provider === 'whoop' ? WHOOP.token : GOOGLE.token, form({ grant_type: 'authorization_code', code: query.get('code'), redirect_uri: redirect(provider), client_id: app.id, client_secret: app.secret }), provider === 'whoop' ? 'WHOOP' : 'Google');
    if (!token.ok || !token.json.access_token) return back('failed');
    let external = null;
    if (provider === 'whoop') {
      const profile = await call(`${WHOOP.api}/user/profile/basic`, { headers: { Authorization: `Bearer ${token.json.access_token}` } }, 'WHOOP');
      external = profile.json.user_id == null ? null : String(profile.json.user_id);
    } else {
      const identity = await call(`${GOOGLE.api}/identity`, { headers: { Authorization: `Bearer ${token.json.access_token}` } }, 'Google');
      if (!identity.ok) return back(JSON.stringify(identity.json).includes('ACCOUNT_NOT_LINKED') ? 'not-linked' : 'failed');
      external = identity.json.healthUserId || identity.json.name || null;
    }
    await links.saveLink({
      workspace_id: row.workspace_id, client_id: row.client_id, provider, external_user: external,
      access_token: box.seal(token.json.access_token),
      refresh_token: token.json.refresh_token ? box.seal(token.json.refresh_token) : null,
      expires_at: Date.now() + Number(token.json.expires_in || 3600) * 1000, connected_at: new Date().toISOString(),
    });
    try { await sync(row.workspace_id, row.client_id, provider, 30); } catch {}
    return back('connected');
  }

  async function accessToken(row) {
    if (row.expires_at - 60000 > Date.now()) return box.open(row.access_token);
    const key = `${row.workspace_id}:${row.client_id}:${row.provider}`;
    // WHOOP rotates refresh tokens and rejects a second concurrent refresh.
    if (!refreshing.has(key)) refreshing.set(key, (async () => {
      if (!row.refresh_token) throw Object.assign(new Error('reconnect'), { reconnect: true });
      const app = apps[row.provider];
      const values = { grant_type: 'refresh_token', refresh_token: box.open(row.refresh_token), client_id: app.id, client_secret: app.secret };
      if (row.provider === 'whoop') values.scope = 'offline';
      const result = await call(row.provider === 'whoop' ? WHOOP.token : GOOGLE.token, form(values), row.provider === 'whoop' ? 'WHOOP' : 'Google');
      if (!result.ok || !result.json.access_token) throw Object.assign(new Error('reconnect'), { reconnect: result.status === 400 || result.status === 401 });
      await links.updateTokens(row, box.seal(result.json.access_token), result.json.refresh_token ? box.seal(result.json.refresh_token) : null,
        Date.now() + Number(result.json.expires_in || 3600) * 1000);
      return result.json.access_token;
    })().finally(() => refreshing.delete(key)));
    return refreshing.get(key);
  }

  async function pages(url, params, headers, listKey, nextKey, pageKey, label, max = 20) {
    const out = [];
    let next = '';
    for (let i = 0; i < max; i++) {
      const query = new URLSearchParams({ ...params, ...(next ? { [pageKey]: next } : {}) });
      const result = await call(`${url}?${query}`, { headers }, label);
      if (result.status === 401) throw Object.assign(new Error('reconnect'), { reconnect: true });
      if (!result.ok) throw new Error(`${label} returned ${result.status}`);
      out.push(...(result.json[listKey] || []));
      next = result.json[nextKey] || '';
      if (!next) break;
    }
    return out;
  }

  async function saveDays(ws, client, provider, days) {
    const at = new Date().toISOString();
    await store.transaction(async () => {
      for (const day of days) await links.saveDay(ws, client, provider, day.date, day.metrics, at);
    });
    return days.length;
  }

  async function sync(ws, client, provider, days = 14) {
    const row = await link(ws, client, provider);
    if (!row) fail(404, 'This wearable isn’t connected.');
    const now = new Date(), from = new Date(now.getTime() - days * 86400e3);
    // After a failed sync the worker waits an hour before trying again.
    const mark = (error) => links.markSync(ws, client, provider, error ? row.last_sync_at : now.toISOString(), error, error ? now.getTime() + 3600e3 : null);
    try {
      const auth = { Authorization: `Bearer ${await accessToken(row)}`, Accept: 'application/json' };
      let result;
      if (provider === 'whoop') {
        const params = { start: from.toISOString(), end: now.toISOString(), limit: '25' };
        const [sleeps, recoveries, cycles] = [
          await pages(`${WHOOP.api}/activity/sleep`, params, auth, 'records', 'next_token', 'nextToken', 'WHOOP'),
          await pages(`${WHOOP.api}/recovery`, params, auth, 'records', 'next_token', 'nextToken', 'WHOOP'),
          await pages(`${WHOOP.api}/cycle`, params, auth, 'records', 'next_token', 'nextToken', 'WHOOP'),
        ];
        result = whoopDays({ sleeps, recoveries, cycles });
      } else {
        const fromDay = from.toISOString().slice(0, 10), toDay = shiftDay(now.toISOString().slice(0, 10), 2);
        const list = (type, filter, size) => pages(`${GOOGLE.api}/dataTypes/${type}/dataPoints`, { filter, pageSize: String(size) }, auth, 'dataPoints', 'nextPageToken', 'pageToken', 'Google Health');
        result = googleDays({
          sleep: await list('sleep', `sleep.interval.civil_end_time >= "${fromDay}" AND sleep.interval.civil_end_time < "${toDay}"`, 25),
          hrv: await list('daily-heart-rate-variability', `dailyHeartRateVariability.date >= "${fromDay}" AND dailyHeartRateVariability.date < "${toDay}"`, 100),
          resting: await list('daily-resting-heart-rate', `dailyRestingHeartRate.date >= "${fromDay}" AND dailyRestingHeartRate.date < "${toDay}"`, 100),
          steps: await list('steps', `steps.interval.civil_start_time >= "${fromDay}" AND steps.interval.civil_start_time < "${toDay}"`, 10000),
          active: await list('active-energy-burned', `activeEnergyBurned.interval.civil_start_time >= "${fromDay}" AND activeEnergyBurned.interval.civil_start_time < "${toDay}"`, 10000),
        });
      }
      await saveDays(ws, client, provider, result);
      await mark(null);
      return { synced: result.length };
    } catch (error) {
      await mark(error.reconnect ? 'reconnect' : 'sync');
      if (error.status) throw error;
      fail(502, error.reconnect ? 'The connection has expired. Connect again to resume syncing.' : 'Syncing didn’t finish. Avalen will try again automatically.');
    }
  }

  async function disconnect(user, provider, { keepHistory = true } = {}) {
    if (user.role !== 'client') fail(403, 'Only the client can disconnect their wearable.');
    if (ACCOUNT_PROVIDERS.includes(provider)) {
      const row = await link(user.workspace_id, user.client_id, provider);
      if (row) {
        try {
          if (provider === 'whoop') await call(`${WHOOP.api}/user/access`, { method: 'DELETE', headers: { Authorization: `Bearer ${await accessToken(row)}` } }, 'WHOOP');
          else if (row.refresh_token) await call(GOOGLE.revoke, form({ token: box.open(row.refresh_token) }), 'Google');
        } catch {} // Access is removed on Avalen's side either way.
        await links.deleteLink(user.workspace_id, user.client_id, provider);
      }
    } else if (!UPLOAD_PROVIDERS.includes(provider)) fail(404, 'This connection isn’t available.');
    if (!keepHistory) await links.deleteDays(user.workspace_id, user.client_id, provider);
    return { ok: true };
  }

  // Readings sent by the client: the iPhone/Android apps (Apple Health, Health
  // Connect) or a manual entry.
  async function upload(user, input = {}) {
    if (user.role !== 'client') fail(403, 'Only the client can add their own readings.');
    if (!UPLOAD_PROVIDERS.includes(input.provider)) fail(400, 'Choose where these readings come from.');
    const rows = Array.isArray(input.days) ? input.days : [];
    if (!rows.length || rows.length > 60) fail(400, 'Send between 1 and 60 days of readings.');
    const today = new Date().toISOString().slice(0, 10);
    const days = rows.map((row) => {
      if (!isDay(row?.date) || row.date > shiftDay(today, 1) || row.date < shiftDay(today, -400)) fail(400, 'Each reading needs a recent date.');
      try { return { date: row.date, metrics: cleanMetrics(row.metrics) }; } catch (e) { fail(400, e.message); }
    });
    if (new Set(days.map((d) => d.date)).size !== days.length) fail(400, 'Send one entry per date.');
    if (input.provider === 'manual') {
      // Manual entries are added to, not replaced by, a later entry on the same day.
      for (const day of days) {
        const old = await links.day(user.workspace_id, user.client_id, 'manual', day.date);
        if (old) day.metrics = { ...old, ...day.metrics };
      }
    }
    return { saved: await saveDays(user.workspace_id, user.client_id, input.provider, days) };
  }

  async function rowsFor(ws, client, from) {
    return (await links.daysSince(ws, client, from))
      .map((r) => ({ clientId: client, provider: r.provider, date: r.date, metrics: JSON.parse(r.metrics), syncedAt: r.synced_at }));
  }
  const viewFor = (user, data, client, rows) => {
    if (user.role === 'client') return rows;
    const share = shareFor(data.clients.find((c) => c.id === client));
    return rows.map((r) => ({ ...r, metrics: visibleMetrics(r.metrics, share) })).filter((r) => Object.keys(r.metrics).length);
  };

  async function days(user, data, client, count = 14) {
    // A client who left keeps their readings; their former coach no longer sees them.
    if (!data.clients.some((c) => c.id === client && !c.leftAt) || (user.role === 'client' && user.client_id !== client)) fail(404, 'Client not found.');
    const n = Math.min(Math.max(Number(count) || 14, 1), 90);
    const connections = await links.linksFor(user.workspace_id, client);
    return {
      days: viewFor(user, data, client, await rowsFor(user.workspace_id, client, shiftDay(new Date().toISOString().slice(0, 10), -n))),
      share: shareFor(data.clients.find((c) => c.id === client)),
      connected: connections.map((l) => ({ provider: l.provider, lastSyncAt: l.last_sync_at, error: l.last_error })),
    };
  }

  async function summary(user, data) {
    if (user.role !== 'coach') fail(403, 'This action requires your coach.');
    const from = shiftDay(new Date().toISOString().slice(0, 10), -14);
    const connections = await links.linksInWorkspace(user.workspace_id);
    const clients = {};
    for (const c of data.clients.filter((client) => !client.leftAt)) {
      const rows = viewFor(user, data, c.id, await rowsFor(user.workspace_id, c.id, from));
      const connected = connections.filter((l) => l.client_id === c.id).map((l) => ({ provider: l.provider, lastSyncAt: l.last_sync_at, error: l.last_error }));
      if (rows.length || connected.length) clients[c.id] = { latest: latestDay(rows), connected };
    }
    return { clients };
  }

  async function webhook(raw, headers) {
    if (!configured('whoop')) fail(404, 'Not found.');
    if (!validWhoopSignature(raw, headers['x-whoop-signature-timestamp'], headers['x-whoop-signature'], apps.whoop.secret)) fail(401, 'Invalid signature.');
    let event;
    try { event = JSON.parse(raw.toString('utf8')); } catch { fail(400, 'Invalid JSON.'); }
    const id = String(event.trace_id || `${event.type}:${event.id}`);
    if (!(await links.firstDelivery(id, Date.now()))) return { queued: 0 };
    // Events only say that something changed; the data is fetched by the worker.
    const rows = await links.linksForExternalUser('whoop', String(event.user_id));
    for (const row of rows) await links.flagForSync(row.workspace_id, row.client_id, 'whoop');
    return { queued: rows.length };
  }

  // Called by the background worker: sync links that are due or flagged by a webhook.
  async function runDue(now = Date.now()) {
    let done = 0;
    for (const row of await links.linksToSync()) {
      if (!configured(row.provider) || (row.retry_at && row.retry_at > now)) continue;
      const last = row.last_sync_at ? Date.parse(row.last_sync_at) : 0;
      if (now - last < (SYNC_EVERY[row.provider] || 6 * 3600e3)) continue;
      try { await sync(row.workspace_id, row.client_id, row.provider, 3); done++; } catch {}
    }
    return done;
  }

  // Account deletion: revoke access at each provider (best effort), then remove
  // links, readings and pending sign-ins. clientId null means the whole workspace.
  async function forget(ws, clientId = null, { keepReadings = false } = {}) {
    for (const row of await links.linksMatching(ws, clientId)) {
      try {
        if (row.provider === 'whoop') await call(`${WHOOP.api}/user/access`, { method: 'DELETE', headers: { Authorization: `Bearer ${await accessToken(row)}` } }, 'WHOOP');
        else if (row.refresh_token) await call(GOOGLE.revoke, form({ token: box.open(row.refresh_token) }), 'Google');
      } catch {}
    }
    await links.deleteAll(ws, clientId, { keepReadings });
  }

  return { status, start, callback, sync, disconnect, upload, days, summary, webhook, runDue, configured, forget };
}
