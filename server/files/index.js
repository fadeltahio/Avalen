// Where the bytes of uploaded photos, videos, voice notes and PDFs live. Two
// implementations with one interface:
//   put(id, bytes)            store a file
//   read(id)                  the whole file as a Buffer, or null if missing
//   stream(id, start, end)    a readable stream of an inclusive byte range, or null
//   remove(id)                delete it (no error if already gone)
// Records about files (owner, type, size, who may see them) stay in the database.
import { accessSync, constants, createReadStream, existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";

export function localFiles(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = (id) => join(dir, id);
  return {
    kind: "local",
    // For the health check: the folder exists and the server can write to it.
    check: async () => accessSync(dir, constants.W_OK),
    put: async (id, bytes) => writeFileSync(path(id), bytes, { mode: 0o600 }),
    read: async (id) => (existsSync(path(id)) ? readFileSync(path(id)) : null),
    stream: async (id, start, end) => (existsSync(path(id)) ? createReadStream(path(id), { start, end }) : null),
    remove: async (id) => {
      if (existsSync(path(id))) unlinkSync(path(id));
    },
  };
}

// Cloudflare R2 (or any S3-compatible store) in a private bucket. Files are only ever
// read through the server after its permission check; nothing in the bucket is public.
export function r2Files({ endpoint, bucket, accessKeyId, secretAccessKey, fetchImpl = globalThis.fetch }) {
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const base = `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}`;
  const url = (id) => `${base}/${encodeURIComponent(id)}`;
  const send = async (id, init, label) => {
    const request = await client.sign(url(id), init);
    let response;
    try {
      response = await fetchImpl(request);
    } catch (e) {
      throw new Error(`File storage could not be reached (${label}): ${e.message}`);
    }
    return response;
  };
  return {
    kind: "r2",
    // For the health check: a signed lookup of a key that never exists. 404 means the
    // bucket is reachable and the credentials work; 403 means they don't.
    async check() {
      const request = await client.sign(url("avalen-health-check"), { method: "HEAD" });
      let response;
      try {
        response = await fetchImpl(request, { signal: AbortSignal.timeout(3000) });
      } catch (e) {
        throw new Error(`File storage could not be reached: ${e.message}`);
      }
      if (response.status !== 404 && !response.ok) throw new Error(`File storage refused the check (${response.status}).`);
    },
    async put(id, bytes) {
      // The content hash is part of the signature, so storage rejects bytes changed in transit.
      const hash = createHash("sha256").update(bytes).digest("hex");
      const response = await send(id, { method: "PUT", body: bytes, headers: { "Content-Type": "application/octet-stream", "X-Amz-Content-Sha256": hash } }, "upload");
      if (!response.ok) throw new Error(`File storage refused the upload (${response.status}).`);
    },
    async read(id) {
      const response = await send(id, { method: "GET" }, "read");
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`File storage could not read the file (${response.status}).`);
      return Buffer.from(await response.arrayBuffer());
    },
    async stream(id, start, end) {
      const response = await send(id, { method: "GET", headers: { Range: `bytes=${start}-${end}` } }, "read");
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`File storage could not read the file (${response.status}).`);
      return Readable.fromWeb(response.body);
    },
    async remove(id) {
      const response = await send(id, { method: "DELETE" }, "delete");
      if (!response.ok && response.status !== 404) throw new Error(`File storage could not delete the file (${response.status}).`);
    },
  };
}

// R2 when its bucket is configured, otherwise the data folder's media directory. In
// production there is no fallback to the local folder.
export function openFiles({ mediaRoot, env = process.env, production = false }) {
  if (!env.AVALEN_R2_BUCKET) {
    if (production) throw new Error("Private file storage is required in production: set AVALEN_R2_BUCKET and its credentials.");
    return localFiles(mediaRoot);
  }
  for (const key of ["AVALEN_R2_ENDPOINT", "AVALEN_R2_ACCESS_KEY_ID", "AVALEN_R2_SECRET_ACCESS_KEY"])
    if (!env[key]) throw new Error(`${key} is required when AVALEN_R2_BUCKET is set.`);
  return r2Files({
    endpoint: env.AVALEN_R2_ENDPOINT,
    bucket: env.AVALEN_R2_BUCKET,
    accessKeyId: env.AVALEN_R2_ACCESS_KEY_ID,
    secretAccessKey: env.AVALEN_R2_SECRET_ACCESS_KEY,
  });
}
