// Signing up, signing in, and account-level actions (coach codes, account deletion).
// This is the only module that creates or destroys a user's session.
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { coachOnly, fail } from "../permissions.js";
import { formatCode } from "../coach-codes.js";
import { createWorkspace, newClient } from "../../src/avalen/seed.js";
import { removeClientData } from "../../src/avalen/account-deletion.js";
import { NOT_HANDLED, body } from "../http-utils.js";

// Routes that work without a signed-in session: checking the service, signing in,
// and every way of creating an account.
export function createOpenAccountRoutes(ctx) {
  const { db, bootstrap, coachSignup, hash, passwordHash, checkPassword, account, limit, session, login, loadProjected, foundations, emptyWorkspace, freshClient, emailTaken, insertUser, randomUUID, transaction, memory } = ctx;

  return async function handleOpenAccountRoutes(req, res, url) {
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
            user: { id: user.id, email: user.email, role: user.role, clientId: user.client_id },
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
      if (typeof input.setupToken !== "string" || hash(input.setupToken) !== hash(bootstrap))
        fail(403, "Use the setup token configured by the service owner.");
      if (!String(input.clientName || "").trim() || !String(input.name || "").trim())
        fail(400, "Enter the coach and first client’s names.");
      const data = createWorkspace();
      for (const key of Object.keys(data))
        if (Array.isArray(data[key]) && !["library", "templates", "savedReplies"].includes(key)) data[key] = [];
      data.clients = [newClient(input.clientName.trim().slice(0, 100), "")];
      data.clients[0].created = new Date().toISOString().slice(0, 10);
      data.clients[0].schedule = data.clients[0].schedule.filter((s) => s.date >= data.clients[0].created);
      data.clients[0].programEnd = new Date(Date.now() + 83 * 86400000).toISOString().slice(0, 10);
      data.activeClientId = data.clients[0].id;
      data.demo = false;
      data.onboarded = true;
      data.coach = { name: input.name.trim().slice(0, 100), brand: "Avalen", logo: null };
      foundations(data);
      const user = { id: randomUUID(), email, password: passwordHash(input.password), role: "coach", workspace_id: randomUUID(), client_id: null };
      transaction(() => {
        db.prepare("INSERT INTO workspaces(id,data) VALUES(?,?)").run(user.workspace_id, JSON.stringify(data));
        insertUser(user);
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
      transaction(() => {
        db.prepare("INSERT INTO workspaces(id,data) VALUES(?,?)").run(user.workspace_id, JSON.stringify(data));
        insertUser(user);
        ctx.codes.active(user.workspace_id);
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
      const workspaceId = ctx.codes.find(input.code);
      if (!workspaceId) fail(404, "This coach code was not found. Check it with your coach.");
      if (emailTaken(email)) fail(409, "An account with this email already exists. Sign in instead.");
      const user = { id: randomUUID(), email, password: passwordHash(input.password), role: "client", workspace_id: workspaceId, client_id: null };
      transaction(() => {
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
        invite = db.prepare("SELECT * FROM invitations WHERE token=? AND used=0 AND expires>?").get(hash(String(input.invite || "")), Date.now());
      if (!invite) fail(404, "This invitation has expired or was already used.");
      const user = { id: randomUUID(), email, role: "client", workspace_id: invite.workspace_id, client_id: invite.client_id };
      transaction(() => {
        if (db.prepare("SELECT id FROM users WHERE workspace_id=? AND client_id=?").get(invite.workspace_id, invite.client_id))
          fail(409, "This client already has an account.");
        db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(user.id, email, passwordHash(input.password), "client", user.workspace_id, user.client_id);
        db.prepare("UPDATE invitations SET used=1 WHERE token=?").run(invite.token);
        const workspace = db.prepare("SELECT data FROM workspaces WHERE id=?").get(user.workspace_id),
          data = JSON.parse(workspace.data),
          client = data.clients.find((c) => c.id === user.client_id);
        if (!client) fail(404, "The invited client is no longer available.");
        client.email = email;
        db.prepare("UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?").run(JSON.stringify(data), user.workspace_id);
      });
      return login(res, user);
    }

    return NOT_HANDLED;
  };
}

// Routes that require a signed-in session: everything about the account itself,
// as opposed to the coaching workspace it owns.
export function createAccountRoutes(ctx) {
  const { db, mediaRoot, limit, checkPassword, clearSessionCookie, foundations, wearables, transaction } = ctx;

  return async function handleAccountRoutes(req, res, url, user) {
    if (url.pathname === "/api/logout" && req.method === "POST") {
      db.prepare("DELETE FROM sessions WHERE user_id=? AND csrf=?").run(user.id, user.csrf);
      clearSessionCookie(res);
      return { ok: true };
    }

    if (url.pathname === "/api/coach-code" && req.method === "GET") {
      coachOnly(user);
      return { code: formatCode(ctx.codes.active(user.workspace_id)) };
    }
    if (url.pathname === "/api/coach-code/replace" && req.method === "POST") {
      coachOnly(user);
      limit(req, "coach-code");
      return { code: formatCode(transaction(() => ctx.codes.replace(user.workspace_id))) };
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
      transaction(() => {
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
      clearSessionCookie(res);
      return { deleted: true };
    }

    return NOT_HANDLED;
  };
}
