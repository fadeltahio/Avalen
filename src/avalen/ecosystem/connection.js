import { uid } from "../id.js";
export const connectedMode = () => {
  const mode = new URLSearchParams(location.search).get("connected");
  return mode === "0" ? false : mode === "1" || location.port === "5180";
};
let state = null,
  queue = Promise.resolve(),
  pending = 0,
  unsent = null;
const listeners = new Set();
export const hasPendingChanges = () => pending > 0 || Boolean(unsent);
export const connection = () => state;
export const unsavedAction = () => unsent;
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function emit() {
  for (const fn of listeners) fn(state);
}
function stash(value) {
  unsent = value;
  try {
    const key = `avalen.pending.${state.user.id}`;
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {}
  emit();
}
export function acceptConnection(value) {
  const first = !state?.user && value.user;
  state = { ...state, ...value };
  if (first) {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`avalen.pending.${value.user.id}`),
      );
      if (saved?.path && saved?.options) unsent = saved;
    } catch {}
  }
  emit();
}
export async function request(
  path,
  { method = "GET", body, headers = {}, signal } = {},
) {
  const options = {
    method,
    credentials: "same-origin",
    signal,
    cache: "no-store",
    headers: {
      "X-Avalen": "1",
      ...(state?.csrf ? { "X-CSRF-Token": state.csrf } : {}),
      ...(body && !(body instanceof Blob)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body: body instanceof Blob ? body : body ? JSON.stringify(body) : undefined,
  };
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(`/api${path}`, options);
      break;
    } catch {
      if (
        attempt === 0 &&
        !signal?.aborted &&
        (method === "GET" || headers["Idempotency-Key"])
      ) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
      throw new Error(
        "The connection was interrupted. Retry when your connection returns.",
      );
    }
  }
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || "Please try again."), {
      status: response.status,
    });
  return result;
}
function enqueue(run) {
  pending++;
  const result = queue.then(run).finally(() => pending--);
  queue = result.catch(() => {});
  return result;
}
async function sendRetriable(path, options) {
  stash({ path, options, at: new Date().toISOString() });
  try {
    const result = await request(path, options);
    acceptConnection(result);
    stash(null);
    return result;
  } catch (error) {
    if (error.status && error.status < 500) {
      stash(null);
      if (error.status === 409) {
        const fresh = await request("/workspace");
        acceptConnection(fresh);
      }
    } else emit();
    throw error;
  }
}
export function connectedUpdate(fn) {
  return enqueue(async () => {
    if (unsent)
      throw new Error(
        "Resolve the unsaved action before making another change.",
      );
    const next = structuredClone(state.data);
    fn(next);
    return sendRetriable("/workspace", {
      method: "PATCH",
      body: { revision: state.revision, data: next },
      headers: { "Idempotency-Key": uid() },
    });
  });
}
export function connectedCommand(input, key = uid()) {
  return enqueue(async () => {
    if (unsent)
      throw new Error(
        "Resolve the unsaved action before making another change.",
      );
    return sendRetriable("/commands", {
      method: "POST",
      body: { ...input, revision: state.revision },
      headers: { "Idempotency-Key": key },
    });
  });
}
export function retryUnsent() {
  return enqueue(async () => {
    if (!unsent) return;
    const saved = unsent;
    return sendRetriable(saved.path, saved.options);
  });
}
export function discardUnsent() {
  stash(null);
}
export async function refreshConnection() {
  if (pending || unsent) return;
  const result = await request("/workspace");
  acceptConnection(result);
  return result;
}
