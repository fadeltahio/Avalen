import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "./helpers/service.js";
import { runJobs, queueTranscription, jobFor } from "../server/jobs.js";
test("reminders deduplicate by due period and stop after submission, respecting client local time", async () => {
  const f = await fixture();
  try {
    const workspace = f.db.prepare("SELECT * FROM workspaces").get(),
      data = JSON.parse(workspace.data),
      client = data.clients[0];
    client.checkinPlan = {
      intervalDays: 7,
      startDate: "2026-10-17",
      timezone: "Pacific/Auckland",
      reminderTime: "08:00",
      fields: [],
    };
    f.db
      .prepare("UPDATE workspaces SET data=? WHERE id=?")
      .run(JSON.stringify(data), workspace.id);
    await runJobs(f, { now: new Date("2026-10-16T18:59:00Z") });
    assert.equal(
      f.load({ workspace_id: workspace.id }).data.notifications.length,
      0,
    );
    await runJobs(f, { now: new Date("2026-10-16T19:00:00Z") });
    await runJobs(f, { now: new Date("2026-10-16T19:01:00Z") });
    let saved = f.load({ workspace_id: workspace.id }).data;
    assert.equal(saved.notifications.length, 1);
    saved.checkins.push({
      id: "late",
      clientId: client.id,
      date: "2026-10-17",
      periodDate: "2026-10-17",
    });
    f.db
      .prepare("UPDATE workspaces SET data=? WHERE id=?")
      .run(JSON.stringify(saved), workspace.id);
    await runJobs(f, { now: new Date("2026-10-17T22:00:00Z") });
    assert.equal(
      f.load({ workspace_id: workspace.id }).data.notifications.length,
      1,
    );
  } finally {
    await f.close();
  }
});

test("configured transcription returns real provider text; deleted audio cannot receive a stale result", async () => {
  const f = await fixture(),
    temporary = mkdtempSync(join(tmpdir(), "avalen-audio-")),
    previous = process.env.AVALEN_TRANSCRIPTION_URL;
  let provider;
  try {
    const file = join(temporary, "voice.wav");
    execFileSync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      file,
    ]);
    let received = 0;
    provider = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      assert.ok(input.audio);
      received++;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          text: "A test provider transcript based on the submitted audio.",
        }),
      );
    });
    await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
    process.env.AVALEN_TRANSCRIPTION_URL = `http://127.0.0.1:${provider.address().port}`;
    const clientId = f.coach.data.clients[0].id,
      res = await fetch(f.base + "/api/media", {
        method: "POST",
        headers: {
          "X-Avalen": "1",
          "X-CSRF-Token": f.coach.csrf,
          Cookie: f.coach.cookie,
          "Content-Type": "audio/wav",
          "X-Media-Purpose": "voice",
          "X-Client-Id": clientId,
        },
        body: readFileSync(file),
      }),
      media = await res.json();
    assert.equal(res.status, 200);
    const user = f.db.prepare("SELECT * FROM users WHERE role='coach'").get();
    const job = queueTranscription(f, user, clientId, media.id);
    queueTranscription(f, user, clientId, media.id);
    await runJobs(f);
    const result = jobFor(f, user, job.id);
    assert.equal(result.state, "done");
    assert.equal(received, 1);
    assert.equal(
      result.result.text,
      "A test provider transcript based on the submitted audio.",
    );
    const secondId = "deleted-test";
    f.db
      .prepare(
        "INSERT INTO jobs(id,workspace_id,kind,record_id,run_at,payload) VALUES(?,?,'transcription',?,?,?)",
      )
      .run(
        secondId,
        user.workspace_id,
        media.id,
        Date.now(),
        JSON.stringify({ clientId, mediaId: media.id }),
      );
    f.db.prepare("UPDATE media SET deleted=1 WHERE id=?").run(media.id);
    await runJobs(f);
    assert.notEqual(jobFor(f, user, secondId).state, "done");
    assert.equal(jobFor(f, user, secondId).result, null);
    assert.equal(received, 1);
  } finally {
    if (previous === undefined) delete process.env.AVALEN_TRANSCRIPTION_URL;
    else process.env.AVALEN_TRANSCRIPTION_URL = previous;
    if (provider) await new Promise((resolve) => provider.close(resolve));
    await f.close();
    rmSync(temporary, { recursive: true, force: true });
  }
});
