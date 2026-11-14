import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, HeartPulse, Link2, RefreshCw, ShieldCheck, Smartphone, Watch } from 'lucide-react';
import { useApp } from './context.js';
import { connection, request } from './ecosystem/connection.js';
import { dayKey } from './store.js';
import { useWorkspaceSave } from './workspace-save.js';
import { Button, Field, Modal, Notice, SectionHead } from './ui.jsx';
import {
  ACCOUNT_PROVIDERS, DEVICE_PROVIDERS, METRICS, PROVIDERS, SHARE_GROUPS,
  cleanMetrics, formatMetric, hrvMethod, latestDay, sampleDays, shareFor, shiftDay, trend, visibleMetrics, wearableFlag,
} from './wearables-model.js';
import { formatDate, t } from './i18n.js';
import { wearableSync } from './features.js';
import './wearables.css';

const ICONS = { whoop: HeartPulse, google: Watch, apple: Watch, healthconnect: Smartphone };
const role = () => connection()?.user?.role || null;

export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 2) return t('just now');
  if (minutes < 60) return t('{count} min ago', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('{count}h ago', { count: hours });
  const days = Math.round(hours / 24);
  return days === 1 ? t('yesterday') : t('{count} days ago', { count: days });
}
const weekday = (date) => formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });

// Readings stored on this device: manual entries in the preview, plus the demo's
// generated sample history. While the iPhone app has no wearable sync, the demo's
// sample readings from WHOOP, Apple Health and the rest aren't shown there either.
function localRows(data, today) {
  return [...sampleDays(data, today), ...(data.wearableDays || [])].filter((row) => wearableSync() || row.provider === 'manual');
}

// ---- Coach: every client's latest reading ----
let summary = { value: null, at: 0, listeners: new Set(), loading: null };
function loadSummary(force = false) {
  if (summary.loading || (!force && summary.value && Date.now() - summary.at < 120000)) return;
  summary.loading = request('/wearables/summary')
    .then((result) => { summary.value = result.clients || {}; })
    .catch(() => { summary.value ||= {}; })
    .finally(() => { summary.at = Date.now(); summary.loading = null; summary.listeners.forEach((fn) => fn()); });
}
export function useWearableSummary() {
  const { data } = useApp();
  const live = role() === 'coach';
  const [, render] = useState(0);
  useEffect(() => {
    if (!live) return;
    const fn = () => render((n) => n + 1);
    summary.listeners.add(fn);
    loadSummary();
    const timer = setInterval(() => loadSummary(true), 300000);
    return () => { summary.listeners.delete(fn); clearInterval(timer); };
  }, [live]);
  const local = useMemo(() => {
    if (connection()) return {};
    const rows = localRows(data, dayKey()), out = {};
    for (const client of data.clients) {
      const share = shareFor(client);
      const mine = rows.filter((r) => r.clientId === client.id).map((r) => ({ ...r, metrics: visibleMetrics(r.metrics, share) })).filter((r) => Object.keys(r.metrics).length);
      if (mine.length) out[client.id] = { latest: latestDay(mine), connected: [] };
    }
    return out;
  }, [data.clients, data.wearableDays, data.demo]);
  return connection() ? (live ? summary.value || {} : {}) : local;
}
export const wearableFlagFor = (entry) => wearableFlag(entry?.latest, dayKey());

// ---- One client's history (coach or client) ----
function useClientDays(client, viewer) {
  const { data } = useApp();
  const live = Boolean(connection());
  const [remote, setRemote] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!live) return;
    let current = true;
    request(`/wearables/days?clientId=${encodeURIComponent(client.id)}&count=14`)
      .then((result) => current && setRemote(result))
      .catch(() => current && setRemote({ days: [], share: shareFor(client), connected: [], failed: true }));
    return () => { current = false; };
  }, [live, client.id, reload]);
  const local = useMemo(() => {
    if (live) return null;
    const share = shareFor(client);
    const rows = localRows(data, dayKey()).filter((r) => r.clientId === client.id);
    return { days: viewer === 'coach' ? rows.map((r) => ({ ...r, metrics: visibleMetrics(r.metrics, share) })).filter((r) => Object.keys(r.metrics).length) : rows, share, connected: [] };
  }, [live, data.wearableDays, data.demo, client, viewer]);
  return { ...(live ? remote || { days: [], share: shareFor(client), connected: [], loading: true } : local), refresh: () => setReload((n) => n + 1) };
}

// Compact line for the coach's client list.
export function WearableLine({ entry }) {
  const day = entry?.latest;
  if (!day) return null;
  const m = day.metrics, parts = [];
  if (m.recoveryScore != null) parts.push(t('Recovery {value}', { value: formatMetric('recoveryScore', m.recoveryScore) }));
  if (m.sleepMinutes != null) parts.push(t('Sleep {value}', { value: formatMetric('sleepMinutes', m.sleepMinutes) }));
  if (parts.length < 2 && m.hrvMs != null) parts.push(t('HRV {value}', { value: formatMetric('hrvMs', m.hrvMs) }));
  if (parts.length < 2 && m.steps != null) parts.push(t('{value} steps', { value: formatMetric('steps', m.steps) }));
  const today = dayKey();
  const when = day.date === today ? '' : day.date === shiftDay(today, -1) ? ' · yesterday' : ` · ${weekday(day.date)}`;
  return <small className="client-wearable"><HeartPulse size={13} aria-hidden="true"/>{parts.join(' · ')}<em>{PROVIDERS[day.provider]?.name}{when}</em></small>;
}

// ---- Headline tiles, shared by the coach card and the client home ----
const TILE_ORDER = [
  ['recoveryScore', 'hrvMs'],
  ['sleepMinutes'],
  ['strain', 'steps', 'activeKcal'],
];
const tileKeys = (m) => TILE_ORDER.map((keys) => keys.find((key) => m[key] != null)).filter(Boolean);
const tileLabel = (key, provider) => (key === 'hrvMs' ? `${t('HRV')} · ${hrvMethod(provider)}` : t(METRICS[key].label));
function WearableTiles({ day }) {
  const m = day.metrics;
  return <div className="wearable-tiles">{tileKeys(m).map((key) => <div key={key} className="wearable-tile"><small>{tileLabel(key, day.provider)}</small><b>{formatMetric(key, m[key])}</b>
    {key === 'sleepMinutes' && (m.sleepScore != null || m.sleepEfficiency != null) && <em>{m.sleepScore != null ? t('{value} performance', { value: formatMetric('sleepScore', m.sleepScore) }) : t('{value} efficiency', { value: formatMetric('sleepEfficiency', m.sleepEfficiency) })}</em>}
    {key === 'strain' && <em>{t('of 21')}</em>}
  </div>)}</div>;
}

// ---- Client: home screen ----
export function ClientWearableHome() {
  const { client, navigate } = useApp();
  const { days, loading } = useClientDays(client, 'client');
  const today = dayKey();
  const latest = latestDay((days || []).filter((d) => d.date >= shiftDay(today, -2)));
  if (loading) return null;
  if (!latest) return <button className="wearable-home-connect" onClick={() => navigate('you')}><HeartPulse size={19}/><span><b>{wearableSync() ? t('Connect your wearable') : t('Add sleep & recovery')}</b><small>{wearableSync() ? t('Sleep, recovery and activity, shared with your coach') : t('Enter last night’s readings for your coach')}</small></span><ArrowRight size={18}/></button>;
  const when = latest.date === today ? t('LAST NIGHT') : latest.date === shiftDay(today, -1) ? t('YESTERDAY') : weekday(latest.date).toUpperCase();
  return <button type="button" className="card wearable-card wearable-home" aria-label={t('Your wearable readings from {source}', { source: PROVIDERS[latest.provider]?.name })} onClick={() => navigate('you')}>
    <div className="wearable-heading"><span>{when}</span><small>{PROVIDERS[latest.provider]?.name}</small></div>
    <WearableTiles day={latest}/>
    <p className="wearable-source">{latest.sample ? t('Sample data · demo workspace') : t('Shared with your coach · updated {when}', { when: ago(latest.syncedAt) })}</p>
  </button>;
}

// ---- Coach: home widget listing every client's latest reading ----
export function ClientRecoveryWidget({ summary }) {
  const { data, selectClient } = useApp();
  const today = dayKey();
  const rows = data.clients.filter((c) => !c.paused).map((client) => ({ client, day: summary[client.id]?.latest })).filter((r) => r.day && r.day.date >= shiftDay(today, -1));
  // Lowest recovery first, then shortest sleep, so the clients to check are on top.
  rows.sort((a, b) => (a.day.metrics.recoveryScore ?? 101) - (b.day.metrics.recoveryScore ?? 101) || (a.day.metrics.sleepMinutes ?? 1e4) - (b.day.metrics.sleepMinutes ?? 1e4));
  return <section className="card wearable-card coach-recovery-widget" aria-label={t('Client recovery')}>
    <div className="wearable-heading"><span>{t('CLIENT RECOVERY')}</span><small>{rows.length} {rows.length === 1 ? 'client' : 'clients'}</small></div>
    {rows.length ? <div className="coach-recovery-list">{rows.map(({ client, day }) => {
      const m = day.metrics, flag = wearableFlag(day, today);
      return <button key={client.id} className="coach-recovery-row" onClick={() => selectClient(client.id, 'Overview')}>
        <i className={flag ? `is-${flag.tone}` : ''} aria-hidden="true"/>
        <span><b>{t(client.name)}</b><small>{PROVIDERS[day.provider]?.name}{day.date === today ? '' : t(' · yesterday')}</small></span>
        <span className="coach-recovery-values">{m.recoveryScore != null && <em>{formatMetric('recoveryScore', m.recoveryScore)}<small>{t('Recovery')}</small></em>}{m.sleepMinutes != null && <em>{formatMetric('sleepMinutes', m.sleepMinutes)}<small>{t('Sleep')}</small></em>}</span>
        <ChevronRight size={16}/>
      </button>;
    })}</div> : <p className="wearable-empty">{(wearableSync() ? t('No wearable readings from the last two days. Clients connect a device from You → Connected devices.') : t('No readings from the last two days. Clients add them from You → Sleep & recovery.'))}</p>}
    {rows.some((r) => r.day.sample) && <p className="wearable-source">{t('Sample data · demo workspace')}</p>}
  </section>;
}

// ---- Coach: client overview card ----
export function CoachWearableCard({ client, onPlan }) {
  const { days, share, connected, loading, failed } = useClientDays(client, 'coach');
  const today = dayKey();
  const first = client.name.split(' ')[0];
  const latest = latestDay(days || []);
  const flag = wearableFlag(latest, today);
  const hidden = SHARE_GROUPS.filter(([key]) => share && share[key] === false).map(([, label]) => label.toLowerCase());
  const head = <div className="wearable-heading"><span>{t('SLEEP & RECOVERY')}</span>{latest && <small>{PROVIDERS[latest.provider]?.name}</small>}</div>;
  if (loading) return <section className="card wearable-card" aria-label={t('Sleep and recovery')} aria-busy="true">{head}<p className="wearable-empty">{t('Loading wearable readings…')}</p></section>;
  if (!latest) return <section className="card wearable-card" aria-label={t('Sleep and recovery')}>{head}
    <p className="wearable-empty">{failed ? t('Wearable readings couldn’t be loaded. Try again shortly.') : connected?.length ? t('{value} is connected. Readings appear after the first sync.', { value: PROVIDERS[connected[0].provider]?.name }) : hidden.length === 3 ? t('{first} has chosen not to share wearable readings.', { first }) : (wearableSync() ? t('No wearable readings yet. {first} can connect WHOOP, Google Health or Apple Health from You → Connected devices.', { first }) : t('No readings yet. {first} can add them from You → Sleep & recovery.', { first }))}</p>
  </section>;
  const m = latest.metrics, source = PROVIDERS[latest.provider]?.name;
  const tiles = tileKeys(m);
  const rest = Object.keys(METRICS).filter((key) => m[key] != null && !tiles.includes(key));
  const trendKey = ['recoveryScore', 'sleepMinutes', 'hrvMs', 'steps'].find((key) => (days || []).some((d) => d.provider === latest.provider && d.metrics[key] != null));
  const points = trend(days || [], latest.provider, today);
  const max = Math.max(...points.map((p) => p.day?.metrics[trendKey] || 0), trendKey === 'recoveryScore' ? 100 : 1);
  // The heading names the source, so labels stay short enough for a phone.
  const label = (key) => tileLabel(key, latest.provider);
  const dateLabel = latest.date === today ? 'Today' : latest.date === shiftDay(today, -1) ? 'Yesterday' : weekday(latest.date);
  const lastSync = connected?.find((c) => c.provider === latest.provider);
  return <section className="card wearable-card" aria-label={t('Sleep and recovery')}>
    {head}
    <p className="wearable-date">{dateLabel}</p>
    {flag && <div className={`wearable-flag is-${flag.tone}`}><span><b>{t(flag.title)}</b><small>{t(flag.detail)}</small></span>{onPlan && <button className="text-link" onClick={onPlan}>{t('Review plan')} <ArrowRight size={14}/></button>}</div>}
    <WearableTiles day={latest}/>
    {!m.recoveryScore && !m.strain && latest.provider !== 'manual' && <p className="wearable-note">{t('{source} doesn’t provide recovery or strain scores. Avalen shows its own readings only.', { source })}</p>}
    {rest.length > 0 && <dl className="wearable-details">{rest.filter((key) => !(key === 'sleepScore' && tiles.includes('sleepMinutes')) && !(key === 'sleepEfficiency' && tiles.includes('sleepMinutes') && m.sleepScore == null)).map((key) => <div key={key}><dt>{label(key)}</dt><dd>{formatMetric(key, m[key])}</dd></div>)}</dl>}
    {trendKey && <div className="wearable-trend" role="img" aria-label={t('{label}, last 7 days', { label: METRICS[trendKey].label })}>
      <small>{t('{label} · 7 days', { label: METRICS[trendKey].label })}</small>
      <div>{points.map(({ date, day }) => { const v = day?.metrics[trendKey]; const low = trendKey === 'recoveryScore' && v != null && v < 34; return <span key={date} className={low ? 'is-low' : ''}><i style={{ '--h': v == null ? 0 : Math.max(0.06, v / max) }} className={v == null ? 'is-empty' : ''}/><em>{new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' })}</em></span>; })}</div>
    </div>}
    <p className="wearable-source">{latest.sample ? t('Sample data · demo workspace') : `${source}${lastSync?.lastSyncAt ? ` · synced ${ago(lastSync.lastSyncAt)}` : latest.syncedAt ? ` · updated ${ago(latest.syncedAt)}` : ''}`}{lastSync?.error === 'reconnect' ? t(' · connection expired') : ''}{hidden.length ? t(' · {first} isn’t sharing {value}', { first, value: hidden.join(' or ') }) : ''}</p>
  </section>;
}

// ---- Client: connect and share ----
function returnedFromProvider() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const result = params.get('devices'), provider = params.get('provider');
  return result && PROVIDERS[provider] ? { result, provider } : null;
}
export const openDevicesOnReturn = () => Boolean(returnedFromProvider());
const RETURN_TEXT = {
  connected: (name) => `${name} is connected. Your readings will update every day.`,
  cancelled: (name) => `${name} wasn’t connected. Nothing was shared.`,
  expired: () => 'That connection link expired. Start again from here.',
  failed: (name) => `${name} couldn’t finish connecting. Try again in a moment.`,
  'not-linked': () => 'Set up the Google Health app on your phone first, then connect again.',
};

export function WearableConnections() {
  const { data, client } = useApp();
  const { save, saving, error } = useWorkspaceSave();
  const live = Boolean(connection());
  const [status, setStatus] = useState(null);
  const [returned] = useState(returnedFromProvider);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [manage, setManage] = useState(null);
  const [entry, setEntry] = useState(false);
  const { days, refresh } = useClientDays(client, 'client');
  const share = shareFor(client);
  const loadStatus = () => request('/wearables/status').then(setStatus).catch(() => setStatus({ failed: true }));
  useEffect(() => { if (live) loadStatus(); }, [live]);
  useEffect(() => { if (returned) history.replaceState(null, '', location.pathname + location.hash.split('?')[0]); }, []);

  async function connect(provider) {
    if (busy) return;
    setBusy(provider); setMessage('');
    try { location.assign((await request(`/wearables/${provider}/connect`, { method: 'POST', body: {} })).url); }
    catch (e) { setMessage(e.message); setBusy(''); }
  }
  async function syncNow(provider) {
    if (busy) return;
    setBusy(provider); setMessage('');
    try { await request('/wearables/sync', { method: 'POST', body: { provider } }); await loadStatus(); refresh(); setMessage(t('{name} is up to date.', { name: PROVIDERS[provider].name })); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(''); }
  }

  const latest = latestDay(days || []);
  return <section className="card connected-devices wearable-connections">
    <SectionHead title={wearableSync() ? t('Connected devices') : t('Sleep & recovery')} action={<span className="pill">{t('Private by choice')}</span>}/>
    <p>{wearableSync() ? t('Your sleep, recovery and activity, sent to your coach every day. You decide what they see.') : t('Add your sleep, recovery and activity readings for your coach. You decide what they see.')}</p>
    {returned && RETURN_TEXT[returned.result] && <Notice>{RETURN_TEXT[returned.result](PROVIDERS[returned.provider].name)}</Notice>}
    {wearableSync() && <div className="device-list">
      {ACCOUNT_PROVIDERS.map((id) => {
        const s = status?.[id], Icon = ICONS[id];
        const state = !live ? t('Available in your private coaching workspace')
          : !status ? t('Checking…')
          : s?.connected ? (s.error === 'reconnect' ? t('Connection expired · connect again') : s.lastSyncAt ? t('Connected · synced {when}', { when: ago(s.lastSyncAt) }) : t('Connected'))
          : s?.available ? t('Not connected') : !s?.configured ? t('Not set up on this Avalen server yet') : t('Needs the server’s public address');
        const action = live && s?.connected && s.error !== 'reconnect'
          ? <Button small secondary onClick={() => setManage(id)}>{t('Manage')}</Button>
          : live && s?.available ? <Button small disabled={Boolean(busy)} onClick={() => connect(id)}>{busy === id ? t('Opening…') : s?.connected ? t('Reconnect') : t('Connect')}</Button> : null;
        return <div className="device-row" key={id}><span className={`device-symbol ${id}`}><Icon size={24}/></span><span><b>{t(PROVIDERS[id].name)}</b><small>{PROVIDERS[id].devices}</small><em>{state}</em></span>{action}</div>;
      })}
      {DEVICE_PROVIDERS.map((id) => {
        const Icon = ICONS[id], last = status?.[id]?.lastUploadAt;
        return <div className="device-row" key={id}><span className={`device-symbol ${id}`}><Icon size={24}/></span><span><b>{t(PROVIDERS[id].name)}</b><small>{PROVIDERS[id].devices}</small><em>{last ? t('Last update {ago}', { ago: ago(last) }) : t('Syncs automatically from the Avalen {value} app', { value: PROVIDERS[id].platform === 'ios' ? 'iPhone' : 'Android' })}</em></span></div>;
      })}
    </div>}
    {message && <p className={/up to date/.test(message) ? 'muted' : 'error'} role="status">{message}</p>}
    {latest && <div className="device-readings wearable-mine">
      {['sleepMinutes', latest.metrics.recoveryScore != null ? 'recoveryScore' : 'hrvMs', 'steps', latest.metrics.activeKcal != null ? 'activeKcal' : 'totalKcal'].filter((key) => latest.metrics[key] != null).map((key) => <div key={key}><span><small>{key === 'hrvMs' ? t('HRV · {hrvMethod}', { hrvMethod: hrvMethod(latest.provider) }) : METRICS[key].label}</small><b>{formatMetric(key, latest.metrics[key])}</b></span></div>)}
    </div>}
    {latest && <small className="muted">{latest.sample ? t('Sample data · demo workspace') : `${PROVIDERS[latest.provider].name} · ${latest.date === dayKey() ? 'today' : weekday(latest.date)}`}</small>}
    <div className="wearable-share">
      <b>{t('What your coach sees')}</b>
      {SHARE_GROUPS.map(([key, label, detail]) => <label key={key} className="wearable-share-row"><span><b>{label}</b><small>{detail}</small></span>
        <input type="checkbox" checked={share[key]} disabled={saving} onChange={(e) => save((d) => { const c = d.clients.find((x) => x.id === client.id); c.wearables = { ...(c.wearables || {}), share: { ...shareFor(c), [key]: e.target.checked } }; })}/></label>)}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    <button className="text-link" onClick={() => setEntry(true)}>{t('Enter readings manually')} <ArrowRight size={14}/></button>
    <div className="privacy-footnote"><ShieldCheck size={17}/><p>{wearableSync() ? t('Nothing is read from a device or account until you connect it. You can disconnect at any time. Wearable scores are estimates from your device, not medical measurements, and never change your plan automatically.') : t('Avalen only shows what you enter here. Wearable scores are estimates from your device, not medical measurements, and never change your plan automatically.')}</p></div>
    {manage && <ManageConnection provider={manage} status={status?.[manage]} busy={busy} onSync={() => syncNow(manage)} onClose={() => setManage(null)} onDone={() => { setManage(null); loadStatus(); refresh(); }}/>}
    {entry && <ManualEntry onClose={() => setEntry(false)} onSaved={() => { setEntry(false); refresh(); setMessage(t('Your readings are saved.')); }}/>}
  </section>;
}

function ManageConnection({ provider, status, busy, onSync, onClose, onDone }) {
  const [history, setHistory] = useState('keep');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const name = PROVIDERS[provider].name;
  async function disconnect() {
    setWorking(true); setError('');
    try { await request(`/wearables/${provider}${history === 'delete' ? '?history=delete' : ''}`, { method: 'DELETE' }); onDone(); }
    catch (e) { setError(e.message); setWorking(false); }
  }
  return <Modal title={name} onClose={onClose} canClose={!working}>
    <div className="device-intro"><span className={`device-symbol ${provider}`}><Link2 size={26}/></span><h3>{t('Connected')}{status?.connectedAt ? t(' since {value}', { value: new Date(status.connectedAt).toLocaleDateString() }) : ''}</h3></div>
    <p className="muted">{status?.lastSyncAt ? t('Last synced {ago}.', { ago: ago(status.lastSyncAt) }) : t('Waiting for the first sync.')} {t('Avalen checks for new readings automatically')}{provider === 'whoop' ? t(' and as soon as WHOOP reports a new sleep or recovery') : t(' every few hours')}.</p>
    <Button secondary disabled={Boolean(busy) || working} onClick={onSync}><RefreshCw size={16}/>{busy === provider ? t('Syncing…') : t('Sync now')}</Button>
    <fieldset className="wearable-history" disabled={working}>
      <legend>{t('When you disconnect')}</legend>
      <label><input type="radio" name="history" checked={history === 'keep'} onChange={() => setHistory('keep')}/> {t('Keep past readings for my coach')}</label>
      <label><input type="radio" name="history" checked={history === 'delete'} onChange={() => setHistory('delete')}/> {t('Delete past')} {name} {t('readings from Avalen')}</label>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="text-link pay-disconnect" disabled={working} onClick={disconnect}>{working ? t('Disconnecting…') : t('Disconnect {name}', { name })}</button>
  </Modal>;
}

function ManualEntry({ onClose, onSaved }) {
  const { client } = useApp();
  const { save, saving } = useWorkspaceSave();
  const live = Boolean(connection());
  const today = dayKey();
  const [form, setForm] = useState({ date: today, sleepHours: '', hrvMs: '', restingHr: '', steps: '', activeKcal: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const set = (key) => (e) => { setError(''); setForm({ ...form, [key]: e.target.value }); };
  async function submit(e) {
    e.preventDefault();
    let metrics;
    try {
      metrics = cleanMetrics({ sleepMinutes: form.sleepHours === '' ? '' : Math.round(Number(form.sleepHours) * 60), hrvMs: form.hrvMs, restingHr: form.restingHr, steps: form.steps, activeKcal: form.activeKcal });
    } catch (err) { setError(err.message); return; }
    setSending(true);
    try {
      if (live) await request('/wearables/upload', { method: 'POST', body: { provider: 'manual', days: [{ date: form.date, metrics }] } });
      const habit = metrics.steps != null && form.date === today;
      if (live && !habit) { onSaved(); return; }
      const ok = await save((d) => {
        if (!live) {
          d.wearableDays ??= [];
          const old = d.wearableDays.find((r) => r.clientId === client.id && r.provider === 'manual' && r.date === form.date);
          if (old) Object.assign(old, { metrics: { ...old.metrics, ...metrics }, syncedAt: new Date().toISOString() });
          else d.wearableDays.push({ clientId: client.id, date: form.date, provider: 'manual', metrics, syncedAt: new Date().toISOString() });
        }
        // Steps also count toward the daily steps habit, as before.
        if (habit) {
          let log = d.habitLogs.find((x) => x.clientId === client.id && x.date === today);
          if (!log) { log = { clientId: client.id, date: today, values: {} }; d.habitLogs.push(log); }
          log.values.steps = metrics.steps;
        }
      });
      if (ok) onSaved();
      else setError(live ? t('Your readings are saved, but your daily steps habit couldn’t be updated.') : t('Your readings couldn’t be saved. Try again.'));
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  }
  const busy = sending || saving;
  return <Modal title={t('Enter readings')} onClose={onClose} canClose={!busy}>
    <p className="muted">{wearableSync() ? t('Copy the numbers from your device’s app, such as Apple Health. These stay labelled as manual entries.') : t('Copy the numbers from your device’s app. These stay labelled as manual entries.')}</p>
    <form onSubmit={submit}><fieldset className="save-fields" disabled={busy}>
      <Field label={t('Date')} type="date" max={today} min={shiftDay(today, -30)} value={form.date} onChange={set('date')} required/>
      <Field label={t('Sleep (hours)')} type="number" min="0" max="24" step="0.25" inputMode="decimal" value={form.sleepHours} onChange={set('sleepHours')} placeholder="7.5"/>
      <Field label={t('HRV (ms)')} type="number" min="1" max="300" step="1" inputMode="numeric" value={form.hrvMs} onChange={set('hrvMs')}/>
      <Field label={t('Resting heart rate (bpm)')} type="number" min="20" max="200" step="1" inputMode="numeric" value={form.restingHr} onChange={set('restingHr')}/>
      <Field label={t('Steps')} type="number" min="0" max="200000" step="1" inputMode="numeric" value={form.steps} onChange={set('steps')}/>
      <Field label={t('Active calories (kcal)')} type="number" min="0" max="20000" step="1" inputMode="numeric" value={form.activeKcal} onChange={set('activeKcal')}/>
      <Notice>{wearableSync() ? t('Apple Health shows HRV as SDNN; WHOOP and Fitbit use RMSSD. Your coach sees the number you enter, labelled as manual.') : t('Devices measure HRV in different ways, so enter the number your device shows. Your coach sees it labelled as manual.')}</Notice>
      {error && <p className="error" role="alert">{error}</p>}
      <Button type="submit">{busy ? t('Saving…') : t('Save readings')}</Button>
    </fieldset></form>
  </Modal>;
}
