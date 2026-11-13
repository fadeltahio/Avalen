import { t } from './i18n.js';
import { catalogueExercise } from './exercise-catalogue.js';
// Recovery is an estimate from logged sets, never a measurement. No study gives a
// per-muscle table: the windows below are working defaults built on the common
// 48-72 hour guidance, scaled by what the session actually asked of each muscle.
const HOUR = 3600000;
const LOOKBACK = 14 * 24 * HOUR;

export const MUSCLES = [
  { id: "chest", label: t('Chest'), side: "front", hours: 60 },
  { id: "shoulders", label: t('Shoulders'), side: "front", hours: 48 },
  { id: "biceps", label: t('Biceps'), side: "front", hours: 40 },
  { id: "forearms", label: t('Forearms'), side: "front", hours: 36 },
  { id: "core", label: t('Core'), side: "front", hours: 36 },
  { id: "quads", label: t('Quads'), side: "front", hours: 72 },
  { id: "calves", label: t('Calves'), side: "back", hours: 48 },
  { id: "traps", label: t('Traps'), side: "back", hours: 48 },
  { id: "back", label: t('Back (muscle)'), side: "back", hours: 60 },
  { id: "triceps", label: t('Triceps'), side: "back", hours: 48 },
  { id: "lowerBack", label: t('Lower back'), side: "back", hours: 60 },
  { id: "glutes", label: t('Glutes'), side: "back", hours: 72 },
  { id: "hamstrings", label: t('Hamstrings'), side: "back", hours: 72 },
];

// First match wins, so specific movements sit above general ones.
const MOVEMENTS = [
  [/leg curl|hamstring curl|nordic/, ["hamstrings"], ["calves"]],
  [/romanian|rdl|stiff.?leg|good morning/, ["hamstrings"], ["glutes", "lowerBack"]],
  [/deadlift/, ["lowerBack", "hamstrings", "glutes"], ["back", "traps", "forearms"]],
  [/hip thrust|glute/, ["glutes"], ["hamstrings"]],
  [/calf/, ["calves"], []],
  [/lunge|split squat|step.?up/, ["quads", "glutes"], ["hamstrings"]],
  [/squat|leg press|hack/, ["quads"], ["glutes", "core"]],
  [/leg extension/, ["quads"], []],
  [/pushdown|tricep|skull|close.?grip/, ["triceps"], []],
  [/bench|chest press|push.?up|\bdips?\b|\bfly(es)?\b|\bpecs?\b/, ["chest"], ["triceps", "shoulders"]],
  [/incline/, ["chest"], ["triceps", "shoulders"]],
  [/curl/, ["biceps"], ["forearms"]],
  [/lateral raise|rear delt|face pull/, ["shoulders"], ["traps"]],
  [/overhead press|shoulder press|military|arnold/, ["shoulders"], ["triceps", "traps"]],
  [/shrug/, ["traps"], []],
  [/pull.?up|chin.?up|pulldown/, ["back"], ["biceps"]],
  [/\brows?\b/, ["back"], ["biceps", "traps"]],
  [/back extension|hyperextension/, ["lowerBack"], ["glutes"]],
  [/plank|crunch|sit.?up|leg raise|hollow/, ["core"], []],
  [/wrist|farmer/, ["forearms"], ["traps"]],
];
const GROUPS = {
  chest: ["chest"],
  back: ["back"],
  shoulders: ["shoulders"],
  arms: ["biceps", "triceps"],
  legs: ["quads", "glutes"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes"],
  calves: ["calves"],
  core: ["core"],
  abs: ["core"],
};
// Training to failure slows recovery by 24-48 hours (Moran-Navarro et al., 2017).
const EFFORT = { Easy: 0.8, Good: 1, Hard: 1.25 };

export function musclesFor({ name = "", group = "", muscles = null }) {
  if (muscles) return { primary: muscles.primary || [], secondary: muscles.secondary || [] };
  const known = MOVEMENTS.find(([pattern]) => pattern.test(name.toLowerCase()));
  if (known) return { primary: known[1], secondary: known[2] };
  return { primary: GROUPS[group.toLowerCase()] || [], secondary: [] };
}

const sessionTime = (session) =>
  Date.parse(session.finishedAt) || Date.parse(`${session.date}T18:00:00`);

// More sets mean a longer window, within limits: one set never counts as nothing and
// a huge session does not extend forever. Five effective sets is the base window.
const stress = (sets) => Math.max(0.6, Math.min(1.3, 0.55 + 0.09 * sets));

export function recoveryMap(data, clientId, now = Date.now()) {
  const library = data.library || [];
  const records = new Map();
  const sessions = (data.sessions || [])
    .filter((row) => row.clientId === clientId)
    .map((row) => ({ row, at: sessionTime(row) }))
    .filter(({ at }) => at <= now && now - at <= LOOKBACK)
    .sort((a, b) => a.at - b.at);
  for (const { row, at } of sessions) {
    const load = new Map();
    for (const set of row.sets || []) {
      if (set.skipped) continue;
      const movement = library.find((item) => item.name === set.name) || catalogueExercise(set.name);
      const { primary, secondary } = musclesFor({ name: set.name, group: movement?.group, muscles: movement?.muscles });
      const effort = EFFORT[set.effort] ?? 1;
      for (const [targets, share] of [[primary, 1], [secondary, 0.5]])
        for (const id of targets) {
          const entry = load.get(id) || { sets: 0, exercises: new Set() };
          entry.sets += share * effort;
          entry.exercises.add(set.name);
          load.set(id, entry);
        }
    }
    for (const [id, entry] of load) {
      const muscle = MUSCLES.find((item) => item.id === id);
      const earlier = records.get(id);
      // Training before a muscle has recovered adds a share of what was still owed.
      const owed = earlier ? Math.max(0, earlier.readyAt - at) : 0;
      records.set(id, {
        lastAt: at,
        readyAt: at + muscle.hours * stress(entry.sets) * HOUR + owed * 0.35,
        sets: Math.round(entry.sets * 10) / 10,
        exercises: [...entry.exercises],
        session: row.title,
      });
    }
  }
  const muscles = MUSCLES.map((muscle) => {
    const record = records.get(muscle.id);
    if (!record) return { ...muscle, state: "idle", percent: null, hoursLeft: 0 };
    const percent = Math.min(1, (now - record.lastAt) / (record.readyAt - record.lastAt));
    const state = percent >= 1 ? "ready" : percent < 0.34 ? "hot" : "recovering";
    return {
      ...muscle,
      ...record,
      state,
      percent,
      hoursLeft: Math.max(0, Math.ceil((record.readyAt - now) / HOUR)),
      hoursAgo: Math.floor((now - record.lastAt) / HOUR),
    };
  });
  return { muscles, logged: sessions.length > 0 };
}

const ORDER = { hot: 0, recovering: 1, ready: 2, idle: 3 };
export const byUrgency = (muscles) =>
  [...muscles].sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.hoursLeft - a.hoursLeft);

export function statusLine(muscle) {
  if (muscle.state === "hot") return t('Hot, {hoursAgo} h ago', { hoursAgo: muscle.hoursAgo });
  if (muscle.state === "recovering") return t('Recovering, {hoursLeft} h left', { hoursLeft: muscle.hoursLeft });
  if (muscle.state === "ready") return t('Ready to work');
  return t('Not trained lately');
}

// Which muscles a planned session leans on before they have recovered. This informs
// the client and coach; it never changes the prescription.
export function planPressure(map, day) {
  if (!day) return [];
  const planned = new Set(day.exercises.flatMap((exercise) => musclesFor(exercise).primary));
  return byUrgency(map.muscles.filter((muscle) => planned.has(muscle.id) && ["hot", "recovering"].includes(muscle.state)));
}
