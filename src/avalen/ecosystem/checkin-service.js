import {
  checkinPlanFor,
  checkinSchedule,
  saveCheckin,
  answerFor,
  schemaFor,
  hasAnswer,
  CHECKIN_FIELDS,
} from "../checkin-model.js";
import { memory, newId } from "./memory.js";
import { zonedDay, utcAdd, validTimezone } from "./time.js";
import { t } from '../i18n.js';
export function checkinSummary(data, row) {
  const client = data.clients.find((c) => c.id === row.clientId),
    interval = Number(checkinPlanFor(client).intervalDays),
    end = row.date,
    start = utcAdd(row.periodDate || end, -interval + 1);
  const planned = client.schedule.filter(
      (s) => s.date >= start && s.date <= end,
    ),
    sessions = data.sessions.filter(
      (s) => s.clientId === client.id && s.date >= start && s.date <= end,
    );
  const reported = schemaFor(row)
    .filter(
      (f) =>
        f.type !== "photos" &&
        hasAnswer(answerFor(row, f)) &&
        !(
          f.id === "note" &&
          row.updateText?.trim() === String(answerFor(row, f)).trim()
        ),
    )
    .map(
      (f) => `${t(f.label)}: ${answerFor(row, f)}${f.unit ? " " + t(f.unit) : ""}`,
    );
  if (row.updateText?.trim())
    reported.push(`Client update: ${row.updateText.trim()}`);
  if (row.transcript?.trim())
    reported.push(`Client-corrected transcript: ${row.transcript.trim()}`);
  const lowEnergy =
    Number(answerFor(row, { id: "score-energy", legacyKey: "Energy" })) >= 1 &&
    Number(answerFor(row, { id: "score-energy", legacyKey: "Energy" })) <= 2;
  return {
    source: "Stored records · rule-based summary",
    start,
    end,
    reported,
    measured: [
      `${sessions.filter((s) => planned.some((p) => p.date === s.date)).length}/${planned.length} scheduled workouts have a completed log in this period.`,
      `${sessions.length} total completed workouts recorded.`,
    ],
    suggestion: lowEnergy
      ? "Discuss energy and recovery before changing the plan."
      : row.audio && !row.transcript
        ? "Listen to the recording before deciding on a follow-up."
        : "Review the client’s update alongside their recorded activity.",
    limitations:
      "No log does not prove that training did not happen. Ratings and comments are client reports, not diagnoses.",
  };
}
export function submitCheckin(data, user, client, p, media) {
  const today = zonedDay(client.checkinPlan?.timezone || "UTC"),
    existing = data.checkins.find((r) => r.id === p.id);
  if (existing && existing.clientId !== client.id)
    throw Object.assign(new Error(t('Check-in not found.')), { status: 404 });
  if (existing && existing.date !== today)
    throw Object.assign(
      new Error(t('Past submissions stay unchanged. Send a new update instead.')),
      { status: 409 },
    );
  const plan = checkinPlanFor(client),
    schedule = checkinSchedule(client, data.checkins, today);
  const periodDate =
    existing?.periodDate ||
    (plan.scheduleMode === "weekly"
      ? schedule.dueDate
      : schedule.dueDate <= today
        ? schedule.dueDate
        : today);
  if (
    data.checkins.some(
      (r) =>
        r.clientId === client.id &&
        r.id !== p.id &&
        (r.date === today || r.periodDate === periodDate),
    )
  )
    throw Object.assign(
      new Error(
        t('This check-in period already has a submission. Open today’s check-in to correct it.'),
      ),
      { status: 409 },
    );
  if (p.audio) {
    const file = media(user, p.audio.id);
    if (
      file &&
      (!file.type.startsWith("audio/") ||
        file.client_id !== client.id ||
        file.duration > 61)
    )
      throw Object.assign(new Error(t('Choose this client’s voice recording.')), {
        status: 400,
      });
  }
  const schema = structuredClone(
    existing?.schema || plan.fields.filter((f) => f.enabled),
  );
  // Progress photos are always optional, even when the coach hasn't asked for them;
  // they are then checked like any requested photos below.
  if (!schema.some((f) => f.type === "photos") && Array.isArray(p.answers?.photos) && p.answers.photos.length)
    schema.push({ ...structuredClone(CHECKIN_FIELDS.find((f) => f.id === "photos")), enabled: true, required: false });
  for (const f of schema.filter((f) => f.type === "photos")) {
    const files = p.answers?.[f.id] || [];
    if (!Array.isArray(files) || files.length > 4)
      throw Object.assign(new Error(t('Choose up to four photos.')), {
        status: 400,
      });
    for (const file of files) {
      const record = media(user, file.id);
      if (
        record &&
        (record.client_id !== client.id || !record.type.startsWith("image/"))
      )
        throw Object.assign(
          new Error(t('Choose this client’s progress photos.')),
          { status: 400 },
        );
    }
  }
  const row = {
    id: p.id || newId(),
    clientId: client.id,
    date: today,
    periodDate,
    schema,
    answers: p.answers || {},
    audio: p.audio || null,
    updateText: String(p.updateText || "").slice(0, 2000),
    transcript: String(p.transcript || "").slice(0, 6000),
    transcriptSource: p.transcriptSource || null,
    reviewed: false,
  };
  saveCheckin(data, client, row);
  const saved = data.checkins.find((r) => r.id === row.id);
  saved.summary = checkinSummary(data, saved);
  memory(
    data,
    client.id,
    "checkin",
    existing ? "Check-in corrected" : "Check-in submitted",
    `For ${periodDate} · ${saved.audio ? "Voice" : "Written"} update`,
    { by: user.role, actorId: user.id, recordId: row.id, visibility: "client" },
  );
  for (const n of data.notifications.filter(
    (n) =>
      n.kind === "checkin-reminder" &&
      n.clientId === client.id &&
      n.periodDate <= periodDate,
  ))
    n.resolved = true;
}
export function reviewCheckin(data, user, client, p, media) {
  const row = data.checkins.find(
    (r) => r.id === p.id && r.clientId === client.id,
  );
  if (!row)
    throw Object.assign(new Error(t('Check-in not found.')), { status: 404 });
  if (p.audio) {
    const file = media(user, p.audio.id);
    if (
      file &&
      (!file.type.startsWith("audio/") ||
        file.client_id !== client.id ||
        file.duration > 61)
    )
      throw Object.assign(
        new Error(t('Choose this client’s feedback recording.')),
        { status: 400 },
      );
  }
  row.reviewed = true;
  row.reviewedAt = new Date().toISOString();
  row.response = String(p.response || "")
    .trim()
    .slice(0, 4000);
  row.responseAudio = p.audio || null;
  row.followUp = Boolean(p.followUp);
  memory(
    data,
    client.id,
    "checkin-review",
    "Check-in reviewed",
    p.privateNote
      ? String(p.privateNote).slice(0, 2000)
      : "Reviewed the client’s submission.",
    {
      actorId: user.id,
      recordId: row.id,
      explanation: row.response || t('Your coach reviewed your check-in.'),
    },
  );
  if (row.response || row.responseAudio)
    data.messages.push({
      id: newId(),
      clientId: client.id,
      from: "coach",
      text: row.response || t('Voice feedback on your check-in'),
      audio: row.responseAudio,
      context: `Check-in · ${row.date}`,
      at: new Date().toISOString(),
      read: false,
    });
}
export function reminderDue(client, rows, now = new Date()) {
  const plan = checkinPlanFor(client);
  if (plan.reminders === false || client.paused) return null;
  const timezone = plan.timezone || "UTC";
  if (!validTimezone(timezone)) return null;
  const today = zonedDay(timezone, now),
    schedule = checkinSchedule(client, rows, today);
  if (!schedule.due) return null;
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return clock >= (plan.reminderTime || "18:00")
    ? { periodDate: schedule.dueDate, timezone }
    : null;
}
