// Coach workspaces (still one JSON document each until Phase 2) and imported copies.
export function workspaceStore(db) {
  const parse = (row) => row && { id: row.id, data: JSON.parse(row.data), revision: Number(row.revision) };
  // Inside a transaction, reads the workspace and holds it until the transaction ends,
  // so a concurrent save waits instead of overwriting. (SQLite already runs one
  // transaction at a time.)
  const lockClause = db.dialect === "postgres" ? " FOR UPDATE" : "";
  const workspaces = {
    get: async (id) => parse(await db.get("SELECT * FROM workspaces WHERE id=$1", [id])),
    getForUpdate: async (id) => parse(await db.get(`SELECT * FROM workspaces WHERE id=$1${lockClause}`, [id])),
    lock: (id) => db.get(`SELECT id FROM workspaces WHERE id=$1${lockClause}`, [id]),
    all: async () => (await db.all("SELECT * FROM workspaces")).map(parse),
    ids: async () => (await db.all("SELECT id FROM workspaces")).map((r) => r.id),
    create: (id, data) => db.run("INSERT INTO workspaces(id, data) VALUES($1, $2)", [id, JSON.stringify(data)]),
    save: (id, data) => db.run("UPDATE workspaces SET data=$1, revision=revision+1 WHERE id=$2", [JSON.stringify(data), id]),
    delete: (id) => db.run("DELETE FROM workspaces WHERE id=$1", [id]),
  };
  const imports = {
    record: (id, workspaceId, data) =>
      db.run("INSERT INTO imports(id, workspace_id, data, at) VALUES($1, $2, $3, $4)", [id, workspaceId, JSON.stringify(data), new Date().toISOString()]),
    exists: async (workspaceId) => Boolean(await db.get("SELECT id FROM imports WHERE workspace_id=$1 LIMIT 1", [workspaceId])),
    deleteWorkspace: (workspaceId) => db.run("DELETE FROM imports WHERE workspace_id=$1", [workspaceId]),
  };
  return { workspaces, imports };
}
