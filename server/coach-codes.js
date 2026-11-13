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

export function coachCodes(store) {
  const create = async (workspaceId) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = randomCode();
      if (await store.coachCodes.exists(code)) continue;
      await store.coachCodes.insert(code, workspaceId);
      return code;
    }
    throw new Error("Could not create a unique coach code.");
  };
  return {
    // The coach's active code, created the first time it is asked for. The workspace
    // is locked first so two requests at once can't each create one.
    active: (workspaceId) =>
      store.transaction(async () => {
        await store.workspaces.lock(workspaceId);
        return (await store.coachCodes.activeFor(workspaceId)) || create(workspaceId);
      }),
    // Retire the current code and issue a new one.
    replace: (workspaceId) =>
      store.transaction(async () => {
        await store.workspaces.lock(workspaceId);
        await store.coachCodes.retire(workspaceId);
        return create(workspaceId);
      }),
    // The workspace an entered code belongs to, or null.
    find(value) {
      const code = normalizeCode(value);
      if (code.length !== CODE_LENGTH) return null;
      return store.coachCodes.workspaceFor(code);
    },
  };
}
