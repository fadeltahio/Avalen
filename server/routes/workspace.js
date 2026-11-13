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
  const { db, load, loadProjected, commit, permittedMedia, token, hash, randomUUID, foundations, transaction } = ctx;

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
        (data) => {
          const result = mergeEdit(data, input.data, user);
          validateMediaChanges(
            data,
            result,
            user,
            permittedMedia,
            (id, clientId) => Boolean(db.prepare("SELECT media_id FROM media_access WHERE media_id=? AND client_id=?").get(id, clientId)),
          );
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
      return transaction(() => {
        const cached = db.prepare("SELECT result FROM requests WHERE user_id=? AND key=?").get(user.id, key);
        if (cached) return loadProjected(user);
        const state = load(user);
        if (input.revision !== undefined && state.revision !== input.revision)
          fail(409, "Your workspace changed. Reload before saving.");
        const before = structuredClone(state.data);
        const commandHandler = ctx.getCommandHandler();
        if (!commandHandler) fail(503, "Coaching services are starting.");
        commandHandler(state.data, user, input, permittedMedia);
        if (input.action === "form.delete") {
          const submission = state.data.formSubmissions.find((r) => r.id === input.payload?.id && r.clientId === input.clientId);
          if (submission) {
            db.prepare("UPDATE media SET deleted=1 WHERE id=? AND workspace_id=?").run(submission.file.id, user.workspace_id);
            db.prepare("UPDATE media SET deleted=1 WHERE id IN (SELECT child_id FROM media_links WHERE parent_id=?)").run(submission.file.id);
          }
        }
        recordChanges(before, state.data, { id: user.id, role: user.role });
        state.data.updatedAt = new Date().toISOString();
        db.prepare("UPDATE workspaces SET data=?,revision=revision+1 WHERE id=?").run(JSON.stringify(state.data), user.workspace_id);
        const result = { data: projection(state.data, user), revision: state.revision + 1 };
        db.prepare("INSERT INTO requests VALUES(?,?,?)").run(user.id, key, JSON.stringify({ revision: result.revision }));
        return result;
      });
    }

    if (url.pathname === "/api/invitations" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req, 4096);
      requireClient(user, load(user).data, input.clientId);
      const value = token();
      db.prepare("INSERT INTO invitations VALUES(?,?,?,?,0)").run(hash(value), user.workspace_id, input.clientId, Date.now() + 48 * 3600000);
      return { invite: value, expiresAt: new Date(Date.now() + 48 * 3600000).toISOString() };
    }

    if (url.pathname === "/api/import" && req.method === "POST") {
      coachOnly(user);
      const input = await body(req),
        imported = parseWorkspace(JSON.stringify(input.data));
      return commit(user, input.revision, (current) => {
        if (
          db.prepare("SELECT id FROM users WHERE workspace_id=? AND role='client' LIMIT 1").get(user.workspace_id) ||
          current.sessions.length ||
          current.checkins.length
        )
          fail(409, "Import is available only before live client activity. Export and merge records with the service owner instead.");
        db.prepare("INSERT INTO imports VALUES(?,?,?,?)").run(randomUUID(), user.workspace_id, JSON.stringify(current), new Date().toISOString());
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
