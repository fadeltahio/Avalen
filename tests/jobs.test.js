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
    const [workspace] = await f.store.workspaces.all(),
      data = workspace.data,
      client = data.clients[0];
    client.checkinPlan = {
      intervalDays: 7,
      startDate: "2026-10-17",
      timezone: "Pacific/Auckland",
      reminderTime: "08:00",
      fields: [],
    };
    await f.store.workspaces.save(workspace.id, data);
    await runJobs(f, { now: new Date("2026-10-16T18:59:00Z") });
    assert.equal(
      (await f.load({ workspace_id: workspace.id })).data.notifications.length,
      0,
    );
    await runJobs(f, { now: new Date("2026-10-16T19:00:00Z") });
    await runJobs(f, { now: new Date("2026-10-16T19:01:00Z") });
    let saved = (await f.load({ workspace_id: workspace.id })).data;
    assert.equal(saved.notifications.length, 1);
    saved.checkins.push({
      id: "late",
      clientId: client.id,
      date: "2026-10-17",
      periodDate: "2026-10-17",
    });
    await f.store.workspaces.save(workspace.id, saved);
    await runJobs(f, { now: new Date("2026-10-17T22:00:00Z") });
    assert.equal(
      (await f.load({ workspace_id: workspace.id })).data.notifications.length,
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
    const user = await f.db.get("SELECT * FROM users WHERE role='coach'");
    const job = await queueTranscription(f, user, clientId, media.id);
    await queueTranscription(f, user, clientId, media.id);
    await runJobs(f);
    const result = await jobFor(f, user, job.id);
    assert.equal(result.state, "done");
    assert.equal(received, 1);
    assert.equal(
      result.result.text,
      "A test provider transcript based on the submitted audio.",
    );
    const secondId = "deleted-test";
    await f.store.jobs.enqueue({ id: secondId, workspace_id: user.workspace_id, kind: "transcription", record_id: media.id, run_at: Date.now(), payload: { clientId, mediaId: media.id } });
    await f.store.media.markDeleted(media.id);
    await runJobs(f);
    assert.notEqual((await jobFor(f, user, secondId)).state, "done");
    assert.equal((await jobFor(f, user, secondId)).result, null);
    assert.equal(received, 1);
  } finally {
    if (previous === undefined) delete process.env.AVALEN_TRANSCRIPTION_URL;
    else process.env.AVALEN_TRANSCRIPTION_URL = previous;
    if (provider) await new Promise((resolve) => provider.close(resolve));
    await f.close();
    rmSync(temporary, { recursive: true, force: true });
  }
});
