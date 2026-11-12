import { useEffect, useRef, useState } from "react";
import { createWorkspace } from "./seed.js";
import { checkinSchedule } from "./checkin-model.js";
import { nutritionScore } from "./nutrition-model.js";
import { parseWorkspace } from "./persistence.js";
import { foundations } from "./ecosystem/memory.js";
import { connection, subscribe, connectedUpdate, request, refreshConnection, hasPendingChanges, unsavedAction } from "./ecosystem/connection.js";

import { commitLocalWorkspace } from "./local-transaction.js";

export const STORAGE_KEY = "avalen.workspace.v1";
export { uid } from "./id.js";
import { uid } from "./id.js";
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dateOf = (key) => new Date(`${key}T12:00:00`);
export const offsetDay = (n, key = dayKey()) => {
  const d = dateOf(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const shortDate = (key) =>
  dateOf(key).toLocaleDateString("en", { month: "short", day: "numeric" });
export const daysBetween = (a, b) =>
  Math.round((dateOf(b) - dateOf(a)) / 86400000);
export const sum = (arr, key) =>
  arr.reduce(
    (s, x) => s + Number(typeof key === "function" ? key(x) : x[key] || 0),
    0,
  );
export const round = (n) => Math.round(n * 10) / 10;
export const calories = (foods) => sum(foods, "kcal");
export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

export function useWorkspace() {
  const [initial] = useState(() => {
    if (connection()) return {data: foundations(connection().data), recovery: null};
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      return { data: foundations(raw === null ? createWorkspace() : parseWorkspace(raw)), recovery: null };
    } catch {
      return { data: createWorkspace(), recovery: { raw, message: 'Your saved workspace could not be read safely. Nothing has been overwritten. Download a recovery copy before making any changes.' } };
    }
  });
  const [data, setData] = useState(initial.data);
  const current = useRef(initial.data);
  function accept(next) { current.current = next; setData(next); }
  const [recovery, setRecovery] = useState(initial.recovery);
  const [storageError, setStorageError] = useState(unsavedAction()?"An action has not been confirmed by the server. Retry it before making further changes.":"");
  useEffect(() => {
    if (recovery || connection()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current.current));
      setStorageError("");
    } catch {
      setStorageError(
        "Changes could not be saved on this device. Browser storage may be full or unavailable. Export your data before closing this tab.",
      );
    }
  }, [recovery]);
  useEffect(() => {
    if(connection()) {const unsubscribe=subscribe(value=>{accept(value.data);setStorageError(unsavedAction()?"An action has not been confirmed by the server. Retry it before making further changes.":"");});const poll=setInterval(()=>{if(!document.hidden&&!hasPendingChanges())refreshConnection().catch(()=>setStorageError('Connection unavailable. Your saved records remain on the server. Retry when your connection returns.'));},15000);return()=>{unsubscribe();clearInterval(poll);};}
    const sync = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          accept(foundations(parseWorkspace(e.newValue)));
          setRecovery(null);
        } catch {
          setRecovery({ raw: e.newValue, message: 'Another tab saved an unreadable workspace. Editing is paused to protect your records. Download a recovery copy and reload after it has been repaired.' });
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function update(fn) {
    if (recovery) return Promise.resolve({error: 'Editing is paused to protect your saved records.'});
    if (connection()) return connectedUpdate(fn).catch(error => {setStorageError(`${error.message} Your last action was not saved. Retry when your connection returns.`); return {error:error.message};});
    try {
      const next = commitLocalWorkspace(current.current, fn, {id:'device-preview', role:sessionStorage.getItem('avalen.role') || 'client'}, localStorage, STORAGE_KEY);
      accept(next);
      setStorageError('');
      return Promise.resolve();
    } catch {
      const error = 'Your last change couldn’t be saved on this device. Your previous records are intact. Free some browser storage and try again.';
      setStorageError(error);
      return Promise.resolve({error});
    }
  }
  return { data, update, storageError, recovery };
}

export function metrics(data, clientId, end = dayKey(), days = 28) {
  const client = data.clients.find((c) => c.id === clientId);
  const start = offsetDay(-days + 1, end);
  const sessions = data.sessions.filter(
    (s) => s.clientId === clientId && s.date >= start && s.date <= end,
  );
  const scheduled = client.schedule.filter(
    (s) => s.date >= start && s.date < end,
  );
  const done = scheduled.filter((s) =>
    sessions.some((w) => w.date === s.date),
  ).length;
  const scored = nutritionScore(data, clientId, start, end);
  const nutrition = scored.score;
  const weights = data.measurements
    .filter((m) => m.clientId === clientId && m.weight)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recentWeights = weights.filter((w) => w.date >= start && w.date <= end);
  const change =
    recentWeights.length > 1
      ? round(recentWeights.at(-1).weight - recentWeights[0].weight)
      : null;
  const checkins = data.checkins
    .filter((c) => c.clientId === clientId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const exerciseMax = {};
  sessions.forEach((s) =>
    s.sets
      .filter((x) => !x.skipped && x.kind !== "Duration")
      .forEach((x) => {
        exerciseMax[x.name] = Math.max(
          exerciseMax[x.name] || 0,
          x.weight * (1 + x.reps / 30),
        );
      }),
  );
  return {
    sessions,
    training: scheduled.length
      ? Math.round((done / scheduled.length) * 100)
      : null,
    nutrition,
    nutritionDays: scored.days,
    weights,
    recentWeights,
    change,
    lastWeight: weights.at(-1)?.weight,
    checkins,
    lastCheckin: checkins.at(-1),
    volume: sum(sessions, (s) =>
      sum(s.sets, (x) => (x.skipped || x.kind === "Duration" ? 0 : x.weight * x.reps)),
    ),
    exerciseMax,
    missed: scheduled.length - done,
  };
}

export function attentionFor(data, client) {
  if (client.paused) return [];
  const m = metrics(data, client.id, dayKey(), 21);
  const flags = [];
  const recent = m.weights.filter(
    (w) => w.date >= offsetDay(-21) && w.date <= dayKey(),
  );
  if (
    /lose|loss|reduce.*(fat|weight)/i.test(client.goal) &&
    recent.length >= 3 &&
    daysBetween(recent[0].date, recent.at(-1).date) >= 14 &&
    Math.max(...recent.map((x) => x.weight)) -
      Math.min(...recent.map((x) => x.weight)) <
      0.4
  )
    flags.push({
      key: "plateau",
      tone: "amber",
      title: "Weight trend stable",
      detail: "Weight has stayed within 0.4 kg for at least 14 days.",
      tab: "Progress",
    });
  if (m.missed >= 2)
    flags.push({
      key: "training",
      tone: "red",
      title: `${m.missed} workouts missed`,
      detail: `${m.missed} scheduled workouts have no completed log in the last 21 days.`,
      tab: "Plan",
    });
  const checkin = checkinSchedule(client,data.checkins);
  if (checkin.due)
    flags.push({key:'checkin',tone:'amber',title:checkin.overdue?'Check-in overdue':'Check-in due today',detail:`Due ${shortDate(checkin.dueDate)} · every ${checkin.intervalDays} days.${checkin.last?` Last submitted ${shortDate(checkin.last.date)}.`:' No check-in submitted yet.'}`,tab:'Check-ins'});
  if (m.nutritionDays >= 3 && m.nutrition !== null && m.nutrition < 70)
    flags.push({
      key: "nutrition",
      tone: "amber",
      title: "Nutrition needs a review",
      detail: `${m.nutrition}% of ${m.nutritionDays} completed days were within 15% of their saved calorie targets.`,
      tab: "Nutrition",
    });
  if (client.subscription.status === "Overdue")
    flags.push({
      key: "billing",
      tone: "red",
      title: "Payment overdue",
      detail: `${client.subscription.currency} ${client.subscription.amount.toLocaleString()} was due ${shortDate(client.subscription.nextDate)}.`,
      tab: "Billing",
    });
  if (daysBetween(dayKey(), client.programEnd) <= 7)
    flags.push({
      key: "ending",
      tone: "amber",
      title: "Program ending",
      detail: `Current block ends ${shortDate(client.programEnd)}.`,
      tab: "Plan",
    });
  const skips = {};
  m.sessions.forEach((s) =>
    new Set(s.sets.filter((x) => x.skipped).map((x) => x.name)).forEach(
      (name) => {
        skips[name] = (skips[name] || 0) + 1;
      },
    ),
  );
  Object.entries(skips)
    .filter(([, n]) => n >= 3)
    .forEach(([name, n]) =>
      flags.push({
        key: `skip-${name}`,
        tone: "amber",
        title: "Exercise consistently skipped",
        detail: `${name} had skipped sets in ${n} sessions. Ask why before changing the plan.`,
        tab: "Plan",
      }),
    );
  return flags.filter(
    (f) =>
      !data.dismissed.some(
        (d) =>
          d.clientId === client.id && d.key === f.key && d.until >= dayKey(),
      ),
  );
}

export function scheduleDay(client, key) {
  const travel =
    client.travel && key >= client.travel.start && key <= client.travel.end;
  const schedule = client.schedule.find((s) => s.date === key);
  return schedule
    ? (travel ? client.travel.days : client.program.days).find(
        (d) => d.id === schedule.dayId,
      ) || (travel ? client.travel.days : client.program.days)[0]
    : null;
}
export function historyFor(data, clientId, name) {
  return (
    data.sessions
      .filter(
        (s) =>
          s.clientId === clientId &&
          s.sets.some((x) => x.name === name && !x.skipped),
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0]
      ?.sets.filter((x) => x.name === name && !x.skipped) || []
  );
}
export function decision(d, clientId, title, detail) {
  d.timeline.unshift({
    id: uid(),
    clientId,
    title,
    detail,
    at: new Date().toISOString(),
    by: "coach",
  });
}
export function finishSession(d, draft) {
  if (
    !draft ||
    !draft.sets.some((s) => !s.skipped) ||
    d.sessions.some(
      (s) =>
        s.id === draft.id ||
        (s.clientId === draft.clientId && s.date === draft.date),
    )
  )
    return;
  const sets = draft.sets.filter((s) => !s.skipped);
  const previous = d.sessions.filter((s) => s.clientId === draft.clientId);
  const records = [];
  for (const name of new Set(sets.filter(s => s.kind !== "Duration").map((s) => s.name))) {
    const old = previous
      .flatMap((s) => s.sets)
      .filter((s) => s.name === name && !s.skipped);
    const best = Math.max(
      ...sets
        .filter((s) => s.name === name)
        .map((s) => s.weight * (1 + s.reps / 30)),
    );
    if (
      old.length &&
      best > Math.max(...old.map((s) => s.weight * (1 + s.reps / 30))) + 0.01
    )
      records.push(name);
  }
  const s = {
    ...draft,
    finishedAt: new Date().toISOString(),
    duration: Math.max(1, Math.floor((Date.now() - draft.startedAt) / 1000)),
    prs: records,
  };
  d.sessions.push(s);
  delete d.drafts[draft.clientId];
  d.timeline.unshift({
    id: uid(),
    clientId: draft.clientId,
    title: `Completed ${draft.title}`,
    detail: `${sets.length} sets · ${sum(sets, (x) => x.kind === "Duration" ? 0 : x.weight * x.reps).toLocaleString()} kg volume`,
    at: s.finishedAt,
    by: "client",
  });
}

let dbPromise;
function db() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("avalen-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = undefined; reject(request.error); };
    request.onblocked = () => { dbPromise = undefined; reject(new Error('Close other Avalen tabs and try the upload again.')); };
  }));
}
export async function saveFile(file, { types = ["image/"], maxMB = 10, clientId, scope, purpose } = {}) {
  if (!types.some((t) => file.type.startsWith(t)))
    throw new Error("Choose a supported file type.");
  if (file.size > maxMB * 1024 * 1024)
    throw new Error(`Choose a file smaller than ${maxMB} MB.`);
  if(connection()) return request('/media',{method:'POST',body:file,headers:{'Content-Type':file.type,'X-Client-Id':clientId || connection().data.activeClientId,'X-File-Name':encodeURIComponent(file.name),'X-Media-Scope':scope || 'client','X-Media-Purpose':purpose || 'general'}});
  const id = uid(),
    database = await db();
  // Store bytes rather than file-backed blobs. WebKit can reject File objects
  // after the picker has released its temporary file permission.
  const record = { bytes: await file.arrayBuffer(), type: file.type };
  await new Promise((resolve, reject) => {
    const tx = database.transaction("files", "readwrite");
    tx.objectStore("files").put(record, id);
    tx.oncomplete = resolve;
    tx.onerror = () =>
      reject(
        tx.error || new Error("The file could not be saved. Please try again."),
      );
    tx.onabort = () =>
      reject(
        tx.error ||
          new Error("File storage was interrupted. Please try again."),
      );
  });
  return { id, name: file.name, type: file.type, size: file.size };
}
export async function getFile(id) {
  if(connection()) {const response=await fetch(`/api/media/${encodeURIComponent(id)}`,{credentials:'same-origin'});if(!response.ok)throw new Error('This recording is unavailable or access has expired.');return response.blob();}
  return getDeviceFile(id);
}
export async function deleteDeviceFile(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('files','readwrite');tx.objectStore('files').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function getDeviceFile(id) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const r = database.transaction("files").objectStore("files").get(id);
    r.onsuccess = () =>
      resolve(
        r.result?.bytes
          ? new Blob([r.result.bytes], { type: r.result.type })
          : r.result,
      );
    r.onerror = () => reject(r.error);
  });
}
export function useFile(id) {
  const [result, setResult] = useState({ id: null, url: '' });
  useEffect(() => {
    let cancelled = false,
      objectURL;
    setResult({ id, url: '' });
    if (id)
      getFile(id)
        .then((blob) => {
          if (blob && !cancelled) {
            objectURL = URL.createObjectURL(blob);
            setResult({ id, url: objectURL });
          } else if (!cancelled) {
            setResult({ id, url: null });
          }
        })
        .catch(() => {
          if (!cancelled) setResult({ id, url: null });
        });
    return () => {
      cancelled = true;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [id]);
  return result.id === id ? result.url : '';
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // WebKit may start consuming a large image after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
