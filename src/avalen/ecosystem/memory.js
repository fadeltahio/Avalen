import { uid } from "../id.js";
import { sameData } from "./canonical.js";
export const ecosystemCollections = [
  "revisions",
  "scheduleProposals",
  "formSubmissions",
  "insightDecisions",
  "notifications",
  "clientPreferences",
];
// Same data, whatever the key order (see canonical.js for why order can differ).
export const equal = sameData;
export const newId = uid;
export function foundations(data) {
  if (!data.clientPreferences)
    data.clientPreferences = data.favorites?.length
      ? [
          {
            clientId: data.activeClientId,
            favorites: structuredClone(data.favorites),
          },
        ]
      : [];
  for (const key of ecosystemCollections) data[key] ||= [];
  data.payments ||= [];
  data.ecosystemVersion = 1;
  return data;
}
export function memory(data, clientId, type, title, detail = "", extras = {}) {
  foundations(data);
  const event = {
    id: newId(),
    clientId,
    type,
    title,
    detail,
    at: new Date().toISOString(),
    by: "coach",
    visibility: "coach",
    ...extras,
  };
  data.timeline.unshift(event);
  if (event.explanation)
    data.notifications.push({
      id: newId(),
      clientId,
      kind: "plan-update",
      sourceId: event.id,
      text: event.explanation,
      at: event.at,
      read: false,
    });
  return event;
}
export function recordChanges(
  before,
  after,
  actor = { role: "coach", id: "device-preview" },
) {
  foundations(after);
  for (const client of after.clients) {
    const old = before.clients.find((c) => c.id === client.id);
    if (!old) continue;
    for (const [key, type, title] of [
      ["program", "programme", "Programme updated"],
      ["nutrition", "nutrition", "Nutrition plan updated"],
      ["schedule", "schedule", "Training schedule updated"],
      ["checkinPlan", "checkin-plan", "Check-in plan updated"],
      ["travel", "travel", "Travel plan updated"],
      ["scheduleRules", "schedule-rules", "Scheduling permissions updated"],
    ]) {
      if (equal(old[key], client[key])) continue;
      const change = {
        field: key,
        before: structuredClone(old[key] ?? null),
        after: structuredClone(client[key] ?? null),
      };
      if (["program", "nutrition"].includes(key)) {
        if (
          !after.revisions.some(
            (r) => r.clientId === client.id && r.field === key,
          )
        )
          after.revisions.push({
            id: newId(),
            clientId: client.id,
            field: key,
            value: change.before,
            at: new Date().toISOString(),
            baseline: true,
          });
        after.revisions.push({
          id: newId(),
          clientId: client.id,
          field: key,
          value: change.after,
          at: new Date().toISOString(),
        });
      }
      memory(
        after,
        client.id,
        type,
        title,
        "Automatically captured from the saved plan.",
        {
          ...change,
          by: actor.role,
          actorId: actor.id,
          explanation:
            ["program", "nutrition", "schedule"].includes(key) &&
            !after.timeline.some(
              (e) =>
                e.clientId === client.id &&
                e.explanation &&
                !before.timeline.some((b) => b.id === e.id),
            )
              ? `Your coach updated your ${key === "program" ? "training programme" : key === "nutrition" ? "nutrition plan" : "training schedule"}.`
              : null,
        },
      );
    }
  }
}
export function followUps(data, clientId) {
  return (data.timeline || [])
    .filter((e) => e.clientId === clientId && e.type === "programme")
    .map((event) => {
      const oldExercises = (event.before?.days || []).flatMap(
          (d) => d.exercises,
        ),
        newExercises = (event.after?.days || []).flatMap((d) => d.exercises);
      const changed = new Set(
        newExercises
          .filter(
            (ex) =>
              !equal(
                ex,
                oldExercises.find((o) => o.id === ex.id),
              ),
          )
          .map((ex) => ex.name),
      );
      const relevant = (s) =>
        !changed.size || s.sets.some((x) => changed.has(x.name));
      const sessions = data.sessions.filter(
        (s) =>
          s.clientId === clientId &&
          s.finishedAt &&
          s.finishedAt > event.at &&
          relevant(s),
      );
      const before = data.sessions
        .filter(
          (s) =>
            s.clientId === clientId &&
            (s.finishedAt || s.date) < event.at &&
            relevant(s),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-4);
      const volume = (rows) =>
        rows.reduce(
          (n, s) =>
            n +
            s.sets
              .filter(
                (x) =>
                  !x.skipped &&
                  x.kind !== "Duration" &&
                  (!changed.size || changed.has(x.name)),
              )
              .reduce((v, x) => v + Number(x.weight) * Number(x.reps), 0),
          0,
        );
      return {
        event,
        count: sessions.length,
        beforeCount: before.length,
        beforeVolume: volume(before),
        afterVolume: volume(sessions.slice(0, 4)),
        ready: sessions.length >= 4,
      };
    })
    .filter((x) => x.ready);
}
