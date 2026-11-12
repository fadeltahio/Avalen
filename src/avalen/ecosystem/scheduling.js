import { equal, memory, newId } from "./memory.js";
import { utcAdd, weekday, zonedDay, dateKey } from "./time.js";
export const defaultScheduleRules = {
  independent: false,
  requireApproval: true,
  allowedDays: [0, 1, 2, 3, 4, 5, 6],
  minSpacingDays: 1,
  maxWeekly: 4,
  preserveOrder: true,
  windowStart: "06:00",
  windowEnd: "22:00",
  priorities: {},
};
export function scheduleRules(client) {
  return {
    ...defaultScheduleRules,
    maxWeekly: Math.max(4, Math.min(7, client.program?.days.length || 4)),
    ...client.scheduleRules,
  };
}
export function policyError(rules) {
  if (
    !Array.isArray(rules.allowedDays) ||
    !rules.allowedDays.length ||
    rules.allowedDays.some((n) => !Number.isInteger(n) || n < 0 || n > 6)
  )
    return "Choose at least one valid training day.";
  if (
    !Number.isInteger(Number(rules.minSpacingDays)) ||
    rules.minSpacingDays < 1 ||
    rules.minSpacingDays > 7
  )
    return "Spacing must be 1–7 days.";
  if (
    !Number.isInteger(Number(rules.maxWeekly)) ||
    rules.maxWeekly < 1 ||
    rules.maxWeekly > 7
  )
    return "Weekly frequency must be 1–7 sessions.";
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(rules.windowStart) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(rules.windowEnd) ||
    rules.windowStart >= rules.windowEnd
  )
    return "Choose a valid daytime window.";
  if (
    Object.values(rules.priorities || {}).some(
      (p) => ![1, 2, 3].includes(Number(p)),
    )
  )
    return "Session priorities must be 1, 2 or 3.";
  return "";
}
const weekStart = (date) => utcAdd(date, -((weekday(date) + 6) % 7));
export function scheduleConflicts(client, sessions, original, proposed, today) {
  const rules = scheduleRules(client),
    issues = [],
    completed = new Set(
      sessions.filter((s) => s.clientId === client.id).map((s) => s.date),
    );
  const sorted = [...proposed].sort((a, b) => a.date.localeCompare(b.date));
  if (
    original.length !== proposed.length ||
    original.some(
      (s) =>
        !proposed.some((p) => p.dayId === s.dayId && p.originalDate === s.date),
    )
  )
    issues.push({
      hard: true,
      text: "Every prescribed session must remain in the schedule.",
    });
  if (
    sorted.some(
      (s, i) => !dateKey(s.date) || (i > 0 && s.date === sorted[i - 1].date),
    )
  )
    issues.push({ hard: true, text: "Two sessions cannot share a day." });
  for (const row of proposed) {
    const old = original.find(
      (s) => s.date === row.originalDate && s.dayId === row.dayId,
    );
    if (!old) continue;
    if (
      completed.has(old.date) &&
      (row.date !== old.date || (row.time || "") !== (old.time || ""))
    )
      issues.push({ hard: true, text: "Completed workouts cannot move." });
    if (row.date !== old.date) {
      if (row.date < today)
        issues.push({
          hard: true,
          text: "Sessions cannot move into the past.",
        });
      if (!rules.allowedDays.includes(weekday(row.date)))
        issues.push({
          text: `${row.date} is outside the allowed training days.`,
        });
      if (completed.has(row.date))
        issues.push({
          hard: true,
          text: "A completed workout already occupies this date.",
        });
    }
    if (
      row.time &&
      (row.date !== old.date || row.time !== old.time) &&
      (row.time < rules.windowStart || row.time > rules.windowEnd)
    )
      issues.push({
        text: `${row.date} is outside the permitted training window.`,
      });
  }
  const changedDates = new Set(
    proposed.filter((p) => p.date !== p.originalDate).map((p) => p.date),
  );
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1],
      b = sorted[i];
    if (!changedDates.has(a.date) && !changedDates.has(b.date)) continue;
    const gap = Math.round(
      (Date.parse(b.date) - Date.parse(a.date)) / 86400000,
    );
    if (gap < Number(rules.minSpacingDays))
      issues.push({
        text: `${a.date} and ${b.date} need at least ${rules.minSpacingDays} days of spacing.`,
      });
  }
  const counts = new Map();
  for (const row of proposed)
    counts.set(weekStart(row.date), (counts.get(weekStart(row.date)) || 0) + 1);
  for (const [week, count] of counts)
    if (
      count > Number(rules.maxWeekly) &&
      [...changedDates].some((d) => weekStart(d) === week)
    )
      issues.push({
        text: `Week of ${week} exceeds ${rules.maxWeekly} sessions.`,
      });
  if (rules.preserveOrder) {
    const a = [...original]
        .sort((x, y) => x.date.localeCompare(y.date))
        .map((s) => `${s.date}:${s.dayId}`),
      b = sorted.map((s) => `${s.originalDate}:${s.dayId}`);
    if (!equal(a, b))
      issues.push({ text: "This would change the prescribed workout order." });
  }
  return [...new Map(issues.map((i) => [i.text, i])).values()];
}
export function proposeSchedule(
  client,
  sessions,
  request,
  today = zonedDay(client.checkinPlan?.timezone || "UTC"),
) {
  const rules = scheduleRules(client),
    original = structuredClone(client.schedule).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    completed = new Set(
      sessions.filter((s) => s.clientId === client.id).map((s) => s.date),
    );
  let proposed = original.map((s) => ({ ...s, originalDate: s.date })),
    explanation = "";
  if (request.mode === "move") {
    if (!dateKey(request.from) || !dateKey(request.to))
      throw new Error("Choose the original and new training dates.");
    const row = proposed.find((s) => s.date === request.from);
    if (!row) throw new Error("Choose a scheduled workout.");
    if (completed.has(row.date))
      throw new Error("Completed workouts cannot move.");
    row.date = request.to;
    if (request.time) row.time = request.time;
    explanation =
      "Moved only the selected session. Exercises and prescriptions stay the same.";
  } else {
    const end = utcAdd(weekStart(today), 6),
      blocked = new Set(request.unavailable || []),
      toPlace = proposed.filter(
        (s) =>
          s.date <= end &&
          !completed.has(s.date) &&
          (s.date >= today ||
            (request.includeMissed && s.date >= weekStart(today))),
      );
    if (!rules.preserveOrder)
      toPlace.sort(
        (a, b) =>
          (Number(rules.priorities[b.dayId]) || 2) -
            (Number(rules.priorities[a.dayId]) || 2) ||
          a.originalDate.localeCompare(b.originalDate),
      );
    const fixed = proposed.filter((s) => !toPlace.includes(s)),
      days = Array.from({ length: 7 }, (_, i) => utcAdd(today, i)).filter(
        (d) =>
          d <= end &&
          !blocked.has(d) &&
          rules.allowedDays.includes(weekday(d)) &&
          !fixed.some((s) => s.date === d),
      );
    let answer = null;
    function search(index, assigned, last) {
      if (answer) return;
      if (index === toPlace.length) {
        const candidate = [...fixed, ...assigned];
        if (
          !scheduleConflicts(client, sessions, original, candidate, today)
            .length
        )
          answer = candidate;
        return;
      }
      for (const date of days) {
        if (date <= last || assigned.some((s) => s.date === date)) continue;
        search(
          index + 1,
          [
            ...assigned,
            {
              ...toPlace[index],
              date,
              time: toPlace[index].time || rules.windowStart,
            },
          ],
          date,
        );
      }
    }
    search(0, [], "");
    if (!answer)
      throw new Error(
        "No valid arrangement fits the remaining week. Try moving one session into next week or discuss which session to skip with your coach.",
      );
    proposed = answer;
    explanation = `Remaining sessions arranged around availability, recovery and ${rules.preserveOrder ? "the prescribed sequence" : "coach-set session priorities"}. ${request.includeMissed ? "You explicitly included missed sessions." : "Earlier missed sessions were not added back automatically."}`;
  }
  const moved = proposed.filter(
    (s) =>
      s.date !== s.originalDate ||
      (s.time || "") !==
        (original.find((x) => x.date === s.originalDate)?.time || ""),
  );
  if (!moved.length)
    throw new Error(
      "Your current schedule already fits. No dates need to change.",
    );
  const issues = scheduleConflicts(client, sessions, original, proposed, today);
  return {
    id: newId(),
    clientId: client.id,
    createdAt: new Date().toISOString(),
    original,
    proposed,
    issues,
    explanation,
    request: structuredClone(request),
    status: "preview",
    rules: structuredClone(rules),
  };
}
export function applyProposal(
  data,
  user,
  client,
  proposal,
  { reason = "", override = false } = {},
) {
  if (!equal(client.schedule, proposal.original))
    throw new Error(
      "The schedule changed after this proposal. Create a fresh preview.",
    );
  const today = zonedDay(client.checkinPlan?.timezone || "UTC"),
    issues = scheduleConflicts(
      client,
      data.sessions,
      proposal.original,
      proposal.proposed,
      today,
    ),
    rules = scheduleRules(client);
  if (issues.some((i) => i.hard))
    throw new Error(issues.find((i) => i.hard).text);
  if (
    user.role === "client" &&
    (!rules.independent || rules.requireApproval || issues.length)
  ) {
    proposal.status = "pending";
    proposal.requestedAt = new Date().toISOString();
    return "pending";
  }
  if (issues.length && (!override || !reason.trim()))
    throw new Error(
      "Explain the scheduling exception and explicitly approve the rule conflicts.",
    );
  client.schedule = proposal.proposed
    .map(({ originalDate, ...s }) => s)
    .sort((a, b) => a.date.localeCompare(b.date));
  proposal.status = "approved";
  proposal.approvedAt = new Date().toISOString();
  proposal.approvedBy = user.id;
  proposal.reason = reason.slice(0, 2000);
  memory(
    data,
    client.id,
    "schedule-decision",
    "Schedule adaptation approved",
    reason || proposal.explanation,
    {
      actorId: user.id,
      by: user.role,
      recordId: proposal.id,
      before: proposal.original,
      after: structuredClone(client.schedule),
      explanation: `Your training dates were adjusted. ${proposal.proposed.filter((s) => s.date !== s.originalDate).length} sessions moved; your exercises and prescriptions stay the same.`,
    },
  );
  return "approved";
}
