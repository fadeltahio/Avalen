import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  return service.store.jobs
    .enqueue({ id, workspace_id: user.workspace_id, kind: "transcription", record_id: mediaId, run_at: Date.now(), payload })
    .then(() => ({ id }));
}
export async function jobFor(service, user, id) {
  const row = await service.store.jobs.get(id, user.workspace_id);
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
async function readFile(service, id) {
  const bytes = await service.files.read(id);
  if (!bytes) throw new Error("This recording is no longer available.");
  return bytes;
}
export async function runJobs(service, { now = new Date() } = {}) {
  const { store } = service;
  for (const workspaceId of await store.workspaces.ids()) {
    // Re-read under a lock so a coach or client saving at the same moment isn't overwritten.
    await store.transaction(async () => {
      const row = await store.workspaces.getForUpdate(workspaceId);
      if (!row) return;
      const data = foundations(row.data);
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
      if (changed) await store.workspaces.save(row.id, data);
    });
  }
  const jobs = await store.jobs.due(now.getTime(), 4);
  for (const job of jobs) {
    if (!(await store.jobs.claim(job.id))) continue;
    const payload = JSON.parse(job.payload);
    try {
      if (job.kind !== "transcription")
        throw new Error("Unsupported processing task.");
      if (!process.env.AVALEN_TRANSCRIPTION_URL)
        throw new Error(
          "No transcription provider is configured. Your coach can listen to the recording.",
        );
      const media = await store.media.live(payload.mediaId, job.workspace_id);
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
          audio: (await readFile(service, media.id)).toString("base64"),
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
      if (!(await store.media.isLive(media.id)))
        throw new Error("Recording was removed during processing.");
      payload.result = {
        text: result.text,
        source: "configured-provider",
        at: new Date().toISOString(),
      };
      await store.jobs.finish(job.id, payload);
    } catch (e) {
      const attempts = job.attempts + 1,
        state =
          attempts >= 3 || !process.env.AVALEN_TRANSCRIPTION_URL
            ? "failed"
            : "retry";
      await store.jobs.fail(job.id, state, e.message.slice(0, 300), Date.now() + attempts * 30000);
    }
  }
  for (const id of await store.media.expired(now.toISOString())) await store.media.markDeleted(id);
  for (const id of await store.media.awaitingRemoval()) {
    await service.files.remove(id);
    await store.media.markFilesRemoved(id);
  }
  await store.sessions.deleteExpired(now.getTime());
}
// One consistent copy of the database per day in <data>/backups, keeping the newest
// `keep` days. It guards against a bad write or corruption; it lives on the same disk,
// so the host's disk snapshots (or an off-site copy) are still needed for disk loss.
// SQLite only: on PostgreSQL the host's point-in-time recovery and off-site dumps do this.
export async function snapshotDatabase(service, { now = new Date(), keep = Number(process.env.AVALEN_BACKUP_DAYS ?? 7) } = {}) {
  if (!(keep > 0) || service.store.db.dialect !== "sqlite") return null;
  const dir = join(service.root, "backups"), file = join(dir, `avalen-${now.toISOString().slice(0, 10)}.sqlite`);
  if (existsSync(file)) return null;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const partial = `${file}.partial`;
  if (existsSync(partial)) unlinkSync(partial);
  await service.store.db.backupTo(partial);
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
export async function startWorker(service) {
  await service.store.jobs.requeueInterrupted(Date.now());
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
