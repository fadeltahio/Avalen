// The server's shared context: one place that builds the database connection, the
// payment and wearable services, and the handful of primitives every route needs
// (reading the signed-in user, committing a workspace change, finding a media file).
// Route modules receive this context instead of reaching for globals, so a route's
// dependencies are visible in its own file and it can be tested by building a small
// fake context rather than a whole running server.
import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { openStore } from "./store/index.js";
import { changedAreas } from "./store/workspaces.js";
import { openFiles } from "./files/index.js";
import { coachCodes } from "./coach-codes.js";
import { fail, requireClient } from "./permissions.js";
import { paymobService } from "./paymob.js";
import { wearableService } from "./wearables.js";
import { foundations, recordChanges, memory } from "../src/avalen/ecosystem/memory.js";
import { createWorkspace, newClient } from "../src/avalen/seed.js";
import { projection } from "./permissions.js";
import { hash, token, passwordHash, checkPassword } from "./crypto-utils.js";
import { emailService } from "./email.js";

export async function createContext({
  root = resolve(process.env.AVALEN_DATA_DIR || ".avalen-data"),
  databaseUrl = process.env.DATABASE_URL,
  setupToken = process.env.AVALEN_SETUP_TOKEN,
  // Production never falls back to SQLite or local files, and cookies are HTTPS-only.
  production = process.env.NODE_ENV === "production",
  secure = process.env.AVALEN_SECURE_COOKIE === "true" || (production && process.env.AVALEN_SECURE_COOKIE !== "false"),
  poolMax = Number(process.env.AVALEN_DB_POOL_MAX) || undefined,
  dist = resolve("dist"),
  fetchImpl = globalThis.fetch,
  publicUrl = process.env.AVALEN_PUBLIC_URL,
  coachSignup = process.env.AVALEN_COACH_SIGNUP !== "off",
  trustProxy = process.env.AVALEN_TRUST_PROXY === "true",
  clientIpHeader = process.env.AVALEN_CLIENT_IP_HEADER?.toLowerCase(),
  secretsKey,
  wearableEnv = process.env,
  fileEnv = process.env,
  emailEnv = process.env,
} = {}) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const store = await openStore(root, { databaseUrl, production, poolMax }),
    mediaRoot = join(root, "media"),
    files = openFiles({ mediaRoot, env: fileEnv, production });
  const paymob = paymobService({ store, root, fetchImpl, publicUrl, secretsKey });
  const wearables = wearableService({ store, root, fetchImpl, publicUrl, secretsKey, env: wearableEnv });
  const email = emailService({ env: emailEnv, fetchImpl });
  const bootstrap = setupToken || token(),
    attempts = new Map(),
    codes = coachCodes(store);
  let commandHandler = null;

  // A client added to a workspace today: dated from today, with a 12-week programme.
  const freshClient = (name, email) => {
    const client = newClient(name.trim().slice(0, 100), email);
    client.created = new Date().toISOString().slice(0, 10);
    client.schedule = client.schedule.filter((s) => s.date >= client.created);
    client.programEnd = new Date(Date.now() + 83 * 86400000).toISOString().slice(0, 10);
    return client;
  };
  // A new coach workspace with no demo records.
  const emptyWorkspace = (coachName) => {
    const data = createWorkspace();
    for (const key of Object.keys(data))
      if (Array.isArray(data[key]) && !["library", "templates", "savedReplies"].includes(key)) data[key] = [];
    data.demo = false;
    data.onboarded = true;
    data.coach = { name: coachName.trim().slice(0, 100), brand: "Avalen", logo: null };
    return data;
  };
  const insertUser = (user) => store.users.insert(user);
  const emailTaken = (email) => store.users.emailTaken(email);

  const load = async (user, { lock = false } = {}) => {
    if (!user.workspace_id) fail(409, "You’re not connected to a coach. Join one with their coach code.");
    const row = await (lock ? store.workspaces.getForUpdate : store.workspaces.get)(user.workspace_id);
    if (!row) fail(404, "Workspace not found.");
    return { data: foundations(row.data), revision: row.revision };
  };
  const loadProjected = async (user) => {
    if (user.role === "client" && !user.workspace_id) return coachlessView(user);
    const state = await load(user);
    return { ...state, data: projection(state.data, user) };
  };
  // A client between coaches: their profile as their last coach had it and how much
  // history their account holds. The history itself comes from /api/account/export.
  async function coachlessView(user) {
    const past = await store.relationships.forPerson(user.id);
    const last = past.at(-1);
    const profile = last ? await store.records.clientRecord(last.workspace_id, last.client_id) : null;
    const data = foundations(emptyWorkspace(""));
    data.clients = profile ? [{ ...profile, paused: true }] : [];
    data.activeClientId = profile?.id ?? null;
    const own = await store.records.forPerson(user.id);
    data.coachless = {
      since: last?.ended_at ?? null,
      kept: {
        workouts: (await store.workouts.forPerson(user.id)).length,
        foodLogs: own.foodLogs?.length ?? 0,
        measurements: own.measurements?.length ?? 0,
        checkins: own.checkins?.length ?? 0,
        photos: own.photos?.length ?? 0,
      },
    };
    return { data, revision: 0 };
  }
  // Applies fn to the latest workspace inside one transaction. fn may be async; it also
  // receives a file lookup that answers without waiting, for code shared with the app.
  function commit(user, revision, fn, key) {
    return store.transaction(async () => {
      const current = await load(user, { lock: true });
      if (key && (await store.requests.seen(user.id, key))) return { data: projection(current.data, user), revision: current.revision };
      if (revision !== undefined && revision !== current.revision)
        fail(409, "Your workspace changed elsewhere. Reload and review before saving.");
      const files = await mediaLookup(user, current.data);
      const before = structuredClone(current.data);
      const result = (await fn(current.data, files)) || current.data;
      recordChanges(before, result, { id: user.id, role: user.role });
      result.updatedAt = new Date().toISOString();
      await store.workspaces.save(user.workspace_id, result, { changed: changedAreas(before, result) });
      if (key) await store.requests.record(user.id, key, { revision: current.revision + 1 });
      return { data: projection(result, user), revision: current.revision + 1 };
    });
  }

  async function session(req) {
    const value = /\bavalen_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    if (!value) return null;
    return store.sessions.userFor(hash(value), Date.now());
  }
  async function login(res, user) {
    const value = token(),
      csrf = token();
    await store.sessions.create(hash(value), user.id, csrf, Date.now() + 7 * 86400000);
    res.setHeader(
      "Set-Cookie",
      `avalen_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure ? "; Secure" : ""}`,
    );
    return {
      user: { id: user.id, email: user.email, role: user.role, clientId: user.client_id },
      csrf,
      ...(await loadProjected(user)),
    };
  }
  function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", "avalen_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  }
  async function authenticate(req) {
    const user = await session(req);
    if (!user) fail(401, "Sign in to continue.");
    if (!["GET", "HEAD"].includes(req.method) && req.headers["x-csrf-token"] !== user.csrf)
      fail(403, "Refresh the page before trying again.");
    return user;
  }
  // Behind a hosting proxy every request arrives from the proxy's address. Only when
  // told the proxy is trusted do we read the client address it passes along: either a
  // single-value header the host sets, or the last X-Forwarded-For entry (the one the
  // proxy itself appended; earlier entries can be forged by the client).
  function clientIp(req) {
    if (clientIpHeader) {
      const value = req.headers[clientIpHeader];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    if (trustProxy) {
      const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").map((v) => v.trim()).filter(Boolean);
      if (forwarded.length) return forwarded.at(-1);
    }
    return req.socket.remoteAddress;
  }
  // A simple per-IP, per-action rate limit: 15 attempts per 15-minute window.
  function limit(req, key) {
    const id = `${clientIp(req)}:${key}`,
      now = Date.now();
    const item = attempts.get(id) || { n: 0, until: now + 900000 };
    if (item.until < now) {
      item.n = 0;
      item.until = now + 900000;
    }
    item.n++;
    attempts.set(id, item);
    if (item.n > 15) fail(429, "Too many attempts. Try again in 15 minutes.");
    if (attempts.size > 10000)
      for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  }
  const account = (data) => {
    if (
      typeof data.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
      data.email.length > 254 ||
      typeof data.password !== "string" ||
      data.password.length < 12 ||
      data.password.length > 200
    )
      fail(400, "Use a valid email and a password with 12–200 characters.");
    return data.email.trim().toLowerCase();
  };
  // The rule for who may use a stored file: it must be live and unexpired, and either
  // shared across the workspace, granted to this client, or about a client this user may see.
  function checkMedia(user, row, data, granted) {
    if (!row || Date.parse(row.expires_at) < Date.now()) fail(404, "This recording is no longer available.");
    if (row.client_id !== "workspace" && !(user.role === "client" && granted)) {
      requireClient(user, data, row.client_id);
      // A client who left took what they uploaded; the former coach keeps only their own files.
      if (user.role === "coach" && row.owner_id !== user.id && data.clients.find((c) => c.id === row.client_id)?.leftAt)
        fail(404, "This recording is no longer available.");
    }
    return row;
  }
  async function permittedMedia(user, id) {
    // A client between coaches can still open the files that were theirs with earlier coaches.
    if (!user.workspace_id) {
      const row = user.role === "client" ? await store.media.get(id) : null;
      const theirs = row && !row.deleted && (await store.relationships.forPerson(user.id)).some((r) => r.workspace_id === row.workspace_id && r.client_id === row.client_id);
      if (!theirs || Date.parse(row.expires_at) < Date.now()) fail(404, "This recording is no longer available.");
      return row;
    }
    const row = await store.media.live(id, user.workspace_id);
    if (!row) return checkMedia(user, row);
    const granted = user.role === "client" && (await store.media.hasGrant(row.id, user.client_id));
    return checkMedia(user, row, row.client_id === "workspace" || granted ? null : (await load(user)).data, granted);
  }
  // The same rule, answered without waiting, from the workspace's file records loaded up front.
  async function mediaLookup(user, data) {
    const { rows, grants } = await store.media.index(user.workspace_id);
    return {
      permitted: (u, id) => {
        const row = rows.get(id);
        return checkMedia(u, row, data, Boolean(row) && u.role === "client" && grants.has(`${row.id}|${u.client_id}`));
      },
      granted: (mediaId, clientId) => grants.has(`${mediaId}|${clientId}`),
    };
  }

  return {
    store, db: store.db, files, root, mediaRoot, dist, paymob, wearables, email, codes, bootstrap, secure, production, coachSignup,
    hash, token, passwordHash, checkPassword,
    account, limit, session, login, clearSessionCookie, authenticate,
    load, loadProjected, coachlessView, commit, permittedMedia, mediaLookup,
    insertUser, emailTaken, freshClient, emptyWorkspace,
    randomUUID, transaction: store.transaction, memory, foundations,
    getCommandHandler: () => commandHandler,
    setCommandHandler: (fn) => (commandHandler = fn),
  };
}
