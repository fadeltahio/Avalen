import { t } from '../i18n.js';
import { uid } from "../id.js";
// The Avalen server. On the web it is the same origin; the iPhone app is built with
// VITE_AVALEN_API_URL (for example https://api.example.com) and always connects to it.
export const API_BASE = (import.meta.env?.VITE_AVALEN_API_URL || "").replace(/\/+$/, "");
export const apiUrl = (path) => `${API_BASE}/api${path}`;
export const nativeApp = () => Boolean(API_BASE);
const credentials = () => (API_BASE ? "include" : "same-origin");
export const connectedMode = () => {
  const mode = new URLSearchParams(location.search).get("connected");
  return mode === "0" ? false : mode === "1" || Boolean(API_BASE) || location.port === "5180";
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
    credentials: credentials(),
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
      response = await fetch(apiUrl(path), options);
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
        t("The connection was interrupted. Retry when your connection returns."),
      );
    }
  }
  // A server that is down or behind a failing proxy can answer without JSON.
  let result = {};
  try { result = await response.json(); }
  catch { if (response.ok) throw new Error(t("The Avalen service sent an unexpected answer. Try again in a moment.")); }
  if (!response.ok)
    // Server messages are English; they are translated here for display.
    throw Object.assign(new Error(t(result.error || (response.status >= 500 ? "The Avalen service isn’t responding. Try again in a moment." : "Please try again."))), {
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
