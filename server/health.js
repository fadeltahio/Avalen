// GET /api/health: whether this instance can serve requests. It checks the database
// (a quick query, at most 2 s) and answers 200 or 503, so a host can stop routing to an
// instance or restart it. ?deep=1 also checks file storage; uptime monitors use that,
// while the host's own health check stays on the database alone so a storage outage
// doesn't make the host restart a server that is otherwise fine. Nothing secret or
// personal is returned.
import { log, errorFields } from "./log.js";

const within = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms).unref())]);

export function healthCheck({ db, files }, { env = process.env } = {}) {
  const started = Date.now();
  let storageOkAt = 0;
  return async function health({ deep = false } = {}) {
    const checks = {};
    try {
      await within(db.get("SELECT 1 AS ok"), 2000);
      checks.database = "ok";
    } catch (error) {
      checks.database = "unavailable";
      log("warn", "health check: database unavailable", errorFields(error, { stack: false }));
    }
    if (deep) {
      // A healthy answer is reused for 30 s so frequent monitor checks don't add up; a
      // failure is checked again every time, so recovery shows at once.
      if (Date.now() - storageOkAt > 30000) {
        try {
          await within(files.check(), 3500);
          storageOkAt = Date.now();
        } catch (error) {
          storageOkAt = 0;
          checks.storage = "unavailable";
          log("warn", "health check: file storage unavailable", errorFields(error, { stack: false }));
        }
      }
      checks.storage ??= "ok";
    }
    const ok = Object.values(checks).every((value) => value === "ok");
    return {
      status: ok ? "ok" : "unavailable",
      checks,
      database: db.dialect,
      storage: files.kind,
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
      ...(env.RENDER_GIT_COMMIT ? { release: env.RENDER_GIT_COMMIT.slice(0, 12) } : {}),
    };
  };
}
