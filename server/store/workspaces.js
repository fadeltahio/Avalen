// Coach workspaces and imported copies.
//
// Phase 2: a workspace's workouts live in workout_sessions (server/store/workouts.js),
// not in its JSON document, and every client has a row in coaching_relationships.
// Callers still read and save one workspace object: get() puts the workouts back in
// place and save() moves them out again, so the app sees exactly what it saw before.
// The stored document keeps an empty "sessions" list so the object's key order (which
// the app's exact-JSON comparisons depend on) is unchanged.
import { relationshipStore, workoutStore } from "./workouts.js";

export function workspaceStore(db) {
  const relationships = relationshipStore(db), workouts = workoutStore(db);
  // Inside a transaction, reads the workspace and holds it until the transaction ends,
  // so a concurrent save waits instead of overwriting. (SQLite already runs one
  // transaction at a time.)
  const lockClause = db.dialect === "postgres" ? " FOR UPDATE" : "";
  async function assemble(row) {
    if (!row) return null;
    const data = JSON.parse(row.data);
    // A document written before Phase 2 still carries its workouts until it is next saved;
    // one with no "sessions" list at all gets one only if workouts exist.
    if (!(Array.isArray(data.sessions) && data.sessions.length)) {
      const stored = await workouts.forWorkspace(row.id);
      if (Array.isArray(data.sessions) || stored.length) data.sessions = stored;
    }
    return { id: row.id, data, revision: Number(row.revision) };
  }
  // Writes the document without its workouts, and the workouts and relationships to their tables.
  function write(id, data, { bump = true } = {}) {
    return db.transaction(async () => {
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      const relationshipFor = await relationships.sync(id, Array.isArray(data.clients) ? data.clients : [], sessions.map((s) => s?.clientId));
      await workouts.sync(id, sessions, (clientId) => relationshipFor.get(clientId));
      const document = JSON.stringify({ ...data, sessions: [] });
      return db.run(`UPDATE workspaces SET data=$1${bump ? ", revision=revision+1" : ""} WHERE id=$2`, [document, id]);
    });
  }

  const workspaces = {
    get: async (id) => assemble(await db.get("SELECT * FROM workspaces WHERE id=$1", [id])),
    getForUpdate: async (id) => assemble(await db.get(`SELECT * FROM workspaces WHERE id=$1${lockClause}`, [id])),
    lock: (id) => db.get(`SELECT id FROM workspaces WHERE id=$1${lockClause}`, [id]),
    all: async () => Promise.all((await db.all("SELECT * FROM workspaces")).map(assemble)),
    ids: async () => (await db.all("SELECT id FROM workspaces")).map((r) => r.id),
    create: (id, data) =>
      db.transaction(async () => {
        await db.run("INSERT INTO workspaces(id, data) VALUES($1, $2)", [id, JSON.stringify({ ...data, sessions: [] })]);
        await write(id, data, { bump: false });
      }),
    save: (id, data) => write(id, data),
    async delete(id) {
      await workouts.deleteWorkspace(id);
      await relationships.deleteWorkspace(id);
      await db.run("DELETE FROM workspaces WHERE id=$1", [id]);
    },
    // Moves workouts still held in documents written before Phase 2 into their tables.
    // Each workspace moves in its own transaction and is read back afterwards: unless the
    // result is identical to the original document, nothing is changed for that workspace.
    async moveInlineWorkouts() {
      const report = { moved: [], failed: [] };
      for (const id of await workspaces.ids()) {
        try {
          await db.transaction(async () => {
            const row = await db.get(`SELECT data FROM workspaces WHERE id=$1${lockClause}`, [id]);
            const original = JSON.parse(row.data);
            if (!Array.isArray(original.sessions) || !original.sessions.length) return;
            await write(id, original, { bump: false });
            const after = await workspaces.get(id);
            if (JSON.stringify(after.data) !== row.data) throw new Error("the rebuilt workspace differs from the original");
            report.moved.push(id);
          });
        } catch (e) {
          report.failed.push({ id, error: e.message });
          console.error(`Workouts for workspace ${id} were left in place: ${e.message}`);
        }
      }
      return report;
    },
  };
  const imports = {
    record: (id, workspaceId, data) =>
      db.run("INSERT INTO imports(id, workspace_id, data, at) VALUES($1, $2, $3, $4)", [id, workspaceId, JSON.stringify(data), new Date().toISOString()]),
    exists: async (workspaceId) => Boolean(await db.get("SELECT id FROM imports WHERE workspace_id=$1 LIMIT 1", [workspaceId])),
    deleteWorkspace: (workspaceId) => db.run("DELETE FROM imports WHERE workspace_id=$1", [workspaceId]),
  };
  return { workspaces, imports, relationships, workouts };
}
