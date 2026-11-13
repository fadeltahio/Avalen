import { t } from './i18n.js';

// Wearable readings: one record per client, provider and calendar day.
// Values are what each provider reports. Avalen never converts one provider's
// score into another's, and never calculates a recovery or strain score itself.

export const PROVIDERS = {
  whoop: { name: 'WHOOP', kind: 'account', devices: 'WHOOP band', order: 0 },
  google: { name: 'Google Health', kind: 'account', devices: 'Fitbit Air, Pixel Watch and Fitbit', order: 1 },
  apple: { name: 'Apple Health', kind: 'device', platform: 'ios', devices: 'Apple Watch, iPhone and apps that write to Health', order: 2 },
  healthconnect: { name: 'Health Connect', kind: 'device', platform: 'android', devices: 'Samsung, Garmin, Oura and other Android apps', order: 3 },
  manual: { name: 'Entered manually', kind: 'manual', devices: 'Copied from a device app', order: 4 },
};
export const ACCOUNT_PROVIDERS = ['whoop', 'google'];
export const DEVICE_PROVIDERS = ['apple', 'healthconnect'];
export const UPLOAD_PROVIDERS = ['apple', 'healthconnect', 'manual'];

const minutes = (value) => {
  const total = Math.round(value);
  const h = Math.floor(total / 60), m = total % 60;
  return h ? t('{h}h {m}m', { h, m: String(m).padStart(2, '0') }) : t('{m}m', { m });
};
const whole = (value) => Math.round(value).toLocaleString();

// group decides which client sharing switch covers the value.
export const METRICS = {
  sleepMinutes: { label: t('Sleep'), group: 'sleep', min: 0, max: 1440, format: minutes },
  sleepScore: { label: t('Sleep performance'), group: 'sleep', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  sleepEfficiency: { label: t('Sleep efficiency'), group: 'sleep', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  respiratoryRate: { label: t('Respiratory rate'), group: 'sleep', min: 4, max: 60, format: (v) => `${v.toFixed(1)} ${t('/min')}` },
  recoveryScore: { label: t('Recovery'), group: 'recovery', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
  hrvMs: { label: 'HRV', group: 'recovery', min: 1, max: 300, format: (v) => `${Math.round(v)} ${t('ms')}` },
  restingHr: { label: t('Resting heart rate'), group: 'recovery', min: 20, max: 200, format: (v) => `${Math.round(v)} ${t('bpm')}` },
  spo2: { label: t('Blood oxygen'), group: 'recovery', min: 50, max: 100, format: (v) => `${Math.round(v)}%` },
  skinTempC: { label: t('Skin temperature'), group: 'recovery', min: 25, max: 45, format: (v) => `${v.toFixed(1)} °C` },
  strain: { label: t('Strain'), group: 'activity', min: 0, max: 21, format: (v) => v.toFixed(1) },
  steps: { label: t('Steps'), group: 'activity', min: 0, max: 200000, format: whole },
  activeKcal: { label: t('Active calories'), group: 'activity', min: 0, max: 20000, format: (v) => `${whole(v)} ${t('kcal')}` },
  totalKcal: { label: t('Total calories'), group: 'activity', min: 0, max: 30000, format: (v) => `${whole(v)} ${t('kcal')}` },
};
export const SHARE_GROUPS = [
  ['sleep', 'Sleep', 'Duration, sleep score and efficiency'],
  ['recovery', 'Recovery', 'Recovery score, HRV and resting heart rate'],
  ['activity', 'Activity', 'Strain, steps and calories burned'],
];
// HRV is reported differently by different platforms: WHOOP, Google and Health
// Connect report RMSSD; Apple Health reports SDNN. They are not comparable.
export const hrvMethod = (provider) => (provider === 'apple' ? 'SDNN' : 'RMSSD');

export const formatMetric = (key, value) => (value == null || !METRICS[key] ? '—' : METRICS[key].format(value));
export const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export function shareFor(client) {
  const share = client?.wearables?.share || {};
  return Object.fromEntries(SHARE_GROUPS.map(([key]) => [key, share[key] !== false]));
}
// What the coach may see of one day, given the client's sharing choices.
export function visibleMetrics(metrics, share) {
  return Object.fromEntries(Object.entries(metrics || {}).filter(([key]) => METRICS[key] && share[METRICS[key].group] !== false));
}

// Returns clean metrics, or throws with a readable message. Unknown keys are dropped.
export function cleanMetrics(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(t('Readings are missing.'));
  const out = {};
  for (const [key, spec] of Object.entries(METRICS)) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < spec.min || value > spec.max)
      throw new Error(t('{label} must be between {min} and {max}.', { label: spec.label, min: spec.min, max: spec.max }));
    out[key] = Math.round(value * 100) / 100;
  }
  if (!Object.keys(out).length) throw new Error(t('Add at least one reading.'));
  return out;
}

const byRecent = (a, b) => b.date.localeCompare(a.date) || (PROVIDERS[a.provider]?.order ?? 9) - (PROVIDERS[b.provider]?.order ?? 9);
// The source the coach sees first: the most recently updated provider, with
// account connections preferred on the same day.
export function primaryProvider(days) {
  return [...days].sort(byRecent)[0]?.provider || null;
}
export function latestDay(days) {
  const provider = primaryProvider(days);
  return provider ? [...days].filter((d) => d.provider === provider).sort(byRecent)[0] : null;
}
export function trend(days, provider, today, count = 7) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = shiftDay(today, -i);
    out.push({ date, day: days.find((d) => d.provider === provider && d.date === date) || null });
  }
  return out;
}
export function shiftDay(day, offset) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Review flags use each provider's own numbers only.
// WHOOP's own colour bands put 0–33% recovery in its red (low) zone.
export const LOW_RECOVERY = 34;
export const SHORT_SLEEP = 300; // five hours
export function wearableFlag(day, today) {
  if (!day || day.date < shiftDay(today, -1)) return null;
  const m = day.metrics || {};
  const when = day.date === today ? 'today' : 'yesterday';
  if (m.recoveryScore != null && m.recoveryScore < LOW_RECOVERY)
    return { key: 'recovery', tone: 'red', title: when === 'today' ? t('Low recovery today') : t('Low recovery yesterday'), detail: m.hrvMs ? t('Recovery {value}% · HRV {hrv} ms', { value: Math.round(m.recoveryScore), hrv: Math.round(m.hrvMs) }) : t('Recovery {value}%', { value: Math.round(m.recoveryScore) }), tab: 'Overview', at: day.date };
  if (m.sleepMinutes != null && m.sleepMinutes < SHORT_SLEEP)
    return { key: 'recovery', tone: 'amber', title: when === 'today' ? t('Short sleep last night') : t('Short sleep the night before'), detail: t('Slept {minutes}', { minutes: minutes(m.sleepMinutes) }), tab: 'Overview', at: day.date };
  return null;
}

// ---- Demo workspace samples ----
// Generated on the fly for the preview demo only. Never stored, never sent to a
// server, and always marked as sample data in the interface.
const DEMO = { 'client-0': 'whoop', 'client-1': 'apple', 'client-2': 'google', 'client-3': 'whoop' };
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
export function sampleDays(data, today, count = 14) {
  if (!data?.demo) return [];
  const out = [];
  for (const client of data.clients || []) {
    const provider = DEMO[client.id];
    if (!provider) continue;
    for (let i = count - 1; i >= 0; i--) {
      const date = shiftDay(today, -i), r = seeded(`${client.id}:${date}`);
      const tired = client.id === 'client-3' && i === 0;
      const sleep = tired ? 262 : 380 + r() * 110;
      const metrics = { sleepMinutes: Math.round(sleep), restingHr: Math.round(52 + r() * 9 + (tired ? 7 : 0)), steps: Math.round(5200 + r() * 7800) };
      if (provider === 'whoop') Object.assign(metrics, {
        recoveryScore: Math.round(tired ? 22 : 45 + r() * 50), hrvMs: Math.round(tired ? 31 : 48 + r() * 40),
        sleepScore: Math.round(tired ? 58 : 72 + r() * 26), sleepEfficiency: Math.round(86 + r() * 10),
        strain: Math.round((7 + r() * 11) * 10) / 10, totalKcal: Math.round(2100 + r() * 900), respiratoryRate: Math.round((14.5 + r() * 2) * 10) / 10,
      });
      else Object.assign(metrics, {
        hrvMs: Math.round(provider === 'apple' ? 38 + r() * 30 : 30 + r() * 35), sleepEfficiency: Math.round(84 + r() * 12),
        activeKcal: Math.round(380 + r() * 520), ...(provider === 'apple' ? { totalKcal: Math.round(2000 + r() * 800) } : {}),
      });
      out.push({ clientId: client.id, date, provider, metrics, syncedAt: `${date}T09:12:00.000Z`, sample: true });
    }
  }
  return out;
}
