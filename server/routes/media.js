// Uploading and serving the private photos, videos, voice notes and PDFs attached
// to check-ins, form reviews and coaching notes. Access is checked by
// ctx.permittedMedia before any byte is served or removed.
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync, statSync, existsSync, unlinkSync, createReadStream } from "node:fs";
import { join } from "node:path";
import { coachOnly, fail, requireClient } from "../permissions.js";
import { NOT_HANDLED, body } from "../http-utils.js";

const exec = promisify(execFile);

export function createMediaRoutes(ctx) {
  const { db, mediaRoot, load, permittedMedia } = ctx;

  return async function handleMediaRoutes(req, res, url, user) {
    if (url.pathname === "/api/media" && req.method === "POST") {
      const clientId = String(req.headers["x-client-id"] || ""),
        current = load(user).data;
      requireClient(user, current, clientId);
      const shared = req.headers["x-media-scope"] === "workspace",
        importId = req.headers["x-import-id"];
      if (shared || importId) coachOnly(user);
      if (importId) {
        if (!/^[a-f0-9-]{20,80}$/.test(importId) || !db.prepare("SELECT id FROM imports WHERE workspace_id=? LIMIT 1").get(user.workspace_id))
          fail(403, "Media import requires an imported workspace.");
        const find = (value) =>
          value &&
          typeof value === "object" &&
          ((value.id === importId && /^(image|audio|video)\//.test(value.type || "")) || Object.values(value).some(find));
        if (!find(current)) fail(400, "This file is not referenced by the imported workspace.");
        const previous = db.prepare("SELECT * FROM media WHERE id=?").get(importId);
        if (previous) {
          if (previous.workspace_id !== user.workspace_id)
            fail(409, "This file ID already belongs to another workspace.");
          return {
            id: previous.id,
            type: previous.type,
            size: previous.size,
            duration: previous.duration,
            name: previous.name,
            expiresAt: previous.expires_at,
          };
        }
      }
      const rawType = String(req.headers["content-type"] || "").split(";")[0];
      const type =
          {
            "audio/x-wav": "audio/wav",
            "audio/wave": "audio/wav",
            "audio/x-m4a": "audio/mp4",
            "image/jpg": "image/jpeg",
          }[rawType] || rawType,
        allowed = [
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "audio/webm",
          "audio/mp4",
          "audio/ogg",
          "audio/wav",
          "audio/mpeg",
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ];
      if (!allowed.includes(type)) fail(415, "Use MP4, MOV, WebM, supported audio, JPEG, PNG or WebP.");
      const purpose = importId ? "import" : req.headers["x-media-purpose"] || "general";
      const bytes = await body(
        req,
        (purpose === "import" || purpose === "formlab" ? 100 : type === "application/pdf" ? 20 : purpose === "voice" ? 12 : 30) * 1024 * 1024,
        true,
      );
      if (!bytes.length) fail(400, "The file is empty.");
      const id = importId || randomUUID(),
        path = join(mediaRoot, id);
      writeFileSync(path, bytes, { mode: 0o600 });
      let duration = null;
      try {
        if (type === "application/pdf") {
          if (bytes.subarray(0, 5).toString() !== "%PDF-") fail(422, "Choose a valid PDF file.");
        } else if (!type.startsWith("image/")) {
          let output;
          try {
            output = await exec(
              process.env.FFPROBE_PATH || "ffprobe",
              ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name", "-of", "json", path],
              { timeout: 15000, maxBuffer: 100000 },
            );
          } catch {
            fail(422, "The recording could not be validated. The service needs ffprobe and a playable recording.");
          }
          const meta = JSON.parse(output.stdout);
          duration = Number(meta.format?.duration);
          const max = purpose === "import" ? 21600 : purpose === "formlab" ? 120 : purpose === "voice" ? 61 : 600;
          if (!Number.isFinite(duration)) {
            try {
              const decoded = await exec(
                process.env.FFMPEG_PATH || "ffmpeg",
                ["-v", "error", "-i", path, "-t", String(max + 1), "-f", "null", "-", "-progress", "pipe:1"],
                { timeout: 30000, maxBuffer: 100000 },
              );
              const times = [...decoded.stdout.matchAll(/out_time_us=(\d+)/g)].map((m) => Number(m[1]) / 1000000);
              duration = times.at(-1);
            } catch {
              fail(422, "The recording could not be decoded. Choose a playable recording.");
            }
          }
          if (
            !Number.isFinite(duration) ||
            duration <= 0 ||
            duration > max ||
            !meta.streams?.some((s) => s.codec_type === (type.startsWith("video") ? "video" : "audio"))
          )
            fail(422, `Choose a playable ${type.startsWith("video") ? "video up to 120 seconds" : "voice recording up to 60 seconds"}.`);
        } else if (
          !(
            (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) ||
            (type === "image/png" && bytes.subarray(1, 4).toString() === "PNG") ||
            (type === "image/webp" && bytes.subarray(8, 12).toString() === "WEBP")
          )
        )
          fail(422, "The image file is not valid.");
        const now = new Date().toISOString(),
          expires = new Date(Date.now() + Number(process.env.AVALEN_MEDIA_RETENTION_DAYS || 365) * 86400000).toISOString();
        db.prepare("INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?,?,0)").run(
          id,
          user.workspace_id,
          shared ? "workspace" : clientId,
          user.id,
          decodeURIComponent(String(req.headers["x-file-name"] || "Recording")).slice(0, 200),
          type,
          bytes.length,
          duration,
          now,
          expires,
        );
        let permitted = [];
        if (importId) {
          try {
            permitted = JSON.parse(req.headers["x-media-clients"] || "[]");
          } catch {
            permitted = [];
          }
          if (Array.isArray(permitted))
            for (const idOfClient of permitted)
              if (current.clients.some((c) => c.id === idOfClient)) db.prepare("INSERT OR IGNORE INTO media_access VALUES(?,?)").run(id, idOfClient);
        }
        let thumbnail = null;
        if (type.startsWith("video/")) {
          const thumbId = randomUUID(),
            thumbPath = join(mediaRoot, thumbId);
          try {
            await exec(
              process.env.FFMPEG_PATH || "ffmpeg",
              ["-y", "-v", "error", "-i", path, "-frames:v", "1", "-vf", "scale=480:-2", "-f", "image2", "-vcodec", "mjpeg", thumbPath],
              { timeout: 20000, maxBuffer: 100000 },
            );
            const size = statSync(thumbPath).size;
            db.prepare("INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?,?,0)").run(
              thumbId,
              user.workspace_id,
              shared ? "workspace" : clientId,
              user.id,
              "Video thumbnail",
              "image/jpeg",
              size,
              null,
              now,
              expires,
            );
            db.prepare("INSERT INTO media_links VALUES(?,?)").run(id, thumbId);
            for (const idOfClient of permitted) db.prepare("INSERT OR IGNORE INTO media_access VALUES(?,?)").run(thumbId, idOfClient);
            thumbnail = { id: thumbId, type: "image/jpeg", size };
          } catch {
            if (existsSync(thumbPath)) unlinkSync(thumbPath);
          }
        }
        return {
          id,
          thumbnail,
          name: decodeURIComponent(String(req.headers["x-file-name"] || "Recording")).slice(0, 200),
          type,
          size: bytes.length,
          duration,
          expiresAt: expires,
        };
      } catch (e) {
        unlinkSync(path);
        throw e;
      }
    }

    const mediaMatch = /^\/api\/media\/([a-f0-9-]+)$/.exec(url.pathname);
    if (mediaMatch) {
      const row = permittedMedia(user, mediaMatch[1]),
        path = join(mediaRoot, row.id);
      if (req.method === "DELETE") {
        if (user.role !== "coach" && row.owner_id !== user.id)
          fail(403, "Only the owner or coach can delete this recording.");
        db.prepare("UPDATE media SET deleted=1 WHERE id=?").run(row.id);
        for (const child of db.prepare("SELECT child_id FROM media_links WHERE parent_id=?").all(row.id)) {
          db.prepare("UPDATE media SET deleted=1 WHERE id=?").run(child.child_id);
          const childPath = join(mediaRoot, child.child_id);
          if (existsSync(childPath)) unlinkSync(childPath);
        }
        if (existsSync(path)) unlinkSync(path);
        return { ok: true };
      }
      if (req.method !== "GET" && req.method !== "HEAD") fail(405, "Method not allowed.");
      if (!existsSync(path)) fail(404, "Recording unavailable.");
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || ""),
        start = range ? Number(range[1]) : 0,
        end = range && range[2] ? Math.min(Number(range[2]), row.size - 1) : row.size - 1;
      if (start > end || start >= row.size) {
        res.writeHead(416, { "Content-Range": `bytes */${row.size}` });
        res.end();
        return;
      }
      res.setHeader("Content-Type", row.type);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", end - start + 1);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="recording${row.type.startsWith("video") ? ".mp4" : row.type.startsWith("audio") ? ".webm" : ".jpg"}"`,
      );
      if (range) res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${row.size}` });
      if (req.method === "HEAD") res.end();
      else createReadStream(path, { start, end }).pipe(res);
      return;
    }

    return NOT_HANDLED;
  };
}
