// Signing up, signing in, and account-level actions (coach codes, account deletion).
// This is the only module that creates or destroys a user's session.
import { coachOnly, fail } from "../permissions.js";
import { formatCode } from "../coach-codes.js";
import { createWorkspace, newClient } from "../../src/avalen/seed.js";
import { removeClientData } from "../../src/avalen/account-deletion.js";
import { NOT_HANDLED, body } from "../http-utils.js";

// Routes that work without a signed-in session: checking the service, signing in,
// and every way of creating an account.
export function createOpenAccountRoutes(ctx) {
  const { store, bootstrap, coachSignup, hash, passwordHash, checkPassword, account, limit, session, login, loadProjected, foundations, emptyWorkspace, freshClient, emailTaken, insertUser, randomUUID, transaction, memory } = ctx;

  return async function handleOpenAccountRoutes(req, res, url) {
    if (url.pathname === "/api/status")
      return {
        configured: await store.users.any(),
        coachSignup,
        transcription: Boolean(process.env.AVALEN_TRANSCRIPTION_URL),
        ai: Boolean(process.env.AVALEN_AI_URL),
        privateStorage: true,
      };

    if (url.pathname === "/api/session" && req.method === "GET") {
      const user = await session(req);
      return user
        ? {
            user: { id: user.id, email: user.email, role: user.role, clientId: user.client_id },
            csrf: user.csrf,
            ...(await loadProjected(user)),
          }
        : { user: null };
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      limit(req, "login");
      const data = await body(req, 4096);
      const email = account(data),
        user = await store.users.byEmail(email);
      if (!user || !checkPassword(data.password, user.password))
        fail(401, "Email or password is incorrect.");
      return login(res, user);
    }

    if (url.pathname === "/api/setup" && req.method === "POST") {
      limit(req, "setup");
      const input = await body(req, 8192),
        email = account(input);
      if (await store.users.any())
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
      await transaction(async () => {
        await store.workspaces.create(user.workspace_id, data);
        await insertUser(user);
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
      if (await emailTaken(email)) fail(409, "An account with this email already exists. Sign in instead.");
      const data = emptyWorkspace(name);
      data.clients = [];
      data.activeClientId = null;
      foundations(data);
      const user = { id: randomUUID(), email, password: passwordHash(input.password), role: "coach", workspace_id: randomUUID(), client_id: null };
      await transaction(async () => {
        await store.workspaces.create(user.workspace_id, data);
        await insertUser(user);
        await ctx.codes.active(user.workspace_id);
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
      const workspaceId = await ctx.codes.find(input.code);
      if (!workspaceId) fail(404, "This coach code was not found. Check it with your coach.");
      if (await emailTaken(email)) fail(409, "An account with this email already exists. Sign in instead.");
      const user = { id: randomUUID(), email, password: passwordHash(input.password), role: "client", workspace_id: workspaceId, client_id: null };
      await transaction(async () => {
        const row = await store.workspaces.getForUpdate(workspaceId);
        if (!row) fail(404, "This coach code was not found. Check it with your coach.");
        const data = foundations(row.data),
          client = freshClient(name, email);
        data.clients.push(client);
        data.activeClientId ||= client.id;
        memory(data, client.id, "Account", "Joined with your coach code", "", { by: "client" });
        user.client_id = client.id;
        await insertUser(user);
        await store.workspaces.save(workspaceId, data);
      });
      return login(res, user);
    }

    if (url.pathname === "/api/join" && req.method === "POST") {
      limit(req, "join");
      const input = await body(req, 4096),
        email = account(input),
        invite = await store.invitations.findOpen(hash(String(input.invite || "")), Date.now());
      if (!invite) fail(404, "This invitation has expired or was already used.");
      const user = { id: randomUUID(), email, role: "client", workspace_id: invite.workspace_id, client_id: invite.client_id };
      await transaction(async () => {
        if (await store.users.clientHasLogin(invite.workspace_id, invite.client_id))
          fail(409, "This client already has an account.");
        await store.users.insert({ ...user, password: passwordHash(input.password) });
        await store.invitations.markUsed(invite.token);
        const { data } = await store.workspaces.getForUpdate(user.workspace_id),
          client = data.clients.find((c) => c.id === user.client_id);
        if (!client) fail(404, "The invited client is no longer available.");
        client.email = email;
        await store.workspaces.save(user.workspace_id, data);
      });
      return login(res, user);
    }

    return NOT_HANDLED;
  };
}

// Routes that require a signed-in session: everything about the account itself,
// as opposed to the coaching workspace it owns.
export function createAccountRoutes(ctx) {
  const { store, files, limit, checkPassword, clearSessionCookie, foundations, wearables, transaction } = ctx;

  return async function handleAccountRoutes(req, res, url, user) {
    if (url.pathname === "/api/logout" && req.method === "POST") {
      await store.sessions.end(user.id, user.csrf);
      clearSessionCookie(res);
      return { ok: true };
    }

    if (url.pathname === "/api/coach-code" && req.method === "GET") {
      coachOnly(user);
      return { code: formatCode(await ctx.codes.active(user.workspace_id)) };
    }
    if (url.pathname === "/api/coach-code/replace" && req.method === "POST") {
      coachOnly(user);
      limit(req, "coach-code");
      return { code: formatCode(await transaction(() => ctx.codes.replace(user.workspace_id))) };
    }

    if (url.pathname === "/api/account/delete" && req.method === "POST") {
      limit(req, "account-delete");
      const input = await body(req, 4096);
      if (input.confirm !== "DELETE") fail(400, "Type DELETE to confirm.");
      const stored = await store.users.passwordOf(user.id);
      if (typeof input.password !== "string" || !stored || !checkPassword(input.password, stored))
        fail(401, "Your password is incorrect.");
      const ws = user.workspace_id, clientId = user.role === "client" ? user.client_id : null;
      await wearables.forget(ws, clientId);
      const ids = clientId ? await store.media.idsForClient(ws, clientId) : await store.media.idsInWorkspace(ws);
      const fileIds = [...ids];
      for (const id of ids) fileIds.push(...(await store.media.children(id)));
      await transaction(async () => {
        for (const id of ids) await store.media.purge(id);
        if (clientId) {
          // The client's login and everything about them; the coach keeps an anonymous entry.
          for (const id of await store.users.idsForClient(ws, clientId)) {
            await store.sessions.endAllFor(id);
            await store.requests.deleteFor(id);
            await store.users.delete(id);
          }
          await store.invitations.deleteForClient(ws, clientId);
          await store.jobs.deleteForClient(ws, clientId);
          const row = await store.workspaces.getForUpdate(ws);
          const data = removeClientData(foundations(row.data), clientId);
          data.updatedAt = new Date().toISOString();
          await store.workspaces.save(ws, data);
        } else {
          // The owner deletes the whole workspace, including every client login.
          for (const id of await store.users.idsInWorkspace(ws)) {
            await store.sessions.endAllFor(id);
            await store.requests.deleteFor(id);
          }
          await store.users.deleteWorkspace(ws);
          await store.invitations.deleteWorkspace(ws);
          await store.coachCodes.deleteWorkspace(ws);
          await store.jobs.deleteWorkspace(ws);
          await store.imports.deleteWorkspace(ws);
          await store.paymentAccounts.delete(ws);
          await store.workspaces.delete(ws);
        }
      });
      for (const id of fileIds) await files.remove(id);
      clearSessionCookie(res);
      return { deleted: true };
    }

    return NOT_HANDLED;
  };
}
