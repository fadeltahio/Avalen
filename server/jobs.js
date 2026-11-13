import { randomUUID } from "node:crypto";
import { readFileSync, existsSync, unlinkSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { foundations, newId } from "../src/avalen/ecosystem/memory.js";
import { reminderDue } from "../src/avalen/ecosystem/checkin-service.js";
export function queueTranscription(service, user, clientId, mediaId) {
  const id = `transcript:${mediaId}`,
    payload = {
      clientId,
      mediaId,
      userId: user.id,
      consentAt: new Date().toISOString(),
    };
  service.db
    .prepare(
      "INSERT OR IGNORE INTO jobs(id,workspace_id,kind,record_id,run_at,payload) VALUES(?,?,'transcription',?,?,?)",
    )
    .run(id, user.workspace_id, mediaId, Date.now(), JSON.stringify(payload));
  return { id };
}
export function jobFor(service, user, id) {
  const row = service.db
    .prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?")
    .get(id, user.workspace_id);
  if (!row) return null;
  const payload = JSON.parse(row.payload);
  if (user.role === "client" && payload.clientId !== user.client_id)
    return null;
  return {
    id: row.id,
    state: row.state,
    attempts: row.attempts,
    error: row.error,
    result: payload.result || null,
    clientId: payload.clientId,
  };
}
export async function runJobs(service, { now = new Date() } = {}) {
  const { db } = service;
  for (const row of db.prepare("SELECT * FROM workspaces").all()) {
    const data = foundations(JSON.parse(row.data));
    let changed = false;
    for (const client of data.clients) {
      const due = reminderDue(client, data.checkins, now);
      if (!due) continue;
      const id = `checkin:${client.id}:${due.periodDate}`;
      if (!data.notifications.some((n) => n.id === id)) {
        data.notifications.push({
          id,
          clientId: client.id,
          periodDate: due.periodDate,
          kind: "checkin-reminder",
          text: `Your check-in for ${due.periodDate} is ready. A short update helps your coach plan your next step.`,
          at: now.toISOString(),
          read: false,
          delivery: "in-app",
          timezone: due.timezone,
        });
        changed = true;
      }
    }
    if (changed)
      db.prepare(
        "UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?",
      ).run(JSON.stringify(data), row.id);
  }
  const jobs = db
    .prepare(
      "SELECT * FROM jobs WHERE state IN ('pending','retry') AND run_at<=? ORDER BY run_at LIMIT 4",
    )
    .all(now.getTime());
  for (const job of jobs) {
    const claimed = db
      .prepare(
        "UPDATE jobs SET state='running',attempts=attempts+1 WHERE id=? AND state IN ('pending','retry')",
      )
      .run(job.id);
    if (!claimed.changes) continue;
    const payload = JSON.parse(job.payload);
    try {
      if (job.kind !== "transcription")
        throw new Error("Unsupported processing task.");
      if (!process.env.AVALEN_TRANSCRIPTION_URL)
        throw new Error(
          "No transcription provider is configured. Your coach can listen to the recording.",
        );
      const media = db
        .prepare(
          "SELECT * FROM media WHERE id=? AND workspace_id=? AND deleted=0",
        )
        .get(payload.mediaId, job.workspace_id);
      if (!media || Date.parse(media.expires_at) <= Date.now())
        throw new Error("This recording is no longer available.");
      const endpoint = new URL(process.env.AVALEN_TRANSCRIPTION_URL);
      if (
        endpoint.protocol !== "https:" &&
        !["127.0.0.1", "localhost"].includes(endpoint.hostname)
      )
        throw new Error("The transcription provider must use HTTPS.");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.AVALEN_TRANSCRIPTION_TOKEN
            ? {
                Authorization: `Bearer ${process.env.AVALEN_TRANSCRIPTION_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify({
          audio: readFileSync(join(service.root, "media", media.id)).toString(
            "base64",
          ),
          mimeType: media.type,
          language: null,
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok)
        throw new Error(
          "Transcription provider could not process this recording.",
        );
      const result = await response.json();
      if (
        typeof result.text !== "string" ||
        !result.text.trim() ||
        result.text.length > 12000
      )
        throw new Error("The provider returned no usable transcript.");
      if (
        !db
          .prepare("SELECT id FROM media WHERE id=? AND deleted=0")
          .get(media.id)
      )
        throw new Error("Recording was removed during processing.");
      payload.result = {
        text: result.text,
        source: "configured-provider",
        at: new Date().toISOString(),
      };
      db.prepare(
        "UPDATE jobs SET state='done',payload=?,error=NULL WHERE id=?",
      ).run(JSON.stringify(payload), job.id);
    } catch (e) {
      const attempts = job.attempts + 1,
        state =
          attempts >= 3 || !process.env.AVALEN_TRANSCRIPTION_URL
            ? "failed"
            : "retry";
      db.prepare("UPDATE jobs SET state=?,error=?,run_at=? WHERE id=?").run(
        state,
        e.message.slice(0, 300),
        Date.now() + attempts * 30000,
        job.id,
      );
    }
  }
  for (const media of db
    .prepare("SELECT id FROM media WHERE deleted=0 AND expires_at<=?")
    .all(now.toISOString())) {
    const path = join(service.root, "media", media.id);
    db.prepare("UPDATE media SET deleted=1 WHERE id=?").run(media.id);
    if (existsSync(path)) unlinkSync(path);
  }
  for (const media of db
    .prepare("SELECT id FROM media WHERE deleted=1")
    .all()) {
    const path = join(service.root, "media", media.id);
    if (existsSync(path)) unlinkSync(path);
  }
  db.prepare("DELETE FROM sessions WHERE expires<?").run(now.getTime());
}
// One consistent copy of the database per day in <data>/backups, keeping the newest
// `keep` days. It guards against a bad write or corruption; it lives on the same disk,
// so the host's disk snapshots (or an off-site copy) are still needed for disk loss.
export async function snapshotDatabase(service, { now = new Date(), keep = Number(process.env.AVALEN_BACKUP_DAYS ?? 7) } = {}) {
  if (!(keep > 0)) return null;
  const dir = join(service.root, "backups"), file = join(dir, `avalen-${now.toISOString().slice(0, 10)}.sqlite`);
  if (existsSync(file)) return null;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const partial = `${file}.partial`;
  if (existsSync(partial)) unlinkSync(partial);
  await backup(service.db, partial);
  // The copy inherits write-ahead mode; switch it back so the snapshot is one file.
  const copy = new DatabaseSync(partial);
  copy.exec("PRAGMA journal_mode=DELETE");
  copy.close();
  renameSync(partial, file);
  const copies = readdirSync(dir).filter((f) => /^avalen-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  for (const old of copies.slice(0, Math.max(0, copies.length - keep)))
    for (const path of [old, `${old}-wal`, `${old}-shm`].map((f) => join(dir, f))) if (existsSync(path)) unlinkSync(path);
  return file;
}
export function startWorker(service) {
  service.db
    .prepare("UPDATE jobs SET state='retry',run_at=? WHERE state='running'")
    .run(Date.now());
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runJobs(service);
      if (service.wearables) await service.wearables.runDue();
      await snapshotDatabase(service);
    } catch (e) {
      console.error("Avalen background task failed:", e.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 30000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
