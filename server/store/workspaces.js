// Coach workspaces and imported copies.
//
// Phase 2: a workspace's workouts live in workout_sessions (server/store/workouts.js),
// not in its JSON document, and every client has a row in coaching_relationships.
// Callers still read and save one workspace object: get() puts the workouts back in
// place and save() moves them out again, so the app sees exactly what it saw before.
// The stored document keeps an empty "sessions" list so the object's key order (which
// the app's exact-JSON comparisons depend on) is unchanged.
import { relationshipStore, workoutStore } from "./workouts.js";
import { AREAS, clientIdsIn, recordStore } from "./records.js";

// The top-level areas that differ between two versions of a workspace.
export function changedAreas(before, after) {
  const areas = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return new Set([...areas].filter((area) => JSON.stringify(before?.[area]) !== JSON.stringify(after?.[area])));
}

export function workspaceStore(db) {
  const relationships = relationshipStore(db), workouts = workoutStore(db), records = recordStore(db);
  // Inside a transaction, reads the workspace and holds it until the transaction ends,
  // so a concurrent save waits instead of overwriting. (SQLite already runs one
  // transaction at a time.)
  const lockClause = db.dialect === "postgres" ? " FOR UPDATE" : "";
  async function assemble(row) {
    if (!row) return null;
    const data = JSON.parse(row.data);
    const hidden = await relationships.departed(row.id);
    // A document written before Phase 2 still carries its workouts until it is next saved;
    // one with no "sessions" list at all gets one only if workouts exist.
    if (!(Array.isArray(data.sessions) && data.sessions.length)) {
      const stored = await workouts.forWorkspace(row.id, hidden);
      if (Array.isArray(data.sessions) || stored.length) data.sessions = stored;
    }
    // Phase 3 lists, under the same rule: inline (older document) or from their table.
    for (const area of AREAS) {
      const inline = data[area.collection];
      if (Array.isArray(inline) && inline.length) continue;
      const stored = await records.list(area, row.id, hidden);
      if (Array.isArray(inline) || stored.length) data[area.collection] = stored;
    }
    return { id: row.id, data, revision: Number(row.revision) };
  }
  // Writes the document without its lists, and the lists and relationships to their tables.
  // Each list keeps its place in the document as an empty array, so key order is unchanged.
  // `changed` (from changedAreas) limits the work to the lists that actually changed.
  function write(id, data, { bump = true, changed = null } = {}) {
    const touches = (area) => !changed || changed.has(area);
    return db.transaction(async () => {
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      const relationshipFor = await relationships.sync(id, Array.isArray(data.clients) ? data.clients : [], [...sessions.map((s) => s?.clientId), ...clientIdsIn(data)]);
      const linkOf = (clientId) => relationshipFor.get(clientId);
      const hidden = await relationships.departed(id);
      if (touches("sessions")) await workouts.sync(id, sessions, linkOf, hidden);
      const document = { ...data, sessions: [] };
      for (const area of AREAS) {
        const rows = data[area.collection];
        if (touches(area.collection)) await records.sync(area, id, Array.isArray(rows) ? rows : [], linkOf, hidden);
        if (Array.isArray(rows)) document[area.collection] = [];
      }
      return db.run(`UPDATE workspaces SET data=$1${bump ? ", revision=revision+1" : ""} WHERE id=$2`, [JSON.stringify(document), id]);
    });
  }

  const workspaces = {
    get: async (id) => assemble(await db.get("SELECT * FROM workspaces WHERE id=$1", [id])),
    getForUpdate: async (id) => assemble(await db.get(`SELECT * FROM workspaces WHERE id=$1${lockClause}`, [id])),
    lock: (id) => db.get(`SELECT id FROM workspaces WHERE id=$1${lockClause}`, [id]),
    all: async () => Promise.all((await db.all("SELECT * FROM workspaces")).map(assemble)),
    retired: async (id) => Boolean((await db.get("SELECT deleted_at FROM workspaces WHERE id=$1", [id]))?.deleted_at),
    // Workspaces in use (a deleted coach's marker is left out).
    ids: async () => (await db.all("SELECT id FROM workspaces WHERE deleted_at IS NULL")).map((r) => r.id),
    create: (id, data) =>
      db.transaction(async () => {
        await db.run("INSERT INTO workspaces(id, data) VALUES($1, $2)", [id, "{}"]);
        await write(id, data, { bump: false });
      }),
    save: (id, data, { changed } = {}) => write(id, data, { changed }),
    async delete(id) {
      await records.deleteWorkspace(id);
      await workouts.deleteWorkspace(id);
      await relationships.deleteWorkspace(id);
      await db.run("DELETE FROM workspaces WHERE id=$1", [id]);
    },
    // A coach deleted their account but some former clients keep their history: everything
    // of the coach's goes, the workspace stays only as an empty marker holding those
    // clients' own records (and their profiles), and their relationships stay, ended.
    async retire(id, keep) {
      await records.deleteWorkspace(id, keep);
      await workouts.deleteWorkspace(id, keep);
      await db.run("UPDATE workspaces SET data=$1, deleted_at=$2 WHERE id=$3", ["{}", new Date().toISOString(), id]);
    },
    // Moves lists still held in documents written before Phases 2 and 3 into their tables.
    // Each workspace moves in its own transaction and is read back afterwards: unless the
    // result is identical to the original document, nothing is changed for that workspace.
    async moveInlineRecords() {
      const report = { moved: [], failed: [] };
      for (const id of await workspaces.ids()) {
        try {
          await db.transaction(async () => {
            const row = await db.get(`SELECT data FROM workspaces WHERE id=$1${lockClause}`, [id]);
            const original = JSON.parse(row.data);
            const inline = ["sessions", ...AREAS.map((a) => a.collection)].some((c) => Array.isArray(original[c]) && original[c].length);
            if (!inline) return;
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
  return { workspaces, imports, relationships, workouts, records };
}
