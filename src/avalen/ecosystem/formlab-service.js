import { memory, newId } from "./memory.js";
function error(message) {
  throw Object.assign(new Error(message), { status: 400 });
}
export function submitForm(data, user, client, p, media) {
  const exercise =
    client.program.days
      .flatMap((d) => d.exercises)
      .find((e) => e.id === p.exerciseId) ||
    data.drafts[client.id]?.exercises?.find((e) => e.id === p.exerciseId);
  if (!exercise) error("Choose an exercise from this client’s programme.");
  if (
    p.sessionId &&
    !data.sessions.some(
      (s) => s.id === p.sessionId && s.clientId === client.id,
    ) &&
    data.drafts[client.id]?.id !== p.sessionId
  )
    error("This workout does not belong to the client.");
  if (
    p.setNumber &&
    (!Number.isInteger(Number(p.setNumber)) ||
      p.setNumber < 1 ||
      p.setNumber > 500)
  )
    error("Choose a valid set number.");
  if (!p.file?.id) error("Upload a video first.");
  const file = media(user, p.file.id);
  if (
    file &&
    (file.client_id !== client.id ||
      !file.type.startsWith("video/") ||
      !file.duration ||
      file.duration > 120)
  )
    error("Choose this client’s video up to 120 seconds.");
  if (
    data.formSubmissions.some(
      (r) =>
        r.clientId === client.id &&
        r.file.id === p.file.id &&
        r.status !== "deleted",
    )
  )
    error("This recording was already submitted.");
  const row = {
    id: newId(),
    clientId: client.id,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    sessionId: p.sessionId || null,
    setNumber: p.setNumber ? Number(p.setNumber) : null,
    file: { ...p.file, duration: file?.duration || p.file.duration },
    comment: String(p.comment || "")
      .trim()
      .slice(0, 2000),
    createdAt: new Date().toISOString(),
    status: "pending",
    reviews: [],
    submittedBy: user.id,
    consentAt: new Date().toISOString(),
  };
  data.formSubmissions.push(row);
  memory(
    data,
    client.id,
    "technique",
    "Technique video submitted",
    `${exercise.name}${row.setNumber ? ` · set ${row.setNumber}` : ""}`,
    { by: user.role, actorId: user.id, recordId: row.id, visibility: "client" },
  );
}
export function reviewForm(data, user, client, p, media) {
  const row = data.formSubmissions.find(
    (r) => r.id === p.id && r.clientId === client.id && r.status !== "deleted",
  );
  if (!row) error("Submission not found.");
  if (!Array.isArray(p.annotations) || p.annotations.length > 100)
    error("Use up to 100 timestamped notes.");
  const duration = row.file.duration;
  for (const a of p.annotations) {
    if (
      !Number.isFinite(a.time) ||
      a.time < 0 ||
      a.time > duration ||
      typeof a.text !== "string" ||
      a.text.length > 2000 ||
      !Array.isArray(a.shapes) ||
      a.shapes.length > 30
    )
      error("A timestamp or note is invalid.");
    if (!a.text.trim() && !a.shapes.length)
      error("Add a comment or drawing to each timestamp.");
    for (const s of a.shapes) {
      if (
        !["arrow", "line", "circle", "highlight"].includes(s.type) ||
        ["x1", "y1", "x2", "y2"].some(
          (k) => !Number.isFinite(s[k]) || s[k] < 0 || s[k] > 1,
        )
      )
        error("Drawing coordinates must be within the video.");
    }
  }
  if (!p.annotations.length && !String(p.feedback || "").trim() && !p.audio)
    error("Add feedback, a timestamped note or a voice explanation.");
  if (p.audio) {
    const file = media(user, p.audio.id);
    if (
      file &&
      (file.client_id !== client.id ||
        !file.type.startsWith("audio/") ||
        file.duration > 61)
    )
      error("Choose this client’s voice recording.");
  }
  const review = {
    id: newId(),
    at: new Date().toISOString(),
    by: user.id,
    feedback: String(p.feedback || "").slice(0, 4000),
    annotations: structuredClone(p.annotations),
    audio: p.audio || null,
  };
  row.reviews.push(review);
  row.status = "reviewed";
  row.reviewedAt = review.at;
  row.viewedAt = null;
  memory(
    data,
    client.id,
    "technique-review",
    `Technique feedback · ${row.exerciseName}`,
    `${review.annotations.length} timestamped notes.`,
    {
      actorId: user.id,
      recordId: row.id,
      explanation: `Your coach reviewed your ${row.exerciseName} video. Open FormLab to view the feedback.`,
    },
  );
}
