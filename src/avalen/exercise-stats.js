import { t } from "./i18n.js";
import { catalogueExercise } from "./exercise-catalogue.js";
// Turns a client's logged sets into the numbers on the exercise page. Nothing here is estimated.
const dayNumber = (key) => Date.parse(`${key}T00:00:00Z`);

export function findExercise(data, client, name) {
  if (!name) return null;
  const planned = client.program?.days.flatMap((day) => day.exercises).find((item) => item.name === name);
  if (planned) return planned;
  const listed = data.library.find((item) => item.name === name) || catalogueExercise(name);
  if (listed) return listed;
  const logged = data.sessions.some((session) => session.clientId === client.id && session.sets.some((set) => set.name === name));
  return logged ? { name, group: "" } : null;
}

export function exerciseEntries(sessions, clientId, name) {
  return sessions
    .filter((session) => session.clientId === clientId)
    .map((session) => ({
      id: session.id,
      date: session.date,
      sets: session.sets.filter((set) => set.name === name && !set.skipped),
    }))
    .filter((entry) => entry.sets.length)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function exerciseMetric(entries) {
  const sets = entries.flatMap((entry) => entry.sets);
  if (sets.length && sets.every((set) => set.kind === "Duration")) return { key: "time", label: "Avg time", unit: "sec" };
  if (sets.some((set) => set.kind !== "Duration" && Number(set.weight) > 0)) return { key: "load", label: "Avg volume load", unit: "kg" };
  return { key: "reps", label: "Avg reps", unit: "reps" };
}

export function entryValue(entry, metric) {
  return entry.sets.reduce((total, set) => {
    if (metric.key !== "load") return total + Number(set.reps || 0);
    return total + (set.kind === "Duration" ? 0 : Number(set.weight || 0) * Number(set.reps || 0));
  }, 0);
}

export function averageValue(entries, metric) {
  if (!entries.length) return null;
  return Math.round(entries.reduce((total, entry) => total + entryValue(entry, metric), 0) / entries.length);
}

// Each distinct best set counts once, dated to the first day it was reached.
export function exerciseRecords(entries, metric, limit = 3) {
  const seen = new Set();
  return entries
    .flatMap((entry) => entry.sets.map((set) => ({ weight: Number(set.weight || 0), reps: Number(set.reps || 0), kind: set.kind, date: entry.date })))
    .filter((set) => metric.key !== "load" || set.kind !== "Duration")
    .sort((a, b) => (metric.key === "load" ? b.weight - a.weight : 0) || b.reps - a.reps || a.date.localeCompare(b.date))
    .filter((set) => {
      const key = `${set.weight}:${set.reps}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

const counted = (key, reps) => (reps === "" || reps == null || !Number.isFinite(Number(reps)) ? t(key.replace("{count}", "{reps}"), { reps }) : t(key, { count: Number(reps) }));
export function setLabel(set, metric) {
  if (metric.key === "time") return counted("{count} sec", set.reps);
  if (metric.key === "reps") return counted("{count} reps", set.reps);
  return set.kind === "Duration" ? counted("{count} sec", set.reps) : t("{weight} kg × {reps}", { weight: set.weight, reps: set.reps });
}

export const entriesBetween = (entries, start, end) => entries.filter((entry) => entry.date >= start && entry.date <= end);

export const datePosition = (date, start, end) => (dayNumber(date) - dayNumber(start)) / Math.max(1, dayNumber(end) - dayNumber(start));

export function chartTop(highest) {
  if (!(highest > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(highest));
  return (Math.ceil((highest / step) * 2) / 2) * step;
}
