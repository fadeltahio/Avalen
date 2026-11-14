// One JSON line per event, so a host's log search and alerts can filter on fields
// (level, msg, status, code). Never pass personal data (emails, names, record contents,
// IP addresses) or secrets in `fields`.
export function log(level, msg, fields = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(`${line}\n`);
}

// The parts of an error that are safe to log: its type, code and message, plus the
// stack for unexpected errors. Database driver `detail` fields can contain row values,
// so they are left out.
export function errorFields(error, { stack = true } = {}) {
  return {
    error: error?.name || "Error",
    ...(error?.code ? { code: String(error.code) } : {}),
    message: String(error?.message || error).slice(0, 500),
    ...(stack && error?.stack ? { stack: String(error.stack).split("\n").slice(0, 8).join("\n") } : {}),
  };
}
