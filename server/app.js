import { validateMediaChanges } from "./media-permissions.js";
import { explainInsight } from "./ai.js";
import { paymobService, settle, validPhone } from "./paymob.js";
import { wearableService } from "./wearables.js";
import { queueTranscription, jobFor } from "./jobs.js";
import http from "node:http";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  existsSync,
  statSync,
  createReadStream,
} from "node:fs";
import { join, resolve, extname } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { openDatabase, transaction } from "./database.js";
import { coachCodes, formatCode } from "./coach-codes.js";
import {
  coachOnly,
  fail,
  requireClient,
  projection,
  mergeEdit,
} from "./permissions.js";
import {
  foundations,
  recordChanges,
  memory,
} from "../src/avalen/ecosystem/memory.js";
import { createWorkspace, newClient } from "../src/avalen/seed.js";
import { removeClientData } from "../src/avalen/account-deletion.js";
import { parseWorkspace } from "../src/avalen/persistence.js";
const exec = promisify(execFile),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const passwordHash = (password) => {
  const salt = token();
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
const checkPassword = (password, stored) => {
  const [salt, value] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(value, "hex"),
  );
};
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
export function createService({
  root = resolve(process.env.AVALEN_DATA_DIR || ".avalen-data"),
  setupToken = process.env.AVALEN_SETUP_TOKEN,
  secure = process.env.AVALEN_SECURE_COOKIE === "true",
  dist = resolve("dist"),
  fetchImpl = globalThis.fetch,
  publicUrl = process.env.AVALEN_PUBLIC_URL,
  coachSignup = process.env.AVALEN_COACH_SIGNUP !== "off",
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
  let commandHandler = null;
  const load = (user) => {
    const row = db
      .prepare("SELECT * FROM workspaces WHERE id=?")
      .get(user.workspace_id);
    if (!row) fail(404, "Workspace not found.");
    return { data: foundations(JSON.parse(row.data)), revision: row.revision };
  };
  function commit(user, revision, fn, key) {
    return transaction(db, () => {
      if (
        key &&
        db
          .prepare("SELECT key FROM requests WHERE user_id=? AND key=?")
          .get(user.id, key)
      )
        return loadProjected(user);
      const current = load(user);
      if (revision !== undefined && revision !== current.revision)
        fail(
          409,
          "Your workspace changed elsewhere. Reload and review before saving.",
        );
      const before = structuredClone(current.data);
      const result = fn(current.data) || current.data;
      recordChanges(before, result, { id: user.id, role: user.role });
      result.updatedAt = new Date().toISOString();
      db.prepare(
        "UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?",
      ).run(JSON.stringify(result), user.workspace_id);
      if (key)
        db.prepare("INSERT INTO requests VALUES(?,?,?)").run(
          user.id,
          key,
          JSON.stringify({ revision: current.revision + 1 }),
        );
      return { data: projection(result, user), revision: current.revision + 1 };
    });
  }
  // Paymob's server-to-server confirmation. Matches the attempt reference to a
  // payment, checks the coach's HMAC signature, then settles exactly once.
  async function paymobCallback(req, url) {
    const input = await body(req, 256 * 1024);
    const obj = input && typeof input === "object" ? input.obj : null;
    const reference = String(obj?.order?.merchant_order_id ?? obj?.merchant_order_id ?? "");
    const paymentId = reference.split(".")[0];
    let found = null;
    if (/^[\w-]{1,100}\.\d{1,3}$/.test(reference))
      for (const row of db.prepare("SELECT id, data FROM workspaces").all()) {
        const payment = (JSON.parse(row.data).payments || []).find(
          (p) => p.id === paymentId && p.paymob?.attempts?.some((a) => a.ref === reference),
        );
        if (payment) { found = { workspace: row.id, payment }; break; }
      }
    if (!found) fail(404, "Unknown payment.");
    if (!paymob.verify(found.workspace, obj, url.searchParams.get("hmac")))
      fail(401, "Invalid signature.");
    const change = settle(found.payment, obj);
    if (!change) return { ok: true };
    commit({ id: "paymob", role: "system", workspace_id: found.workspace }, undefined, (d) => {
      const record = d.payments.find((p) => p.id === paymentId);
      if (!record || record.paymob?.transactionId === change.transactionId) return d;
      if (change.kind === "paid")
        Object.assign(record, {
          status: "paid",
          method: "paymob",
          verified: true,
          paidAt: change.at,
          paymob: { ...record.paymob, transactionId: change.transactionId, orderId: change.orderId, cardLast4: change.cardLast4, previousStatus: change.previousStatus },
        });
      else
        record.paymob = {
          ...record.paymob,
          attempts: record.paymob.attempts.map((a) => (a.ref === reference ? { ...a, [change.kind === "failed" ? "failedAt" : "mismatchAt"]: change.at, transaction: change.transactionId } : a)),
        };
      return d;
    });
    return { ok: true };
  }
  function session(req) {
    const value = /\bavalen_session=([^;]+)/.exec(
      req.headers.cookie || "",
    )?.[1];
    if (!value) return null;
    return db
      .prepare(
        "SELECT users.*,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?",
      )
      .get(hash(value), Date.now());
  }
  function login(res, user) {
    const value = token(),
      csrf = token();
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
      hash(value),
      user.id,
      csrf,
      Date.now() + 7 * 86400000,
    );
    res.setHeader(
      "Set-Cookie",
      `avalen_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure ? "; Secure" : ""}`,
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
      },
      csrf,
      ...loadProjected(user),
    };
  }
  const loadProjected = (user) => {
    const state = load(user);
    return { ...state, data: projection(state.data, user) };
  };
  function authenticate(req) {
    const user = session(req);
    if (!user) fail(401, "Sign in to continue.");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== user.csrf
    )
      fail(403, "Refresh the page before trying again.");
    return user;
  }
  function limit(req, key) {
    const id = `${req.socket.remoteAddress}:${key}`,
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
    const row = db
      .prepare(
        "SELECT * FROM media WHERE id=? AND workspace_id=? AND deleted=0",
      )
      .get(id, user.workspace_id);
    if (!row || Date.parse(row.expires_at) < Date.now())
      fail(404, "This recording is no longer available.");
    if (
      row.client_id !== "workspace" &&
      !(
        user.role === "client" &&
        db
          .prepare(
            "SELECT media_id FROM media_access WHERE media_id=? AND client_id=?",
          )
          .get(row.id, user.client_id)
      )
    )
      requireClient(user, load(user).data, row.client_id);
    return row;
  }
  async function route(req, res) {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    if (!url.pathname.startsWith("/api/")) {
      let file = resolve(
        dist,
        `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
      );
      if (
        !file.startsWith(dist + "/") ||
        !existsSync(file) ||
        !statSync(file).isFile()
      ) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.setHeader(
        "Content-Type",
        mime[extname(file)] || "application/octet-stream",
      );
      createReadStream(file).pipe(res);
      return;
    }
    if (url.pathname === "/api/paymob/callback" && req.method === "POST")
      return paymobCallback(req, url);
    // Wearable OAuth returns arrive from the provider's site, so the SameSite=Strict
    // session cookie is not sent; the single-use state identifies the client.
    const wearableReturn = url.pathname.match(/^\/api\/wearables\/(whoop|google)\/callback$/);
    if (wearableReturn && req.method === "GET") {
      res.writeHead(302, { Location: await wearables.callback(wearableReturn[1], url.searchParams) });
      res.end();
      return;
    }
    if (url.pathname === "/api/wearables/whoop/webhook" && req.method === "POST") {
      wearables.webhook(await body(req, 65536, true), req.headers);
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/api/paymob/return" && req.method === "GET") {
      const id = url.searchParams.get("payment") || "";
      res.writeHead(302, {
        Location: `/#/client/you?tab=Payments${/^[\w-]{1,100}$/.test(id) ? `&returned=${encodeURIComponent(id)}` : ""}`,
      });
      res.end();
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host)
        fail(403, "Cross-site requests are not allowed.");
      if (req.headers["x-avalen"] !== "1")
        fail(403, "Use the Avalen app for this action.");
    }
    if (url.pathname === "/api/status")
      return {
        configured: Boolean(db.prepare("SELECT id FROM users LIMIT 1").get()),
        coachSignup,
        transcription: Boolean(process.env.AVALEN_TRANSCRIPTION_URL),
        ai: Boolean(process.env.AVALEN_AI_URL),
        privateStorage: true,
      };
    if (url.pathname === "/api/session" && req.method === "GET") {
      const user = session(req);
      return user
        ? {
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              clientId: user.client_id,
            },
            csrf: user.csrf,
            ...loadProjected(user),
          }
        : { user: null };
    }
    if (url.pathname === "/api/login" && req.method === "POST") {
      limit(req, "login");
      const data = await body(req, 4096);
      const email = account(data),
        user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
      if (!user || !checkPassword(data.password, user.password))
        fail(401, "Email or password is incorrect.");
      return login(res, user);
    }
    if (url.pathname === "/api/setup" && req.method === "POST") {
      limit(req, "setup");
      const input = await body(req, 8192),
        email = account(input);
      if (db.prepare("SELECT id FROM users LIMIT 1").get())
        fail(409, "This service already has an owner.");
      if (
        typeof input.setupToken !== "string" ||
        hash(input.setupToken) !== hash(bootstrap)
      )
        fail(403, "Use the setup token configured by the service owner.");
      if (
        !String(input.clientName || "").trim() ||
        !String(input.name || "").trim()
      )
        fail(400, "Enter the coach and first client’s names.");
      const data = createWorkspace();
      for (const key of Object.keys(data))
        if (
          Array.isArray(data[key]) &&
          !["library", "templates", "savedReplies"].includes(key)
        )
          data[key] = [];
      data.clients = [newClient(input.clientName.trim().slice(0, 100), "")];
      data.clients[0].created = new Date().toISOString().slice(0, 10);
      data.clients[0].schedule = data.clients[0].schedule.filter(
        (s) => s.date >= data.clients[0].created,
      );
      data.clients[0].programEnd = new Date(Date.now() + 83 * 86400000)
        .toISOString()
        .slice(0, 10);
      data.activeClientId = data.clients[0].id;
      data.demo = false;
      data.onboarded = true;
      data.coach = {
        name: input.name.trim().slice(0, 100),
        brand: "Avalen",
        logo: null,
      };
      foundations(data);
      const user = {
        id: randomUUID(),
        email,
        password: passwordHash(input.password),
        role: "coach",
        workspace_id: randomUUID(),
        client_id: null,
      };
      transaction(db, () => {
        db.prepare("INSERT INTO workspaces(id,data) VALUES(?,?)").run(
          user.workspace_id,
          JSON.stringify(data),
        );
        db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
          user.id,
          email,
          user.password,
          user.role,
          user.workspace_id,
          null,
        );
      });
      return login(res, user);
    }
    // Any coach can create an account: a workspace of their own and a coach code.
    if (url.pathname === "/api/signup/coach" && req.method === "POST") {
      limit(req, "signup");
      if (!coachSignup) fail(403, "Coach sign-up is closed on this service.");
      const input = await body(req, 4096),
        email = account(input),
        name = String(input.name || "").trim();
      if (!name) fail(400, "Enter your name.");
      if (emailTaken(email)) fail(409, "An account with this email already exists. Sign in instead.");
      const data = emptyWorkspace(name);
      data.clients = [];
      data.activeClientId = null;
      foundations(data);
      const user = { id: randomUUID(), email, password: passwordHash(input.password), role: "coach", workspace_id: randomUUID(), client_id: null };
      transaction(db, () => {
        db.prepare("INSERT INTO workspaces(id,data) VALUES(?,?)").run(user.workspace_id, JSON.stringify(data));
        insertUser(user);
        codes.active(user.workspace_id);
      });
      return login(res, user);
    }
    // A client joins a coach with the coach's code and becomes one of their clients.
    if (url.pathname === "/api/signup/client" && req.method === "POST") {
      limit(req, "signup");
      const input = await body(req, 4096),
        email = account(input),
        name = String(input.name || "").trim();
      if (!name) fail(400, "Enter your name.");
      const workspaceId = codes.find(input.code);
      if (!workspaceId) fail(404, "This coach code was not found. Check it with your coach.");
      if (emailTaken(email)) fail(409, "An account with this email already exists. Sign in instead.");
      const user = { id: randomUUID(), email, password: passwordHash(input.password), role: "client", workspace_id: workspaceId, client_id: null };
      transaction(db, () => {
        const row = db.prepare("SELECT data FROM workspaces WHERE id=?").get(workspaceId);
        if (!row) fail(404, "This coach code was not found. Check it with your coach.");
        const data = foundations(JSON.parse(row.data)),
          client = freshClient(name, email);
        data.clients.push(client);
        data.activeClientId ||= client.id;
        memory(data, client.id, "Account", "Joined with your coach code", "", { by: "client" });
        user.client_id = client.id;
        insertUser(user);
        db.prepare("UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?").run(JSON.stringify(data), workspaceId);
      });
      return login(res, user);
    }
    if (url.pathname === "/api/join" && req.method === "POST") {
      limit(req, "join");
      const input = await body(req, 4096),
        email = account(input),
        invite = db
          .prepare(
            "SELECT * FROM invitations WHERE token=? AND used=0 AND expires>?",
          )
          .get(hash(String(input.invite || "")), Date.now());
      if (!invite)
        fail(404, "This invitation has expired or was already used.");
      const user = {
        id: randomUUID(),
        email,
        role: "client",
        workspace_id: invite.workspace_id,
        client_id: invite.client_id,
      };
      transaction(db, () => {
        if (
          db
            .prepare(
              "SELECT id FROM users WHERE workspace_id=? AND client_id=?",
            )
            .get(invite.workspace_id, invite.client_id)
        )
          fail(409, "This client already has an account.");
        db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
          user.id,
          email,
          passwordHash(input.password),
          "client",
          user.workspace_id,
          user.client_id,
        );
        db.prepare("UPDATE invitations SET used=1 WHERE token=?").run(
          invite.token,
        );
        const workspace = db
            .prepare("SELECT data FROM workspaces WHERE id=?")
            .get(user.workspace_id),
          data = JSON.parse(workspace.data),
          client = data.clients.find((c) => c.id === user.client_id);
        if (!client) fail(404, "The invited client is no longer available.");
        client.email = email;
        db.prepare(
          "UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?",
        ).run(JSON.stringify(data), user.workspace_id);
      });
      return login(res, user);
    }
    const user = authenticate(req);
    if (url.pathname === "/api/logout" && req.method === "POST") {
      db.prepare("DELETE FROM sessions WHERE user_id=? AND csrf=?").run(
        user.id,
        user.csrf,
      );
      res.setHeader(
        "Set-Cookie",
        "avalen_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      return { ok: true };
    }
    if (url.pathname === "/api/coach-code" && req.method === "GET") {
      coachOnly(user);
      return { code: formatCode(codes.active(user.workspace_id)) };
    }
    if (url.pathname === "/api/coach-code/replace" && req.method === "POST") {
      coachOnly(user);
      limit(req, "coach-code");
      return { code: formatCode(transaction(db, () => codes.replace(user.workspace_id))) };
    }
    if (url.pathname === "/api/account/delete" && req.method === "POST") {
      limit(req, "account-delete");
      const input = await body(req, 4096);
      if (input.confirm !== "DELETE") fail(400, "Type DELETE to confirm.");
      const stored = db.prepare("SELECT password FROM users WHERE id=?").get(user.id);
      if (typeof input.password !== "string" || !stored || !checkPassword(input.password, stored.password))
        fail(401, "Your password is incorrect.");
      const ws = user.workspace_id, clientId = user.role === "client" ? user.client_id : null;
      await wearables.forget(ws, clientId);
      const mediaRows = clientId
        ? db.prepare("SELECT id FROM media WHERE workspace_id=? AND client_id=?").all(ws, clientId)
        : db.prepare("SELECT id FROM media WHERE workspace_id=?").all(ws);
      const ids = mediaRows.map((r) => r.id);
      const files = [...ids, ...ids.flatMap((id) => db.prepare("SELECT child_id FROM media_links WHERE parent_id=?").all(id).map((r) => r.child_id))];
      transaction(db, () => {
        for (const id of ids) {
          db.prepare("DELETE FROM media_access WHERE media_id=?").run(id);
          db.prepare("DELETE FROM media_links WHERE parent_id=? OR child_id=?").run(id, id);
          db.prepare("DELETE FROM media WHERE id=?").run(id);
        }
        if (clientId) {
          // The client's login and everything about them; the coach keeps an anonymous entry.
          const users = db.prepare("SELECT id FROM users WHERE workspace_id=? AND client_id=?").all(ws, clientId);
          for (const u of users) {
            db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
            db.prepare("DELETE FROM requests WHERE user_id=?").run(u.id);
            db.prepare("DELETE FROM users WHERE id=?").run(u.id);
          }
          db.prepare("DELETE FROM invitations WHERE workspace_id=? AND client_id=?").run(ws, clientId);
          db.prepare("DELETE FROM jobs WHERE workspace_id=? AND json_extract(payload,'$.clientId')=?").run(ws, clientId);
          const row = db.prepare("SELECT data FROM workspaces WHERE id=?").get(ws);
          const data = removeClientData(foundations(JSON.parse(row.data)), clientId);
          data.updatedAt = new Date().toISOString();
          db.prepare("UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?").run(JSON.stringify(data), ws);
        } else {
          // The owner deletes the whole workspace, including every client login.
          for (const u of db.prepare("SELECT id FROM users WHERE workspace_id=?").all(ws)) {
            db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
            db.prepare("DELETE FROM requests WHERE user_id=?").run(u.id);
          }
          for (const table of ["users", "invitations", "coach_codes", "jobs", "imports", "payment_accounts"])
            db.prepare(`DELETE FROM ${table} WHERE workspace_id=?`).run(ws);
          db.prepare("DELETE FROM workspaces WHERE id=?").run(ws);
        }
      });
      for (const id of files) {
        const path = join(mediaRoot, id);
        if (existsSync(path)) unlinkSync(path);
      }
      res.setHeader("Set-Cookie", "avalen_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
      return { deleted: true };
    }
    if (url.pathname === "/api/payments/account") {
      coachOnly(user);
      if (req.method === "GET") return paymob.status(user.workspace_id);
      if (req.method === "PUT")
        return paymob.connect(user.workspace_id, await body(req, 8192));
      if (req.method === "DELETE") return paymob.disconnect(user.workspace_id);
    }
    if (url.pathname.startsWith("/api/wearables/")) {
      const part = url.pathname.slice("/api/wearables/".length).split("/");
      if (part[0] === "status" && req.method === "GET")
        return wearables.status(user, load(user).data);
      if (part[0] === "days" && req.method === "GET")
        return wearables.days(user, load(user).data, url.searchParams.get("clientId") || user.client_id, url.searchParams.get("count"));
      if (part[0] === "summary" && req.method === "GET")
        return wearables.summary(user, load(user).data);
      if (part[0] === "upload" && req.method === "POST") {
        limit(req, "wearable-upload");
        return wearables.upload(user, await body(req, 65536));
      }
      if (part[0] === "sync" && req.method === "POST") {
        limit(req, "wearable-sync");
        const input = await body(req, 4096);
        const clientId = user.role === "client" ? user.client_id : input.clientId;
        requireClient(user, load(user).data, clientId);
        return wearables.sync(user.workspace_id, clientId, input.provider, 14);
      }
      if (part[1] === "connect" && req.method === "POST") {
        limit(req, "wearable-connect");
        return wearables.start(user, part[0]);
      }
      if (part.length === 1 && req.method === "DELETE")
        return wearables.disconnect(user, part[0], { keepHistory: url.searchParams.get("history") !== "delete" });
    }
    const checkout = url.pathname.match(/^\/api\/payments\/([\w-]{1,100})\/checkout$/);
    if (checkout && req.method === "POST") {
      if (user.role !== "client")
        fail(403, "Only the client can pay a payment request.");
      limit(req, "checkout");
      const input = await body(req, 4096);
      const { data } = load(user);
      const payment = data.payments.find((p) => p.id === checkout[1]);
      if (!payment || payment.clientId !== user.client_id)
        fail(404, "This payment request isn’t available.");
      if (payment.status !== "due")
        fail(409, payment.status === "paid" ? "This payment is already paid." : "Your coach cancelled this payment request.");
      const client = data.clients.find((c) => c.id === user.client_id);
      const phone = (typeof input.phone === "string" && input.phone.trim()) || client.phone || "";
      if (!validPhone(phone))
        fail(400, "Add your mobile number. Paymob needs it to process the payment.");
      const attempt = (payment.paymob?.attempts?.length || 0) + 1;
      if (attempt > 20)
        fail(429, "Too many payment attempts for this request. Ask your coach to send a new one.");
      const reference = `${payment.id}.${attempt}`;
      const intention = await paymob.createIntention(user.workspace_id, {
        payment,
        client: { name: client.name, email: client.email || user.email },
        reference,
        phone,
      });
      commit(user, undefined, (d) => {
        const record = d.payments.find((p) => p.id === payment.id);
        record.paymob = {
          ...(record.paymob || {}),
          attempts: [
            ...(record.paymob?.attempts || []),
            { ref: reference, at: new Date().toISOString(), intentionId: intention.intentionId, orderId: intention.orderId },
          ],
        };
        const person = d.clients.find((c) => c.id === user.client_id);
        if (!person.phone) person.phone = phone.trim();
        return d;
      });
      return { url: intention.url };
    }
    if (url.pathname === "/api/workspace" && req.method === "GET")
      return loadProjected(user);
    if (url.pathname === "/api/workspace" && req.method === "PATCH") {
      const input = await body(req);
      if (!Number.isInteger(input.revision))
        fail(400, "Workspace revision is required.");
      const key = req.headers["idempotency-key"];
      if (!key || key.length > 200) fail(400, "A retry key is required.");
      return commit(
        user,
        input.revision,
        (data) => {
          const result = mergeEdit(data, input.data, user);
          validateMediaChanges(
            data,
            result,
            user,
            permittedMedia,
            (id, clientId) =>
              Boolean(
                db
                  .prepare(
                    "SELECT media_id FROM media_access WHERE media_id=? AND client_id=?",
                  )
                  .get(id, clientId),
              ),
          );
          return result;
        },
        key,
      );
    }
    if (url.pathname === "/api/invitations" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req, 4096);
      requireClient(user, load(user).data, input.clientId);
      const value = token();
      db.prepare("INSERT INTO invitations VALUES(?,?,?,?,0)").run(
        hash(value),
        user.workspace_id,
        input.clientId,
        Date.now() + 48 * 3600000,
      );
      return {
        invite: value,
        expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      };
    }
    if (url.pathname === "/api/import" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req),
        imported = parseWorkspace(JSON.stringify(input.data));
      return commit(user, input.revision, (current) => {
        if (
          db
            .prepare(
              "SELECT id FROM users WHERE workspace_id=? AND role='client' LIMIT 1",
            )
            .get(user.workspace_id) ||
          current.sessions.length ||
          current.checkins.length
        )
          fail(
            409,
            "Import is available only before live client activity. Export and merge records with the service owner instead.",
          );
        db.prepare("INSERT INTO imports VALUES(?,?,?,?)").run(
          randomUUID(),
          user.workspace_id,
          JSON.stringify(current),
          new Date().toISOString(),
        );
        for (const client of imported.clients) delete client.externalAIConsent;
        foundations(imported);
        imported.demo = Boolean(imported.demo);
        imported.onboarded = true;
        return imported;
      });
    }
    if (url.pathname === "/api/intelligence/explain" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req, 10000),
        data = load(user).data,
        client = requireClient(user, data, input.clientId);
      return explainInsight(data, client, input);
    }
    if (url.pathname === "/api/transcriptions" && req.method === "POST") {
      const input = await body(req, 4096);
      requireClient(user, load(user).data, input.clientId);
      const media = permittedMedia(user, input.mediaId);
      if (
        user.role === "coach" &&
        media.owner_id !== user.id &&
        !load(user).data.clients.find((c) => c.id === input.clientId)
          ?.externalAIConsent?.enabled
      )
        fail(
          403,
          "The client has not allowed their recording to be sent to an external provider.",
        );
      if (
        media.client_id !== input.clientId ||
        !media.type.startsWith("audio/")
      )
        fail(400, "Choose this client’s audio recording.");
      if (input.consent !== true)
        fail(400, "Transcription requires your permission.");
      if (!process.env.AVALEN_TRANSCRIPTION_URL)
        fail(
          503,
          "No transcription provider is connected. Your coach can listen to the original recording.",
        );
      return queueTranscription({ db }, user, input.clientId, input.mediaId);
    }
    if (url.pathname.startsWith("/api/jobs/") && req.method === "GET") {
      const job = jobFor(
        { db },
        user,
        decodeURIComponent(url.pathname.slice(10)),
      );
      if (!job) fail(404, "Task not found.");
      return job;
    }
    if (url.pathname === "/api/commands" && req.method === "POST") {
      const input = await body(req),
        key = req.headers["idempotency-key"];
      if (!Number.isInteger(input.revision))
        fail(400, "Workspace revision is required.");
      if (!key || key.length > 200) fail(400, "A retry key is required.");
      return transaction(db, () => {
        const cached = db
          .prepare("SELECT result FROM requests WHERE user_id=? AND key=?")
          .get(user.id, key);
        if (cached) return loadProjected(user);
        const state = load(user);
        if (input.revision !== undefined && state.revision !== input.revision)
          fail(409, "Your workspace changed. Reload before saving.");
        const before = structuredClone(state.data);
        if (!commandHandler) fail(503, "Coaching services are starting.");
        commandHandler(state.data, user, input, permittedMedia);
        if (input.action === "form.delete") {
          const submission = state.data.formSubmissions.find(
            (r) => r.id === input.payload?.id && r.clientId === input.clientId,
          );
          if (submission) {
            db.prepare(
              "UPDATE media SET deleted=1 WHERE id=? AND workspace_id=?",
            ).run(submission.file.id, user.workspace_id);
            db.prepare(
              "UPDATE media SET deleted=1 WHERE id IN (SELECT child_id FROM media_links WHERE parent_id=?)",
            ).run(submission.file.id);
          }
        }
        recordChanges(before, state.data, { id: user.id, role: user.role });
        state.data.updatedAt = new Date().toISOString();
        db.prepare(
          "UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?",
        ).run(JSON.stringify(state.data), user.workspace_id);
        const result = {
          data: projection(state.data, user),
          revision: state.revision + 1,
        };
        db.prepare("INSERT INTO requests VALUES(?,?,?)").run(
          user.id,
          key,
          JSON.stringify({ revision: result.revision }),
        );
        return result;
      });
    }
    if (url.pathname === "/api/media" && req.method === "POST") {
      const clientId = String(req.headers["x-client-id"] || ""),
        current = load(user).data;
      requireClient(user, current, clientId);
      const shared = req.headers["x-media-scope"] === "workspace",
        importId = req.headers["x-import-id"];
      if (shared || importId) coachOnly(user);
      if (importId) {
        if (
          !/^[a-f0-9-]{20,80}$/.test(importId) ||
          !db
            .prepare("SELECT id FROM imports WHERE workspace_id=? LIMIT 1")
            .get(user.workspace_id)
        )
          fail(403, "Media import requires an imported workspace.");
        const find = (value) =>
          value &&
          typeof value === "object" &&
          ((value.id === importId &&
            /^(image|audio|video)\//.test(value.type || "")) ||
            Object.values(value).some(find));
        if (!find(current))
          fail(400, "This file is not referenced by the imported workspace.");
        const previous = db
          .prepare("SELECT * FROM media WHERE id=?")
          .get(importId);
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
      if (!allowed.includes(type))
        fail(415, "Use MP4, MOV, WebM, supported audio, JPEG, PNG or WebP.");
      const purpose = importId
        ? "import"
        : req.headers["x-media-purpose"] || "general";
      const bytes = await body(
        req,
        (purpose === "import" || purpose === "formlab"
          ? 100
          : type === "application/pdf"
            ? 20
            : purpose === "voice"
              ? 12
              : 30) *
          1024 *
          1024,
        true,
      );
      if (!bytes.length) fail(400, "The file is empty.");
      const id = importId || randomUUID(),
        path = join(mediaRoot, id);
      writeFileSync(path, bytes, { mode: 0o600 });
      let duration = null;
      try {
        if (type === "application/pdf") {
          if (bytes.subarray(0, 5).toString() !== "%PDF-")
            fail(422, "Choose a valid PDF file.");
        } else if (!type.startsWith("image/")) {
          let output;
          try {
            output = await exec(
              process.env.FFPROBE_PATH || "ffprobe",
              [
                "-v",
                "error",
                "-show_entries",
                "format=duration:stream=codec_type,codec_name",
                "-of",
                "json",
                path,
              ],
              { timeout: 15000, maxBuffer: 100000 },
            );
          } catch {
            fail(
              422,
              "The recording could not be validated. The service needs ffprobe and a playable recording.",
            );
          }
          const meta = JSON.parse(output.stdout);
          duration = Number(meta.format?.duration);
          const max =
            purpose === "import"
              ? 21600
              : purpose === "formlab"
                ? 120
                : purpose === "voice"
                  ? 61
                  : 600;
          if (!Number.isFinite(duration)) {
            try {
              const decoded = await exec(
                process.env.FFMPEG_PATH || "ffmpeg",
                [
                  "-v",
                  "error",
                  "-i",
                  path,
                  "-t",
                  String(max + 1),
                  "-f",
                  "null",
                  "-",
                  "-progress",
                  "pipe:1",
                ],
                { timeout: 30000, maxBuffer: 100000 },
              );
              const times = [
                ...decoded.stdout.matchAll(/out_time_us=(\d+)/g),
              ].map((m) => Number(m[1]) / 1000000);
              duration = times.at(-1);
            } catch {
              fail(
                422,
                "The recording could not be decoded. Choose a playable recording.",
              );
            }
          }
          if (
            !Number.isFinite(duration) ||
            duration <= 0 ||
            duration > max ||
            !meta.streams?.some(
              (s) =>
                s.codec_type === (type.startsWith("video") ? "video" : "audio"),
            )
          )
            fail(
              422,
              `Choose a playable ${type.startsWith("video") ? "video up to 120 seconds" : "voice recording up to 60 seconds"}.`,
            );
        } else if (
          !(
            (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) ||
            (type === "image/png" &&
              bytes.subarray(1, 4).toString() === "PNG") ||
            (type === "image/webp" &&
              bytes.subarray(8, 12).toString() === "WEBP")
          )
        )
          fail(422, "The image file is not valid.");
        const now = new Date().toISOString(),
          expires = new Date(
            Date.now() +
              Number(process.env.AVALEN_MEDIA_RETENTION_DAYS || 365) * 86400000,
          ).toISOString();
        db.prepare("INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?,?,0)").run(
          id,
          user.workspace_id,
          shared ? "workspace" : clientId,
          user.id,
          decodeURIComponent(
            String(req.headers["x-file-name"] || "Recording"),
          ).slice(0, 200),
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
              if (current.clients.some((c) => c.id === idOfClient))
                db.prepare(
                  "INSERT OR IGNORE INTO media_access VALUES(?,?)",
                ).run(id, idOfClient);
        }
        let thumbnail = null;
        if (type.startsWith("video/")) {
          const thumbId = randomUUID(),
            thumbPath = join(mediaRoot, thumbId);
          try {
            await exec(
              process.env.FFMPEG_PATH || "ffmpeg",
              [
                "-y",
                "-v",
                "error",
                "-i",
                path,
                "-frames:v",
                "1",
                "-vf",
                "scale=480:-2",
                "-f",
                "image2",
                "-vcodec",
                "mjpeg",
                thumbPath,
              ],
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
            for (const idOfClient of permitted)
              db.prepare("INSERT OR IGNORE INTO media_access VALUES(?,?)").run(
                thumbId,
                idOfClient,
              );
            thumbnail = { id: thumbId, type: "image/jpeg", size };
          } catch {
            if (existsSync(thumbPath)) unlinkSync(thumbPath);
          }
        }
        return {
          id,
          thumbnail,
          name: decodeURIComponent(
            String(req.headers["x-file-name"] || "Recording"),
          ).slice(0, 200),
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
        for (const child of db
          .prepare("SELECT child_id FROM media_links WHERE parent_id=?")
          .all(row.id)) {
          db.prepare("UPDATE media SET deleted=1 WHERE id=?").run(
            child.child_id,
          );
          const childPath = join(mediaRoot, child.child_id);
          if (existsSync(childPath)) unlinkSync(childPath);
        }
        if (existsSync(path)) unlinkSync(path);
        return { ok: true };
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        fail(405, "Method not allowed.");
      if (!existsSync(path)) fail(404, "Recording unavailable.");
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || ""),
        start = range ? Number(range[1]) : 0,
        end =
          range && range[2]
            ? Math.min(Number(range[2]), row.size - 1)
            : row.size - 1;
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
      if (range)
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${row.size}`,
        });
      if (req.method === "HEAD") res.end();
      else createReadStream(path, { start, end }).pipe(res);
      return;
    }
    fail(404, "Not found.");
  }
  const server = http.createServer((req, res) => {
    route(req, res)
      .then((result) => {
        if (result !== undefined && !res.writableEnded) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        }
      })
      .catch((error) => {
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.writeHead(error.status || 500, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({
            error: error.status
              ? error.message
              : "The service could not complete this request. Try again.",
          }),
        );
        if (!error.status) console.error(error);
      });
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;
  return {
    server,
    db,
    root,
    bootstrap,
    load,
    commit,
    permittedMedia,
    wearables,
    setCommandHandler: (fn) => (commandHandler = fn),
  };
}
