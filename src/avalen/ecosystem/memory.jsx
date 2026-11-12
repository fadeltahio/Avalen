import { MotionList, MotionDetails } from '../motion.jsx';
import React, { useState } from "react";
import { useApp } from "../context.js";
import { Button, Empty, Field, Modal, Notice, SectionHead } from "../ui.jsx";
import { followUps } from "./memory.js";
function readable(field, value) {
  if (value === null) return "Not configured";
  if (field === "program")
    return `${value.name}\n${value.days.map((d) => `${d.name}\n${d.exercises.map((e) => `  ${e.name}: ${e.sets} × ${e.reps}${e.kind === "Duration" ? " sec" : " reps"} · ${e.weight || 0} kg · ${e.rest}s rest`).join("\n")}`).join("\n\n")}`;
  if (field === "nutrition")
    return `${value.kcal} kcal · ${value.p}g protein · ${value.c}g carbs · ${value.f}g fat\n${(value.meals || []).map((m) => `${m.name}: ${m.description}`).join("\n")}`;
  if (field === "schedule")
    return value.map((s) => `${s.date} · ${s.dayId}`).join("\n");
  return JSON.stringify(value, null, 2);
}
export function CoachingMemory({ clientId, coach = false, compact = false }) {
  const { data, runAction } = useApp();
  const [note, setNote] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState("All");
  const all = data.timeline.filter(
    (e) =>
      e.clientId === clientId &&
      (coach || e.visibility === "client" || e.explanation),
  );
  const rows = all
    .filter((e) => kind === "All" || (e.type || "activity") === kind)
    .sort((a, b) => b.at.localeCompare(a.at));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await runAction("memory.note", clientId, {
        ...f,
        parentId: note?.id,
        share: f.share === "on",
      });
      setNote(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ecosystem-stack">
      <SectionHead
        title={coach ? "Coaching Memory" : "Your coaching updates"}
        action={
          coach ? (
            <Button secondary small onClick={() => setNote({})}>
              Add note
            </Button>
          ) : null
        }
      />
      {!compact && coach && (
        <>
          <p className="muted">
            The decisions, context and plan versions behind each client’s
            progress. Private notes stay with the coach.
          </p>
          <Field label="Event type">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {["All", ...new Set(all.map((e) => e.type || "activity"))].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </Field>
          {followUps(data, clientId).map((f) => (
            <Notice key={f.event.id}>
              <b>Ready for a follow-up</b>
              <p>
                {f.count} sessions completed since {f.event.title.toLowerCase()}
                . First 4 sessions: {f.afterVolume.toLocaleString()} kg volume;
                previous {f.beforeCount} sessions:{" "}
                {f.beforeVolume.toLocaleString()} kg. Different exercises,
                effort and session counts limit comparisons. This does not show
                that the change caused the result.
              </p>
            </Notice>
          ))}
        </>
      )}
      <MotionList className="ecosystem-stack memory-timeline">
      {(compact ? rows.slice(0, 3) : rows).map((event) => (
        <article className="card memory-entry" key={event.id}>
          <small>
            {new Date(event.at).toLocaleString()} · {event.by} ·{" "}
            {coach
              ? event.visibility === "client"
                ? "Shared with client"
                : "Coach only"
              : "Plan update"}
          </small>
          <h3>{event.title}</h3>
          <p>{coach ? event.detail : event.explanation || event.detail}</p>
          {event.objective && (
            <p>
              <b>Review objective:</b> {event.objective}
            </p>
          )}
          {coach && event.field && (
            <MotionDetails>
              <summary>View before and after</summary>
              <div className="memory-compare">
                <div>
                  <h4>Before</h4>
                  <pre>{readable(event.field, event.before)}</pre>
                </div>
                <div>
                  <h4>After</h4>
                  <pre>{readable(event.field, event.after)}</pre>
                </div>
              </div>
            </MotionDetails>
          )}
          {coach && (
            <button className="text-link" onClick={() => setNote(event)}>
              Add reason or follow-up
            </button>
          )}
        </article>
      ))}
      </MotionList>
      {!rows.length && (
        <Empty
          title="A clear history starts here"
          detail="Plan changes and coaching decisions appear here as they happen."
        />
      )}
      {note && (
        <Modal
          title={
            note.id ? "Add decision context" : "A note for the next chapter"
          }
          onClose={() => !busy && setNote(null)}
        >
          <form onSubmit={submit}>
            <Field label="Reason or note">
              <textarea name="reason" required maxLength={4000} />
            </Field>
            <Field
              label="Review objective (optional)"
              name="objective"
              maxLength={300}
              placeholder="e.g. Review after four sessions"
            />
            <label className="checkbox-row">
              <input name="share" type="checkbox" />
              Share this note with the client
            </label>
            <p className="fine-print muted">
              Original decisions remain unchanged. This adds a dated follow-up.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save note"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
