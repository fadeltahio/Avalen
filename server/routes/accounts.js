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
  const { store, files, limit, checkPassword, clearSessionCookie, foundations, wearables, transaction, commit, memory } = ctx;

  const removeFiles = async (ids) => {
    const all = [...ids];
    for (const id of ids) all.push(...(await store.media.children(id)));
    return all;
  };
  const endLogin = async (id) => {
    await store.sessions.endAllFor(id);
    await store.requests.deleteFor(id);
  };

  // A client's account and everything that was theirs, with every coach they've had. Each
  // coach keeps an anonymous entry and payment records without personal details.
  async function deleteClientAccount(user) {
    const coaching = (await store.relationships.forPerson(user.id)).map((r) => ({ ws: r.workspace_id, clientId: r.client_id, relationship: r.id }));
    if (user.workspace_id && !coaching.some((c) => c.ws === user.workspace_id && c.clientId === user.client_id))
      coaching.push({ ws: user.workspace_id, clientId: user.client_id, relationship: null });
    const mediaIds = [];
    for (const c of coaching) {
      await wearables.forget(c.ws, c.clientId);
      mediaIds.push(...(await store.media.idsForClient(c.ws, c.clientId)));
    }
    const fileIds = await removeFiles(mediaIds);
    await transaction(async () => {
      for (const id of mediaIds) await store.media.purge(id);
      for (const c of coaching) {
        if (c.relationship) {
          await store.records.deleteClientRecords(c.relationship);
          await store.workouts.deleteForRelationship(c.relationship);
        }
        await store.invitations.deleteForClient(c.ws, c.clientId);
        await store.jobs.deleteForClient(c.ws, c.clientId);
        if (await store.workspaces.retired(c.ws)) await store.records.deleteProfile(c.ws, c.clientId);
        else {
          const row = await store.workspaces.getForUpdate(c.ws);
          if (!row) continue;
          const data = removeClientData(foundations(row.data), c.clientId);
          data.updatedAt = new Date().toISOString();
          await store.workspaces.save(c.ws, data);
        }
      }
      await endLogin(user.id);
      await store.users.delete(user.id);
    });
    for (const id of fileIds) await files.remove(id);
  }

  // A coach's account, workspace and everything of theirs. Clients with their own account
  // keep it, together with their own records; clients without one are removed.
  async function deleteCoachAccount(user) {
    const ws = user.workspace_id;
    const keeping = await store.users.clientLoginsIn(ws), kept = new Set(keeping.map((k) => k.client_id));
    for (const k of keeping) await wearables.forget(ws, k.client_id, { keepReadings: true });
    const all = await store.media.idsInWorkspace(ws), keptMedia = new Set();
    for (const clientId of kept) for (const id of await store.media.idsForClient(ws, clientId)) keptMedia.add(id);
    const mediaIds = all.filter((id) => !keptMedia.has(id));
    const fileIds = (await removeFiles(mediaIds)).filter((id) => !keptMedia.has(id));
    await transaction(async () => {
      for (const id of mediaIds) await store.media.purge(id);
      const relationships = await store.relationships.forWorkspace(ws);
      for (const client of relationships.filter((r) => !kept.has(r.client_id))) await wearables.forget(ws, client.client_id);
      for (const k of keeping) await store.users.release(k.id);
      await store.relationships.endAll(ws);
      for (const id of await store.users.idsInWorkspace(ws)) await endLogin(id);
      await store.users.deleteWorkspace(ws);
      await store.invitations.deleteWorkspace(ws);
      await store.coachCodes.deleteWorkspace(ws);
      await store.jobs.deleteWorkspace(ws);
      await store.imports.deleteWorkspace(ws);
      await store.paymentAccounts.delete(ws);
      const keep = new Set(relationships.filter((r) => kept.has(r.client_id)).map((r) => r.id));
      if (keep.size) await store.workspaces.retire(ws, keep);
      else await store.workspaces.delete(ws); // with its workouts and relationships
    });
    for (const id of fileIds) await files.remove(id);
  }

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

    // A client ends coaching with their coach. They keep their login and their own records;
    // the coach keeps payments, messages, documents and their own notes and plans.
    if (url.pathname === "/api/account/leave-coach" && req.method === "POST") {
      if (user.role !== "client" || !user.workspace_id) fail(409, "You’re not connected to a coach.");
      limit(req, "leave-coach");
      const input = await body(req, 4096);
      if (input.confirm !== true) fail(400, "Confirm that you want to end coaching.");
      await wearables.forget(user.workspace_id, user.client_id, { keepReadings: true });
      await commit(user, undefined, (data) => {
        const client = data.clients.find((c) => c.id === user.client_id);
        if (!client) fail(404, "Client not found.");
        Object.assign(client, { leftAt: new Date().toISOString(), paused: true });
        memory(data, client.id, "Account", "Ended coaching", "The client ended coaching and took their own records with them.", { by: "client" });
        return data;
      });
      return { user: { id: user.id, email: user.email, role: user.role, clientId: null }, ...(await ctx.loadProjected({ ...user, workspace_id: null, client_id: null })) };
    }

    // A client between coaches joins a new one with a coach code. The new coach starts
    // fresh: earlier history stays with the client and isn't shared.
    if (url.pathname === "/api/account/join-coach" && req.method === "POST") {
      if (user.role !== "client" || user.workspace_id) fail(409, "You’re already connected to a coach.");
      limit(req, "join");
      const input = await body(req, 4096);
      const workspaceId = await ctx.codes.find(input.code);
      if (!workspaceId) fail(404, "This coach code was not found. Check it with your coach.");
      const past = await store.relationships.forPerson(user.id), last = past.at(-1);
      const profile = last ? await store.records.clientRecord(last.workspace_id, last.client_id) : null;
      const name = profile?.name && profile.name !== "Deleted client" ? profile.name : user.email.split("@")[0];
      let clientId;
      await transaction(async () => {
        const row = await store.workspaces.getForUpdate(workspaceId);
        if (!row) fail(404, "This coach code was not found. Check it with your coach.");
        const data = foundations(row.data), client = ctx.freshClient(name, user.email);
        data.clients.push(client);
        data.activeClientId ||= client.id;
        memory(data, client.id, "Account", "Joined with your coach code", "", { by: "client" });
        clientId = client.id;
        await store.users.attach(user.id, workspaceId, client.id);
        await store.workspaces.save(workspaceId, data);
      });
      return { user: { id: user.id, email: user.email, role: user.role, clientId }, ...(await ctx.loadProjected({ ...user, workspace_id: workspaceId, client_id: clientId })) };
    }

    // Everything a client's account holds, across every coach they've had.
    if (url.pathname === "/api/account/export" && req.method === "GET") {
      if (user.role !== "client") fail(403, "Coaches export their workspace from More.");
      const relationships = await store.relationships.forPerson(user.id);
      const wearableReadings = [];
      for (const r of relationships) wearableReadings.push(...(await store.wearables.daysSince(r.workspace_id, r.client_id, "0000-00-00")).map((d) => ({ provider: d.provider, date: d.date, metrics: JSON.parse(d.metrics) })));
      return {
        exportedAt: new Date().toISOString(),
        account: { email: user.email },
        coaching: relationships.map((r) => ({ startedAt: r.started_at, endedAt: r.ended_at, status: r.status })),
        workouts: await store.workouts.forPerson(user.id),
        ...(await store.records.forPerson(user.id)),
        wearableReadings,
      };
    }

    if (url.pathname === "/api/account/delete" && req.method === "POST") {
      limit(req, "account-delete");
      const input = await body(req, 4096);
      if (input.confirm !== "DELETE") fail(400, "Type DELETE to confirm.");
      const stored = await store.users.passwordOf(user.id);
      if (typeof input.password !== "string" || !stored || !checkPassword(input.password, stored))
        fail(401, "Your password is incorrect.");
      if (user.role === "client") await deleteClientAccount(user);
      else await deleteCoachAccount(user);
      clearSessionCookie(res);
      return { deleted: true };
    }

    return NOT_HANDLED;
  };
}
