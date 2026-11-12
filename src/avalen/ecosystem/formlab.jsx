import React, { useEffect, useRef, useState } from "react";
import { uid } from "../id.js";
import {
  Camera,
  ArrowRight,
  Play,
  Pause,
  Undo2,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { useApp } from "../context.js";
import {
  Button,
  Empty,
  Field,
  Modal,
  Notice,
  SectionHead,
  Tabs,
} from "../ui.jsx";
import { useFile } from "../store.js";
import { connection, request } from "./connection.js";
import { uploadVideo } from "./uploads.js";
import { VoiceRecording, AudioPlayer } from "./recording.jsx";
const stamp = (n) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
function useVideoURL(file) {
  const local = useFile(connection() ? null : file?.id);
  return connection() && file
    ? `/api/media/${encodeURIComponent(file.id)}`
    : local;
}
export function FormLab({
  client,
  coach = false,
  exercise = null,
  sessionId = null,
  setNumber = null,
  compact = false,
}) {
  const { data, runAction, notify, ask } = useApp();
  const [upload, setUpload] = useState(false),
    [selectedId, setSelectedId] = useState(null),
    [filter, setFilter] = useState("All"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState(null);
  const rows = (data.formSubmissions || [])
      .filter(
        (r) =>
          r.clientId === client.id &&
          r.status !== "deleted" &&
          (!exercise || r.exerciseName === exercise.name),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    selected = rows.find((r) => r.id === selectedId);
  async function deleteSubmission() {
    setBusy(true);
    setError("");
    try {
      await runAction("form.delete", client.id, { id: remove.id });
      setRemove(null);
      setSelectedId(null);
      notify?.("Recording deleted");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`ecosystem-stack ${compact ? "formlab-compact" : "card"}`}
    >
      <SectionHead
        title={compact ? "Technique feedback" : "FormLab"}
        action={
          !coach ? (
            <Button small secondary onClick={() => setUpload(true)}>
              <Camera size={16} />
              Send a form video
            </Button>
          ) : null
        }
      />
      {!compact && (
        <p className="muted">
          A closer look at how you move.{" "}
          {coach
            ? "Review technique in context, then leave clear feedback at the moments that matter."
            : "Share a short video with your coach and build your technique over time."}
        </p>
      )}
      {!compact && (
        <Field label="Technique review status">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["All", "Pending review", "Reviewed", "Viewed"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
      )}
      {rows
        .filter(
          (r) =>
            filter === "All" ||
            (filter === "Pending review" && r.status === "pending") ||
            (filter === "Reviewed" && r.status === "reviewed") ||
            (filter === "Viewed" && r.viewedAt),
        )
        .slice(0, compact ? 3 : 100)
        .map((row) => (
          <button
            className="simple-row"
            key={row.id}
            onClick={() => setSelectedId(row.id)}
          >
            <Camera size={19} />
            <span>
              <b>
                {row.exerciseName}
                {row.setNumber ? ` · set ${row.setNumber}` : ""}
              </b>
              <small>
                {new Date(row.createdAt).toLocaleDateString()} ·{" "}
                {row.status === "pending"
                  ? "Waiting for coach review"
                  : row.viewedAt
                    ? "Feedback viewed"
                    : "Feedback ready"}
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
      {!rows.length && !compact && (
        <Empty
          title="Your technique, over time"
          detail="Exercise videos and your coach’s feedback will appear here. Each review stays in your history."
        />
      )}
      {upload && (
        <VideoSubmission
          client={client}
          exercise={exercise}
          sessionId={sessionId}
          setNumber={setNumber}
          onClose={() => setUpload(false)}
        />
      )}
      {selected && (
        <Modal
          title={`${selected.exerciseName} · FormLab`}
          wide
          onClose={() => setSelectedId(null)}
        >
          <FormReview
            key={selected.id}
            submission={selected}
            client={client}
            coach={coach}
          />
          <SectionHead title="Exercise review history" />
          {rows
            .filter(
              (r) =>
                r.exerciseName === selected.exerciseName &&
                r.id !== selected.id,
            )
            .map((r) => (
              <button
                key={r.id}
                className="simple-row"
                onClick={() => setSelectedId(r.id)}
              >
                <span>
                  {new Date(r.createdAt).toLocaleDateString()} · {r.status}
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          <div className="button-row">
            <button
              className="text-link"
              onClick={() => {
                setSelectedId(null);
                ask(
                  `FormLab · ${selected.exerciseName}`,
                  `About my video from ${new Date(selected.createdAt).toLocaleDateString()}`,
                  client.id,
                );
              }}
            >
              <MessageCircle size={15} />
              Discuss this review
            </button>
            <button
              className="text-link red"
              onClick={() => setRemove(selected)}
            >
              <Trash2 size={15} />
              Delete recording
            </button>
          </div>
        </Modal>
      )}
      {remove && (
        <Modal
          title="Delete this recording?"
          onClose={() => !busy && setRemove(null)}
        >
          <p>
            The private video will be deleted. A dated record of the submission
            remains in Coaching Memory.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy} onClick={deleteSubmission}>
            {busy ? "Deleting…" : "Delete recording"}
          </Button>
        </Modal>
      )}
    </section>
  );
}
function VideoSubmission({
  client,
  exercise,
  sessionId,
  setNumber: initialSetNumber,
  onClose,
}) {
  const { runAction, notify } = useApp();
  const [file, setFile] = useState(null),
    [chosen, setChosen] = useState(null),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [consent, setConsent] = useState(false),
    [exerciseId, setExerciseId] = useState(
      exercise?.id || client.program.days[0]?.exercises[0]?.id || "",
    ),
    [number, setNumber] = useState(initialSetNumber || ""),
    [comment, setComment] = useState("");
  const abort = useRef(null),
    url = useVideoURL(file);
  useEffect(() => () => abort.current?.abort(), []);
  async function uploadVideoFile(candidate) {
    setChosen(candidate);
    setError("");
    setUploading(true);
    setProgress(0);
    abort.current = new AbortController();
    try {
      const result = await uploadVideo(
        candidate,
        client.id,
        setProgress,
        abort.current.signal,
      );
      setFile(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (!file || !consent) return;
    setBusy(true);
    setError("");
    try {
      await runAction("form.submit", client.id, {
        exerciseId,
        sessionId,
        setNumber: number,
        comment,
        file,
        consent,
      });
      notify?.("Video sent to your coach");
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Let your coach see the movement"
      onClose={() => {
        if (!busy) {
          abort.current?.abort();
          onClose();
        }
      }}
    >
      <form className="formlab-upload" onSubmit={submit}>
        <p className="muted">
          Up to 2 minutes · 100 MB · MP4, MOV or WebM. Share only the movement
          you want reviewed.
        </p>
        <Field label="Exercise">
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
          >
            {client.program.days.map((d) => (
              <optgroup key={d.id} label={d.name}>
                {d.exercises.map((ex) => (
                  <option value={ex.id} key={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field
          label="Set number (optional)"
          type="number"
          min="1"
          max="500"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        {!file ? (
          <>
            <div className="ecosystem-toolbar">
              <label className="upload-zone">
                <Camera size={22} />
                <b>Record or choose a video</b>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  capture="environment"
                  aria-label="Record or choose exercise video"
                  disabled={uploading}
                  onChange={(e) => {
                    const candidate = e.target.files?.[0];
                    if (candidate) uploadVideoFile(candidate);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploading && (
              <div role="status">
                <progress value={progress} max="100" />
                <small>
                  {progress < 100
                    ? `Uploading ${progress}%`
                    : "Upload received. Validating your recording…"}
                </small>
              </div>
            )}
            {error && chosen && (
              <Button
                secondary
                small
                disabled={uploading}
                onClick={() => uploadVideoFile(chosen)}
              >
                Retry upload
              </Button>
            )}
          </>
        ) : (
          <>
            <video
              src={url || undefined}
              controls
              preload="metadata"
              playsInline
            />
            <p className="fine-print muted">
              {Math.ceil(file.duration)} seconds · Ready to send
              {file.expiresAt
                ? ` · recording retained until ${new Date(file.expiresAt).toLocaleDateString()}`
                : ""}
            </p>
            <Button
              secondary
              small
              disabled={busy}
              onClick={() => setFile(null)}
            >
              Choose another video
            </Button>
          </>
        )}
        <Field label="What should your coach look at? (optional)">
          <textarea
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Is my setup stable on the last rep?"
          />
        </Field>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Share this private recording with my coach for technique review
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button disabled={!file || !consent || busy || uploading} type="submit">
          {busy ? "Sending…" : "Send to coach"}
          <ArrowRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
function Drawing({ shape }) {
  const { x1, y1, x2, y2, type } = shape;
  if (type === "circle")
    return (
      <ellipse
        cx={(x1 + x2) / 2}
        cy={(y1 + y2) / 2}
        rx={Math.max(0.005, Math.abs(x2 - x1) / 2)}
        ry={Math.max(0.005, Math.abs(y2 - y1) / 2)}
        fill="none"
      />
    );
  if (type === "highlight")
    return (
      <rect
        x={Math.min(x1, x2)}
        y={Math.min(y1, y2)}
        width={Math.abs(x2 - x1)}
        height={Math.abs(y2 - y1)}
        fill="#f2cd7433"
      />
    );
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      markerEnd={type === "arrow" ? "url(#form-arrow)" : undefined}
    />
  );
}
function FormReview({ submission, client, coach }) {
  const { runAction, notify } = useApp();
  const video = useRef(null),
    svg = useRef(null),
    start = useRef(null),
    url = useVideoURL(submission.file);
  const [time, setTime] = useState(0),
    [duration, setDuration] = useState(submission.file.duration || 0),
    [ratio, setRatio] = useState(16 / 9),
    [playing, setPlaying] = useState(false),
    [tool, setTool] = useState("arrow"),
    [shapes, setShapes] = useState([]),
    [drawing, setDrawing] = useState(null),
    [text, setText] = useState(""),
    [annotations, setAnnotations] = useState([]),
    [feedback, setFeedback] = useState(""),
    [audio, setAudio] = useState(null),
    [voiceBusy, setVoiceBusy] = useState(false),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewIndex, setReviewIndex] = useState(
      Math.max(0, submission.reviews.length - 1),
    );
  const review = submission.reviews[reviewIndex],
    shown = coach
      ? [...annotations, ...(review?.annotations || [])]
      : review?.annotations || [],
    active = shown.filter(
      (a) => selected === a.id || Math.abs(time - a.time) < 0.65,
    ),
    coords = (e) => {
      const b = svg.current.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
        y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
      };
    };
  function seek(n) {
    if (video.current) {
      video.current.pause();
      video.current.currentTime = Math.max(0, Math.min(duration, n));
      setTime(video.current.currentTime);
    }
  }
  function pointerDown(e) {
    if (!coach) return;
    e.preventDefault();
    video.current?.pause();
    const p = coords(e);
    start.current = p;
    svg.current.setPointerCapture(e.pointerId);
    setDrawing({ type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }
  function pointerMove(e) {
    if (!start.current) return;
    const p = coords(e);
    setDrawing({
      type: tool,
      x1: start.current.x,
      y1: start.current.y,
      x2: p.x,
      y2: p.y,
    });
  }
  function pointerUp(e) {
    if (!start.current) return;
    const p = coords(e),
      shape = {
        type: tool,
        x1: start.current.x,
        y1: start.current.y,
        x2: p.x,
        y2: p.y,
      };
    if (Math.abs(shape.x2 - shape.x1) + Math.abs(shape.y2 - shape.y1) > 0.01)
      setShapes((s) => [...s, shape]);
    start.current = null;
    setDrawing(null);
  }
  async function publish() {
    setBusy(true);
    setError("");
    try {
      const final = [...annotations];
      if (text.trim() || shapes.length)
        final.push({
          id: uid(),
          time: Math.min(duration, Math.round(time * 100) / 100),
          text: text.trim(),
          shapes,
        });
      await runAction("form.review", client.id, {
        id: submission.id,
        annotations: final,
        feedback,
        audio,
      });
      setAnnotations([]);
      setShapes([]);
      setText("");
      setFeedback("");
      setAudio(null);
      setReviewIndex(submission.reviews.length);
      notify?.("Technique feedback shared");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ecosystem-stack">
      <p className="muted">
        {new Date(submission.createdAt).toLocaleString()}
        {submission.setNumber ? ` · Set ${submission.setNumber}` : ""}
      </p>
      {submission.comment && <Notice>{submission.comment}</Notice>}
      <div
        className="annotation-stage"
        style={{
          aspectRatio: ratio,
          width: `min(100%, ${60 * ratio}vh)`,
          margin: "auto",
        }}
      >
        <video
          ref={video}
          src={url || undefined}
          preload="metadata"
          playsInline
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            setRatio(
              e.currentTarget.videoWidth / e.currentTarget.videoHeight ||
                16 / 9,
            );
          }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() =>
            setError(
              "This recording is unavailable, expired or unsupported in this browser.",
            )
          }
          style={{ width: "100%", height: "100%", maxHeight: "none" }}
        />
        <svg
          ref={svg}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className={coach ? "" : "view-only"}
          aria-label={
            coach
              ? "Draw technique annotations on the paused video"
              : "Coach’s technique annotations"
          }
          role="img"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            start.current = null;
            setDrawing(null);
          }}
        >
          <defs>
            <marker
              id="form-arrow"
              markerWidth=".05"
              markerHeight=".05"
              refX=".04"
              refY=".025"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L.05,.025 L0,.05" fill="#f2cd74" />
            </marker>
          </defs>
          <g stroke="#f2cd74" strokeWidth=".006" fill="none">
            {[
              ...active.flatMap((a) => a.shapes),
              ...shapes,
              ...(drawing ? [drawing] : []),
            ].map((s, i) => (
              <Drawing shape={s} key={i} />
            ))}
          </g>
        </svg>
      </div>
      <div className="formlab-timeline">
      <input
        type="range"
        aria-label="Video position"
        min="0"
        max={duration}
        step="0.033333"
        value={Math.min(time, duration)}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <div className="formlab-markers" role="group" aria-label="Feedback moments">{shown.map(a => <button key={a.id} style={{left: `${duration > 0 ? Math.max(0, Math.min(100, a.time / duration * 100)) : 0}%`}} aria-label={`Feedback at ${stamp(a.time)}: ${a.text || 'Technique drawing'}`} aria-pressed={selected === a.id} onClick={() => { seek(a.time); setSelected(a.id); }}/>)}</div>
      </div>
      <div className="formlab-controls">
        <Button
          secondary
          small
          onClick={() =>
            playing
              ? video.current.pause()
              : video.current
                  .play()
                  .catch(() =>
                    setError("Playback could not start. Try another browser."),
                  )
          }
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button secondary small onClick={() => seek(time - 1 / 30)}>
          Previous frame
        </Button>
        <Button secondary small onClick={() => seek(time + 1 / 30)}>
          Next frame
        </Button>
        <span className="record-time">
          {stamp(time)} / {stamp(duration)}
        </span>
        <Field label="Playback speed">
          <select
            defaultValue="1"
            onChange={(e) => {
              video.current.playbackRate = Number(e.target.value);
            }}
          >
            {[0.25, 0.5, 0.75, 1, 1.5].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </Field>
      </div>
      {submission.reviews.length > 1 && (
        <Field label="Review version">
          <select
            value={reviewIndex}
            onChange={(e) => setReviewIndex(Number(e.target.value))}
          >
            {submission.reviews.map((r, i) => (
              <option key={r.id} value={i}>
                Review {i + 1} · {new Date(r.at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </Field>
      )}
      {review && (
        <>
          <Notice>
            <b>Coach feedback</b>
            <p>{review.feedback || "See the timestamped notes below."}</p>
          </Notice>
          <AudioPlayer file={review.audio} />
        </>
      )}
      <div className="annotation-list">
        {shown.map((a) => (
          <button
            key={a.id}
            className="annotation-item"
            aria-current={selected === a.id ? true : undefined}
            onClick={() => {
              seek(a.time);
              setSelected(a.id);
            }}
          >
            <time>{stamp(a.time)}</time>
            <span>
              {a.text || "Technique drawing"}
              {a.shapes.length
                ? ` · ${a.shapes.length} drawing${a.shapes.length === 1 ? "" : "s"}`
                : ""}
            </span>
          </button>
        ))}
      </div>
      {coach ? (
        <>
          <SectionHead title="Annotate the moment" />
          <p className="fine-print muted">
            Pause or step through the video, draw on the frame, then add a note.
            Touch and pointer drawing are supported. Timestamped text works with
            a keyboard.
          </p>
          <Tabs
            label="Drawing tool"
            items={["arrow", "line", "circle", "highlight"]}
            value={tool}
            onChange={setTool}
          />
          <Field label={`Comment at ${stamp(time)}`}>
            <textarea
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A clear cue for this exact moment…"
            />
          </Field>
          <div className="button-row">
            <Button
              secondary
              small
              disabled={!text.trim() && !shapes.length}
              onClick={() => {
                setAnnotations((a) => [
                  ...a,
                  {
                    id: uid(),
                    time: Math.min(duration, Math.round(time * 100) / 100),
                    text: text.trim(),
                    shapes,
                  },
                ]);
                setText("");
                setShapes([]);
              }}
            >
              Add timestamped note
            </Button>
            <Button
              secondary
              small
              disabled={!shapes.length}
              onClick={() => setShapes((s) => s.slice(0, -1))}
            >
              <Undo2 size={14} />
              Undo drawing
            </Button>
            <Button
              secondary
              small
              disabled={!annotations.length}
              onClick={() => setAnnotations((a) => a.slice(0, -1))}
            >
              Remove last draft note
            </Button>
          </div>
          <Field label="Overall feedback">
            <textarea
              maxLength={4000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
          <VoiceRecording
            value={audio}
            onBusyChange={setVoiceBusy}
            clientId={client.id}
            onChange={setAudio}
            label="Technique voice feedback"
          />
          <Button disabled={busy || voiceBusy} onClick={publish}>
            {busy ? "Sharing feedback…" : "Share feedback with client"}
          </Button>
          <small className="muted">
            Published reviews remain in history. A follow-up creates a new
            version.
          </small>
        </>
      ) : review && !submission.viewedAt ? (
        <Button
          secondary
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await runAction("form.viewed", client.id, { id: submission.id });
              notify?.("Feedback marked as viewed");
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Mark feedback as viewed
        </Button>
      ) : null}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
