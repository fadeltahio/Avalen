// The server's shared context: one place that builds the database connection, the
// payment and wearable services, and the handful of primitives every route needs
// (reading the signed-in user, committing a workspace change, finding a media file).
// Route modules receive this context instead of reaching for globals, so a route's
// dependencies are visible in its own file and it can be tested by building a small
// fake context rather than a whole running server.
import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { openDatabase, transaction } from "./database.js";
import { coachCodes } from "./coach-codes.js";
import { fail, requireClient } from "./permissions.js";
import { paymobService } from "./paymob.js";
import { wearableService } from "./wearables.js";
import { foundations, recordChanges, memory } from "../src/avalen/ecosystem/memory.js";
import { createWorkspace, newClient } from "../src/avalen/seed.js";
import { projection } from "./permissions.js";
import { hash, token, passwordHash, checkPassword } from "./crypto-utils.js";

export function createContext({
  root = resolve(process.env.AVALEN_DATA_DIR || ".avalen-data"),
  setupToken = process.env.AVALEN_SETUP_TOKEN,
  secure = process.env.AVALEN_SECURE_COOKIE === "true",
  dist = resolve("dist"),
  fetchImpl = globalThis.fetch,
  publicUrl = process.env.AVALEN_PUBLIC_URL,
  coachSignup = process.env.AVALEN_COACH_SIGNUP !== "off",
  trustProxy = process.env.AVALEN_TRUST_PROXY === "true",
  clientIpHeader = process.env.AVALEN_CLIENT_IP_HEADER?.toLowerCase(),
  secretsKey,
  wearableEnv = process.env,
} = {}) {
  const db = openDatabase(root),
    mediaRoot = join(root, "media");
  const paymob = paymobService({ db, root, fetchImpl, publicUrl, secretsKey });
  const wearables = wearableService({ db, root, fetchImpl, publicUrl, secretsKey, env: wearableEnv });
  mkdirSync(mediaRoot, { recursive: true, mode: 0o700 });
  const bootstrap = setupToken || token(),
    attempts = new Map(),
    codes = coachCodes(db);
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
  const insertUser = (user) =>
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(user.id, user.email, user.password, user.role, user.workspace_id, user.client_id);
  const emailTaken = (email) => Boolean(db.prepare("SELECT id FROM users WHERE email=?").get(email));

  const load = (user) => {
    const row = db.prepare("SELECT * FROM workspaces WHERE id=?").get(user.workspace_id);
    if (!row) fail(404, "Workspace not found.");
    return { data: foundations(JSON.parse(row.data)), revision: row.revision };
  };
  const loadProjected = (user) => {
    const state = load(user);
    return { ...state, data: projection(state.data, user) };
  };
  function commit(user, revision, fn, key) {
    return transaction(db, () => {
      if (key && db.prepare("SELECT key FROM requests WHERE user_id=? AND key=?").get(user.id, key))
        return loadProjected(user);
      const current = load(user);
      if (revision !== undefined && revision !== current.revision)
        fail(409, "Your workspace changed elsewhere. Reload and review before saving.");
      const before = structuredClone(current.data);
      const result = fn(current.data) || current.data;
      recordChanges(before, result, { id: user.id, role: user.role });
      result.updatedAt = new Date().toISOString();
      db.prepare("UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?").run(JSON.stringify(result), user.workspace_id);
      if (key)
        db.prepare("INSERT INTO requests VALUES(?,?,?)").run(user.id, key, JSON.stringify({ revision: current.revision + 1 }));
      return { data: projection(result, user), revision: current.revision + 1 };
    });
  }

  function session(req) {
    const value = /\bavalen_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    if (!value) return null;
    return db
      .prepare("SELECT users.*,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?")
      .get(hash(value), Date.now());
  }
  function login(res, user) {
    const value = token(),
      csrf = token();
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(hash(value), user.id, csrf, Date.now() + 7 * 86400000);
    res.setHeader(
      "Set-Cookie",
      `avalen_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure ? "; Secure" : ""}`,
    );
    return {
      user: { id: user.id, email: user.email, role: user.role, clientId: user.client_id },
      csrf,
      ...loadProjected(user),
    };
  }
  function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", "avalen_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  }
  function authenticate(req) {
    const user = session(req);
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
  function permittedMedia(user, id) {
    const row = db.prepare("SELECT * FROM media WHERE id=? AND workspace_id=? AND deleted=0").get(id, user.workspace_id);
    if (!row || Date.parse(row.expires_at) < Date.now())
      fail(404, "This recording is no longer available.");
    if (
      row.client_id !== "workspace" &&
      !(user.role === "client" && db.prepare("SELECT media_id FROM media_access WHERE media_id=? AND client_id=?").get(row.id, user.client_id))
    )
      requireClient(user, load(user).data, row.client_id);
    return row;
  }

  return {
    db, root, mediaRoot, dist, paymob, wearables, codes, bootstrap, secure, coachSignup,
    hash, token, passwordHash, checkPassword,
    account, limit, session, login, clearSessionCookie, authenticate,
    load, loadProjected, commit, permittedMedia,
    insertUser, emailTaken, freshClient, emptyWorkspace,
    randomUUID, transaction: (fn) => transaction(db, fn), memory, foundations,
    getCommandHandler: () => commandHandler,
    setCommandHandler: (fn) => (commandHandler = fn),
  };
}
