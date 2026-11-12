import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createService } from "../server/app.js";
import { command } from "../src/avalen/ecosystem/actions.js";
import { fixture } from "./helpers/service.js";
test("real accounts enforce client isolation, immutable memory, CSRF and revision conflicts", async () => {
  const f = await fixture();
  try {
    assert.equal(f.coach.status, 200);
    const clientId = f.coach.data.clients[0].id;
    const invite = await f.call("/api/invitations", {
      method: "POST",
      account: f.coach,
      body: { clientId },
    });
    const client = await f.call("/api/join", {
      method: "POST",
      body: {
        invite: invite.invite,
        email: "client@test.app",
        password: "client-password-123",
      },
    });
    assert.equal(client.status, 200);
    assert.equal(client.data.clients.length, 1);
    assert.equal(
      (
        await f.call("/api/invitations", {
          method: "POST",
          account: client,
          body: { clientId },
        })
      ).status,
      403,
    );
    const forged = structuredClone(client.data);
    forged.clients[0].program.name = "Client override";
    assert.equal(
      (
        await f.call("/api/workspace", {
          method: "PATCH",
          account: client,
          body: { revision: client.revision, data: forged },
        })
      ).status,
      403,
    );
    assert.equal((await f.call("/api/workspace")).status, 401);
    assert.equal(
      (
        await f.call("/api/workspace", {
          method: "PATCH",
          account: f.coach,
          headers: { "X-CSRF-Token": "wrong" },
          body: {},
        })
      ).status,
      403,
    );
    const body = {
      action: "memory.note",
      clientId,
      payload: { reason: "Confidential recovery context" },
      revision: (await f.call("/api/workspace", { account: f.coach })).revision,
    };
    const first = await f.call("/api/commands", {
      method: "POST",
      account: f.coach,
      headers: { "Idempotency-Key": "note-once" },
      body,
    });
    assert.equal(first.status, 200);
    const again = await f.call("/api/commands", {
      method: "POST",
      account: f.coach,
      headers: { "Idempotency-Key": "note-once" },
      body,
    });
    assert.equal(again.revision, first.revision);
    const fresh = await f.call("/api/workspace", { account: client });
    assert.ok(
      !JSON.stringify(fresh.data).includes("Confidential recovery context"),
    );
    assert.equal(
      (
        await f.call("/api/workspace", {
          method: "PATCH",
          account: f.coach,
          body: { revision: 1, data: f.coach.data },
        })
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

test("private video is validated, streamed only to related accounts and deleted with its submission", async () => {
  const f = await fixture();
  let temporary;
  try {
    const { execFileSync } = await import("node:child_process");
    const { readFileSync } = await import("node:fs");
    temporary = mkdtempSync(join(tmpdir(), "avalen-video-"));
    const filename = join(temporary, "test.mp4");
    execFileSync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=160x120:d=1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      filename,
    ]);
    const clientId = f.coach.data.clients[0].id;
    let state = await f.call("/api/workspace", { account: f.coach });
    const second = structuredClone(state.data.clients[0]);
    second.id = "other-client";
    second.name = "Client Two";
    state.data.clients.push(second);
    state = await f.call("/api/workspace", {
      method: "PATCH",
      account: f.coach,
      body: { data: state.data, revision: state.revision },
    });
    assert.equal(state.status, 200);
    const accounts = [];
    for (const [id, email] of [
      [clientId, "one@test.app"],
      [second.id, "two@test.app"],
    ]) {
      const inv = await f.call("/api/invitations", {
        method: "POST",
        account: f.coach,
        body: { clientId: id },
      });
      accounts.push(
        await f.call("/api/join", {
          method: "POST",
          body: { invite: inv.invite, email, password: "client-password-123" },
        }),
      );
    }
    const res = await fetch(f.base + "/api/media", {
      method: "POST",
      headers: {
        "X-Avalen": "1",
        "X-CSRF-Token": accounts[0].csrf,
        Cookie: accounts[0].cookie,
        "Content-Type": "video/mp4",
        "X-Client-Id": clientId,
        "X-File-Name": "test.mp4",
      },
      body: readFileSync(filename),
    });
    const media = await res.json();
    assert.equal(res.status, 200, JSON.stringify(media));
    assert.ok(media.duration > 0);
    assert.ok(media.thumbnail);
    assert.equal((await fetch(f.base + `/api/media/${media.id}`)).status, 401);
    assert.equal(
      (
        await fetch(f.base + `/api/media/${media.id}`, {
          headers: { Cookie: accounts[1].cookie },
        })
      ).status,
      404,
    );
    const ranged = await fetch(f.base + `/api/media/${media.id}`, {
      headers: { Cookie: f.coach.cookie, Range: "bytes=0-10" },
    });
    assert.equal(ranged.status, 206);
    assert.equal((await ranged.arrayBuffer()).byteLength, 11);
    let client = await f.call("/api/workspace", { account: accounts[0] });
    const sent = await f.call("/api/commands", {
      method: "POST",
      account: accounts[0],
      headers: { "Idempotency-Key": "video-submit" },
      body: {
        revision: client.revision,
        action: "form.submit",
        clientId,
        payload: {
          exerciseId: client.data.clients[0].program.days[0].exercises[0].id,
          file: media,
          consent: true,
        },
      },
    });
    assert.equal(sent.status, 200, JSON.stringify(sent));
    const row = sent.data.formSubmissions[0];
    assert.equal(row.status, "pending");
    const coach = await f.call("/api/workspace", { account: f.coach });
    const reviewed = await f.call("/api/commands", {
      method: "POST",
      account: f.coach,
      headers: { "Idempotency-Key": "video-review" },
      body: {
        revision: coach.revision,
        action: "form.review",
        clientId,
        payload: {
          id: row.id,
          feedback: "Control the lowering phase.",
          annotations: [
            {
              id: "note",
              time: 0.5,
              text: "Steady here",
              shapes: [{ type: "arrow", x1: 0.1, y1: 0.2, x2: 0.6, y2: 0.7 }],
            },
          ],
        },
      },
    });
    assert.equal(reviewed.status, 200);
    client = await f.call("/api/workspace", { account: accounts[0] });
    assert.equal(
      client.data.formSubmissions[0].reviews[0].feedback,
      "Control the lowering phase.",
    );
    const removed = await f.call("/api/commands", {
      method: "POST",
      account: accounts[0],
      headers: { "Idempotency-Key": "video-delete" },
      body: {
        revision: client.revision,
        action: "form.delete",
        clientId,
        payload: { id: row.id },
      },
    });
    assert.equal(removed.status, 200);
    assert.equal(
      (
        await fetch(f.base + `/api/media/${media.id}`, {
          headers: { Cookie: f.coach.cookie },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(f.base + `/api/media/${media.thumbnail.id}`, {
          headers: { Cookie: f.coach.cookie },
        })
      ).status,
      404,
    );
  } finally {
    await f.close();
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
});

test("replaying a workspace save after a lost acknowledgement does not duplicate plan changes", async () => {
  const f = await fixture();
  try {
    const data = structuredClone(f.coach.data);
    data.clients[0].nutrition.kcal = 2300;
    const options = {
      method: "PATCH",
      account: f.coach,
      headers: { "Idempotency-Key": "same-save" },
      body: { revision: f.coach.revision, data },
    };
    const first = await f.call("/api/workspace", options);
    assert.equal(first.status, 200);
    const repeated = await f.call("/api/workspace", options);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.revision, first.revision);
    assert.equal(repeated.data.revisions.length, 2);
    assert.equal(
      repeated.data.timeline.filter((e) => e.type === "nutrition").length,
      1,
    );
  } finally {
    await f.close();
  }
});
