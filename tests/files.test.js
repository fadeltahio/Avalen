import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { r2Files } from "../server/files/index.js";
import { fixture } from "./helpers/service.js";
import { fakeR2 } from "./helpers/fake-r2.js";

const streamText = async (stream) => {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks).toString();
};

test("R2 storage signs every request and stores, ranges, reads and deletes files", async () => {
  const r2 = await fakeR2();
  try {
    const files = r2Files({ endpoint: r2.endpoint, bucket: "avalen-media", accessKeyId: "test-key", secretAccessKey: "test-secret" });
    await files.put("file-1", Buffer.from("0123456789"));
    assert.equal(r2.objects.get("file-1").toString(), "0123456789");
    assert.equal(await streamText(await files.stream("file-1", 2, 5)), "2345");
    assert.equal((await files.read("file-1")).toString(), "0123456789");
    assert.equal(await files.stream("missing", 0, 1), null);
    assert.equal(await files.read("missing"), null);
    await files.remove("file-1");
    await files.remove("file-1");
    assert.equal(r2.objects.size, 0);
    const wrongKey = r2Files({ endpoint: r2.endpoint, bucket: "avalen-media", accessKeyId: "other", secretAccessKey: "x" });
    await assert.rejects(wrongKey.put("file-2", Buffer.from("x")), /refused the upload \(403\)/);
  } finally {
    await r2.close();
  }
});

test("with R2 configured, an uploaded photo goes to R2, not the data folder, and is served and deleted through the API", async () => {
  const r2 = await fakeR2();
  const f = await fixture({
    fileEnv: { AVALEN_R2_BUCKET: "avalen-media", AVALEN_R2_ENDPOINT: r2.endpoint, AVALEN_R2_ACCESS_KEY_ID: "test-key", AVALEN_R2_SECRET_ACCESS_KEY: "test-secret" },
  });
  try {
    const { data } = await f.call("/api/workspace", { account: f.coach });
    const clientId = data.clients[0].id;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);
    const upload = await fetch(`${f.base}/api/media`, {
      method: "POST",
      headers: { Cookie: f.coach.cookie, "X-CSRF-Token": f.coach.csrf, "X-Avalen": "1", "Content-Type": "image/png", "X-Client-Id": clientId, "X-File-Name": "progress.png" },
      body: png,
    });
    const media = await upload.json();
    assert.equal(upload.status, 200, JSON.stringify(media));
    assert.ok(r2.objects.has(media.id), "the bytes are in R2");
    assert.equal(existsSync(join(f.root, "media")) ? readdirSync(join(f.root, "media")).length : 0, 0, "nothing was written to the data folder");

    const ranged = await fetch(`${f.base}/api/media/${media.id}`, { headers: { Cookie: f.coach.cookie, Range: "bytes=0-7" } });
    assert.equal(ranged.status, 206);
    assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), png.subarray(0, 8));

    const removed = await fetch(`${f.base}/api/media/${media.id}`, { method: "DELETE", headers: { Cookie: f.coach.cookie, "X-CSRF-Token": f.coach.csrf, "X-Avalen": "1" } });
    assert.equal(removed.status, 200);
    assert.equal(r2.objects.has(media.id), false, "deleting the record removes the bytes from R2");
    const after = await fetch(`${f.base}/api/media/${media.id}`, { headers: { Cookie: f.coach.cookie } });
    assert.equal(after.status, 404);
  } finally {
    await f.close();
    await r2.close();
  }
});
