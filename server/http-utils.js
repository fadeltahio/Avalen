// Shared HTTP plumbing: reading a request body, serving the built web app's static
// files, and the sentinel a route module returns when a request isn't its own.
import { existsSync, statSync, createReadStream } from "node:fs";
import { resolve, extname } from "node:path";
import { fail } from "./permissions.js";

// Returned by a route handler when the request doesn't match anything it handles,
// so the dispatcher in app.js moves on to the next topic's routes. `undefined` is
// a valid, different outcome: the route matched and already wrote its own response
// (a redirect, a streamed file) with nothing left to JSON-encode.
export const NOT_HANDLED = Symbol("not-handled");

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

export async function body(req, limit = 16 * 1024 * 1024, raw = false) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail(413, "The upload is too large.");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (raw) return bytes;
  try {
    return JSON.parse(bytes.toString() || "{}");
  } catch {
    fail(400, "Invalid JSON.");
  }
}

// Everything that isn't under /api/: the built single-page app and its assets.
// decodeURIComponent throws on malformed input such as "%E0%A4%A"; callers get the
// fallback instead of an unexpected 500.
export function safeDecode(value, fallback = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return fallback;
  }
}

export function serveStatic(url, res, dist) {
  let path;
  try {
    path = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const file = resolve(dist, `.${path}`);
  if (!file.startsWith(dist + "/") || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
  createReadStream(file).pipe(res);
}
