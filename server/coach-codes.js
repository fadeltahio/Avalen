// Coach codes: a short code a coach shares so new clients can join their workspace
// from the app. One active code per coach; a new code retires the old one, and
// clients who already joined stay connected.
import { randomInt } from "node:crypto";

// No 0/O, 1/I/L or 5/S, so a code read aloud or from a screenshot is typed correctly.
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789";
export const CODE_LENGTH = 6;

export const normalizeCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const formatCode = (code) => (code ? `${code.slice(0, 3)}-${code.slice(3)}` : "");

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function coachCodes(db) {
  const create = (workspaceId) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = randomCode();
      if (db.prepare("SELECT code FROM coach_codes WHERE code=?").get(code)) continue;
      db.prepare("INSERT INTO coach_codes(code,workspace_id,created_at,active) VALUES(?,?,?,1)").run(code, workspaceId, new Date().toISOString());
      return code;
    }
    throw new Error("Could not create a unique coach code.");
  };
  return {
    // The coach's active code, created the first time it is asked for.
    active(workspaceId) {
      const row = db.prepare("SELECT code FROM coach_codes WHERE workspace_id=? AND active=1").get(workspaceId);
      return row ? row.code : create(workspaceId);
    },
    // Retire the current code and issue a new one.
    replace(workspaceId) {
      db.prepare("UPDATE coach_codes SET active=0 WHERE workspace_id=? AND active=1").run(workspaceId);
      return create(workspaceId);
    },
    // The workspace an entered code belongs to, or null.
    find(value) {
      const code = normalizeCode(value);
      if (code.length !== CODE_LENGTH) return null;
      return db.prepare("SELECT workspace_id FROM coach_codes WHERE code=? AND active=1").get(code)?.workspace_id || null;
    },
  };
}
