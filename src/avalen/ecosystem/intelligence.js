import { answerFor } from "../checkin-model.js";
import { utcAdd, zonedDay, clientTimezone } from "./time.js";
import { equal, memory, newId, followUps } from "./memory.js";
import { t } from '../i18n.js';
const e1rm = (sets) =>
  Math.max(
    0,
    ...sets
      .filter((s) => !s.skipped && s.kind !== "Duration")
      .map((s) => Number(s.weight) * (1 + Number(s.reps) / 30)),
  );
export function analyzeClient(
  data,
  client,
  {
    today = zonedDay(clientTimezone(client)),
    includeSuppressed = false,
  } = {},
) {
  if (client.paused) return [];
  const start = utcAdd(today, -27),
    recentStart = utcAdd(today, -13),
    observations = [];
  const sessions = data.sessions
      .filter(
        (s) => s.clientId === client.id && s.date >= start && s.date <= today,
      )
      .sort((a, b) => a.date.localeCompare(b.date)),
    checkins = data.checkins
      .filter(
        (r) => r.clientId === client.id && r.date >= start && r.date <= today,
      )
      .sort((a, b) => a.date.localeCompare(b.date)),
    planned = client.schedule.filter(
      (s) => s.date >= recentStart && s.date < today,
    ),
    logged = planned.filter((p) => sessions.some((s) => s.date === p.date));
  const context = data.timeline.filter(
    (e) =>
      e.clientId === client.id &&
      ["programme", "nutrition", "schedule-decision"].includes(e.type) &&
      e.at.slice(0, 10) >= utcAdd(today, -7),
  );
  function add(
    key,
    title,
    detail,
    evidence,
    actions,
    priority = 3,
    proposal = null,
  ) {
    const insight = {
      id: `${client.id}:${key}`,
      key,
      clientId: client.id,
      title,
      detail,
      evidence,
      actions,
      priority,
      proposal,
      start,
      end: today,
      source: "Deterministic analysis of saved records",
      limitations: [
        "Missing logs are not proof of nonadherence.",
        "These observations support a coaching conversation; they are not diagnoses.",
      ],
      context: context.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.at.slice(0, 10),
      })),
    };
    insight.fingerprint = JSON.stringify({ evidence, proposal });
    observations.push(insight);
  }
  const energyRows = checkins
      .map((r) => ({
        row: r,
        value: Number(
          answerFor(r, { id: "score-energy", legacyKey: "Energy" }),
        ),
      }))
      .filter((r) => r.value >= 1 && r.value <= 5),
    low = energyRows.filter((r) => r.value <= 2);
  if (
    low.length >= 2 ||
    (low.length >= 1 &&
      planned.length >= 3 &&
      logged.length / planned.length < 0.75)
  )
    add(
      "energy-recovery",
      "Energy and training deserve a conversation",
      `${low.length} check-in${low.length === 1 ? " reports" : "s report"} low energy${planned.length ? `; ${logged.length}/${planned.length} scheduled sessions have a completed log in the last 14 days` : ""}.`,
      [
        ...low.map((x) => ({
          type: "checkin",
          recordId: x.row.id,
          date: x.row.date,
          text: t('Client-reported energy {value}/5', { value: x.value }),
        })),
        {
          type: "schedule",
          date: today,
          text: t('{length} completed logs for {length2} scheduled sessions · {recentStart} to {utcAdd}', { length: logged.length, length2: planned.length, recentStart, utcAdd: utcAdd(today, -1) }),
        },
      ],
      ["conversation", "recovery", "schedule", "checkin"],
      1,
    );
  else if (planned.length >= 3 && planned.length - logged.length >= 2)
    add(
      "schedule-gaps",
      "The current schedule may need a review",
      t('{count} scheduled sessions have no completed log in the last 14 days.', { count: planned.length - logged.length }),
      planned
        .filter((p) => !logged.includes(p))
        .map((p) => ({
          type: "schedule",
          date: p.date,
          text: t('{value} · no completed log', { value: client.program.days.find((d) => d.id === p.dayId)?.name || p.dayId }),
        })),
      ["schedule", "conversation"],
      2,
    );
  const days = (data.nutritionDays || [])
    .filter(
      (d) =>
        d.clientId === client.id &&
        d.date >= recentStart &&
        d.date <= today &&
        d.complete &&
        d.target?.kcal > 0,
    )
    .map((d) => ({
      day: d,
      foods: data.foodLogs.filter(
        (f) => f.clientId === client.id && f.date === d.date,
      ),
    }))
    .filter(
      (x) =>
        x.foods.length &&
        x.foods.every(
          (f) =>
            f.kcal !== null &&
            f.kcal !== undefined &&
            Number.isFinite(Number(f.kcal)),
        ),
    );
  const outside = days.filter(
    (x) =>
      Math.abs(
        x.foods.reduce((n, f) => n + Number(f.kcal), 0) - x.day.target.kcal,
      ) /
        x.day.target.kcal >
      0.15,
  );
  if (days.length >= 3 && outside.length / days.length >= 0.5)
    add(
      "nutrition-pattern",
      "A nutrition plan worth discussing",
      t('{outside}/{days} completed, fully quantified diary days were outside 15% of their saved calorie targets.', { outside: outside.length, days: days.length }),
      outside.map((x) => ({
        type: "nutrition",
        date: x.day.date,
        text: t('Logged {value} kcal · saved target {kcal} kcal', { value: Math.round(x.foods.reduce((n, f) => n + Number(f.kcal), 0)), kcal: x.day.target.kcal }),
      })),
      ["nutrition", "conversation", "checkin"],
      2,
    );
  const weights = data.measurements
    .filter(
      (m) =>
        m.clientId === client.id &&
        m.date >= start &&
        m.date <= today &&
        Number.isFinite(m.weight) &&
        m.weight > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (
    /lose|loss|reduce.*(fat|weight)/i.test(client.goal) &&
    weights.length >= 3 &&
    Date.parse(weights.at(-1).date) - Date.parse(weights[0].date) >=
      14 * 86400000 &&
    Math.max(...weights.map((w) => w.weight)) -
      Math.min(...weights.map((w) => w.weight)) <
      0.4
  )
    add(
      "weight-steady",
      "Recorded weight has stayed steady",
      "The available measurements span at least 14 days and remain within 0.4 kg.",
      weights.map((w) => ({
        type: "measurement",
        recordId: w.id,
        date: w.date,
        text: t('{weight} kg', { weight: w.weight }),
      })),
      ["conversation", "nutrition", "checkin"],
      3,
    );
  const exercises = [
    ...new Map(
      client.program.days
        .flatMap((d) => d.exercises)
        .map((ex) => [ex.name, ex]),
    ).values(),
  ];
  for (const ex of exercises) {
    const logs = sessions
      .map((s) => ({
        session: s,
        sets: s.sets.filter((x) => x.name === ex.name),
      }))
      .filter((x) => x.sets.length)
      .slice(-3);
    if (logs.length < 3) continue;
    const skipped = logs.filter((x) => x.sets.some((s) => s.skipped));
    if (skipped.length >= 2)
      add(
        `skip:${ex.name}`,
        `${ex.name} is being skipped`,
        `${skipped.length} of the last ${logs.length} logged sessions include skipped sets for this exercise.`,
        skipped.map((x) => ({
          type: "workout",
          recordId: x.session.id,
          date: x.session.date,
          text: t('Skipped sets: {length}', { length: x.sets.filter((s) => s.skipped).length }),
        })),
        ["conversation", "technique", "training"],
        2,
        {
          exerciseId: ex.id,
          before: { sets: ex.sets, reps: ex.reps, weight: ex.weight },
          after: { sets: ex.sets, reps: ex.reps, weight: ex.weight },
        },
      );
    const strength = logs.filter((x) =>
      x.sets.some((s) => !s.skipped && s.kind !== "Duration"),
    );
    if (strength.length < 3 || ex.kind === "Duration") continue;
    const values = strength.map((x) => e1rm(x.sets)),
      evidence = strength.map((x, i) => ({
        type: "workout",
        recordId: x.session.id,
        date: x.session.date,
        text: t('{name} · estimated 1RM {value} kg from logged reps/load', { name: ex.name, value: Math.round(values[i] * 10) / 10 }),
      }));
    if (
      values.every((v) => v > 0) &&
      Math.max(...values) / Math.min(...values) < 1.02
    )
      add(
        `steady:${ex.name}`,
        t('{name}: recorded strength is steady', { name: ex.name }),
        "Estimated 1RM changed by less than 2% across the last three recorded sessions. Effort, technique and missing sessions limit this comparison.",
        evidence,
        ["training", "recovery", "technique", "conversation"],
        3,
        {
          exerciseId: ex.id,
          before: { sets: ex.sets, reps: ex.reps, weight: ex.weight },
          after: { sets: ex.sets, reps: ex.reps, weight: ex.weight },
        },
      );
    if (
      !context.some((e) => e.type === "programme") &&
      strength.slice(-2).every(
        (x) =>
          x.sets.filter((s) => !s.skipped).length >= ex.sets &&
          x.sets
            .filter((s) => !s.skipped)
            .slice(0, ex.sets)
            .every((s) => s.reps >= ex.reps && s.weight >= ex.weight),
      ) &&
      ex.weight > 0
    )
      add(
        `progress:${ex.name}`,
        `${ex.name}: review a possible progression`,
        "The last two recorded sessions reached the prescribed reps and load. Confirm readiness and technique before accepting a load change.",
        evidence.slice(-2),
        ["training", "technique", "conversation"],
        4,
        {
          exerciseId: ex.id,
          before: { sets: ex.sets, reps: ex.reps, weight: ex.weight },
          after: {
            sets: ex.sets,
            reps: ex.reps,
            weight: Math.round((Number(ex.weight) + 2.5) * 10) / 10,
          },
        },
      );
  }
  const pending = (data.formSubmissions || []).filter(
    (r) => r.clientId === client.id && r.status === "pending",
  );
  if (pending.length)
    add(
      "technique-review",
      "Technique feedback is waiting",
      `${pending.length} exercise video${pending.length === 1 ? " is" : "s are"} ready for your review.`,
      pending.map((r) => ({
        type: "formlab",
        recordId: r.id,
        date: r.createdAt.slice(0, 10),
        text: r.exerciseName,
      })),
      ["technique"],
      1,
    );
  for (const f of followUps(data, client.id))
    add(
      `followup:${f.event.id}`,
      "Time to review an earlier coaching decision",
      `${f.count} relevant sessions were completed after the programme adjustment.`,
      [
        {
          type: "memory",
          recordId: f.event.id,
          date: f.event.at.slice(0, 10),
          text: f.event.title,
        },
        {
          type: "workout",
          date: today,
          text: t('Before: {beforeCount} sessions, {beforeVolume} kg volume. After: first 4 sessions, {afterVolume} kg volume. No causal claim.', { beforeCount: f.beforeCount, beforeVolume: f.beforeVolume, afterVolume: f.afterVolume }),
        },
      ],
      ["memory", "conversation", "training"],
      2,
    );
  return observations
    .filter((i) => {
      if (includeSuppressed) return true;
      const last = (data.insightDecisions || [])
        .filter((d) => d.clientId === client.id && d.key === i.key)
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      return !last?.until || last.until < today;
    })
    .sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
}
export function decideInsight(data, user, client, p) {
  const insight = analyzeClient(data, client, { includeSuppressed: true }).find(
    (i) => i.key === p.key,
  );
  if (!insight)
    throw new Error(
      t('This observation is no longer supported by the current records. Refresh the page.'),
    );
  const today = zonedDay(clientTimezone(client));
  if (
    !["dismiss", "snooze", "reject", "review", "approve"].includes(p.decision)
  )
    throw new Error(t('Choose a valid decision.'));
  if (p.decision === "approve") {
    if (p.fingerprint !== insight.fingerprint)
      throw new Error(
        t('The evidence changed. Review a fresh proposal before approving.'),
      );
    if (p.type === "training" || p.type === "recovery") {
      const ex = client.program.days
        .flatMap((d) => d.exercises)
        .find((e) => e.id === p.exerciseId);
      if (!ex) throw new Error(t('Choose an exercise in the current programme.'));
      const after = {
        sets: Number(p.values?.sets),
        reps: Number(p.values?.reps),
        weight: Number(p.values?.weight),
      };
      if (
        !Number.isInteger(after.sets) ||
        after.sets < 1 ||
        after.sets > 20 ||
        !Number.isInteger(after.reps) ||
        after.reps < 1 ||
        after.reps > 500 ||
        !Number.isFinite(after.weight) ||
        after.weight < 0 ||
        after.weight > 1000
      )
        throw new Error(t('Use 1–20 sets, 1–500 reps and 0–1,000 kg.'));
      const before = { sets: ex.sets, reps: ex.reps, weight: ex.weight };
      if (!equal(before, p.before))
        throw new Error(
          t('The prescription changed. Review the current programme.'),
        );
      if (equal(before, after))
        throw new Error(t('No prescription changes were proposed.'));
      Object.assign(ex, after);
    } else if (p.type === "nutrition") {
      const values = Object.fromEntries(
        ["kcal", "p", "c", "f"].map((k) => [k, Number(p.values?.[k])]),
      );
      if (
        values.kcal < 500 ||
        values.kcal > 10000 ||
        ["p", "c", "f"].some(
          (k) =>
            !Number.isFinite(values[k]) || values[k] < 0 || values[k] > 2000,
        ) ||
        !Number.isFinite(values.kcal)
      )
        throw new Error(t('Enter a valid nutrition prescription.'));
      const before = Object.fromEntries(
        Object.keys(values).map((k) => [k, client.nutrition[k]]),
      );
      if (!equal(before, p.before))
        throw new Error(
          t('The nutrition plan changed. Review the current targets.'),
        );
      if (equal(before, values))
        throw new Error(t('No nutrition changes were proposed.'));
      Object.assign(client.nutrition, values);
    } else if (p.type === "conversation") {
      if (!String(p.message || "").trim())
        throw new Error(t('Write the message before sending.'));
      data.messages.push({
        id: newId(),
        clientId: client.id,
        from: "coach",
        text: p.message.trim().slice(0, 4000),
        context: `Coaching review · ${insight.title}`,
        at: new Date().toISOString(),
        read: false,
      });
    } else
      throw new Error(t('Open the relevant review flow to make this change.'));
  }
  const decision = {
    id: newId(),
    clientId: client.id,
    key: insight.key,
    decision: p.decision,
    type: p.type || null,
    at: new Date().toISOString(),
    actorId: user.id,
    reason: String(p.reason || "").slice(0, 2000),
    until: utcAdd(
      today,
      p.decision === "snooze" ? 1 : p.decision === "review" ? 1 : 14,
    ),
    evidence: structuredClone(insight.evidence),
    fingerprint: insight.fingerprint,
  };
  data.insightDecisions.push(decision);
  memory(
    data,
    client.id,
    "intelligence",
    `${insight.title} · ${p.decision}`,
    decision.reason || `Coach ${p.decision} decision.`,
    {
      actorId: user.id,
      recordId: decision.id,
      insightKey: insight.key,
      evidence: decision.evidence,
      explanation:
        p.decision === "approve" && p.type !== "conversation"
          ? t('Your coach reviewed your progress and updated your {value}.', { value: p.type === "nutrition" ? "nutrition targets" : "training prescription" })
          : null,
    },
  );
}
