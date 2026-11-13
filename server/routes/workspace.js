// The core data-sync protocol: reading the signed-in user's workspace, saving a
// patch to it, running a named action (see src/avalen/ecosystem/actions.js), and
// the two ways work gets into a workspace that aren't normal use: invitations and
// bulk import.
import { validateMediaChanges } from "../media-permissions.js";
import { coachOnly, fail, mergeEdit, projection, requireClient } from "../permissions.js";
import { recordChanges } from "../../src/avalen/ecosystem/memory.js";
import { parseWorkspace } from "../../src/avalen/persistence.js";
import { NOT_HANDLED, body } from "../http-utils.js";

export function createWorkspaceRoutes(ctx) {
  const { store, load, loadProjected, commit, mediaLookup, token, hash, randomUUID, foundations, transaction } = ctx;

  return async function handleWorkspaceRoutes(req, res, url, user) {
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
        (data, files) => {
          const result = mergeEdit(data, input.data, user);
          validateMediaChanges(data, result, user, files.permitted, files.granted);
          return result;
        },
        key,
      );
    }

    // A named action from src/avalen/ecosystem/actions.js, replayed server-side
    // against the canonical workspace. This is the one path an offline-first
    // mutation takes once it reaches the server, instead of a raw patch.
    if (url.pathname === "/api/commands" && req.method === "POST") {
      const input = await body(req),
        key = req.headers["idempotency-key"];
      if (!Number.isInteger(input.revision))
        fail(400, "Workspace revision is required.");
      if (!key || key.length > 200) fail(400, "A retry key is required.");
      return transaction(async () => {
        const state = await load(user, { lock: true });
        if (await store.requests.seen(user.id, key)) return { data: projection(state.data, user), revision: state.revision };
        if (input.revision !== undefined && state.revision !== input.revision)
          fail(409, "Your workspace changed. Reload before saving.");
        const before = structuredClone(state.data);
        const commandHandler = ctx.getCommandHandler();
        if (!commandHandler) fail(503, "Coaching services are starting.");
        const files = await mediaLookup(user, state.data);
        commandHandler(state.data, user, input, files.permitted);
        if (input.action === "form.delete") {
          const submission = state.data.formSubmissions.find((r) => r.id === input.payload?.id && r.clientId === input.clientId);
          if (submission) {
            await store.media.markDeletedInWorkspace(submission.file.id, user.workspace_id);
            await store.media.markChildrenDeleted(submission.file.id);
          }
        }
        recordChanges(before, state.data, { id: user.id, role: user.role });
        state.data.updatedAt = new Date().toISOString();
        await store.workspaces.save(user.workspace_id, state.data);
        const result = { data: projection(state.data, user), revision: state.revision + 1 };
        await store.requests.record(user.id, key, { revision: result.revision });
        return result;
      });
    }

    if (url.pathname === "/api/invitations" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req, 4096);
      requireClient(user, (await load(user)).data, input.clientId);
      const value = token();
      await store.invitations.create(hash(value), user.workspace_id, input.clientId, Date.now() + 48 * 3600000);
      return { invite: value, expiresAt: new Date(Date.now() + 48 * 3600000).toISOString() };
    }

    if (url.pathname === "/api/import" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req),
        imported = parseWorkspace(JSON.stringify(input.data));
      return commit(user, input.revision, async (current) => {
        if ((await store.users.workspaceHasClientLogin(user.workspace_id)) || current.sessions.length || current.checkins.length)
          fail(409, "Import is available only before live client activity. Export and merge records with the service owner instead.");
        await store.imports.record(randomUUID(), user.workspace_id, current);
        for (const client of imported.clients) delete client.externalAIConsent;
        foundations(imported);
        imported.demo = Boolean(imported.demo);
        imported.onboarded = true;
        return imported;
      });
    }

    return NOT_HANDLED;
  };
}
