// Records of uploaded files (the bytes live in the media folder), which clients may see
// a file, and each video's thumbnail.
export function mediaStore(db) {
  return {
    insert: (m) =>
      db.run(
        "INSERT INTO media(id, workspace_id, client_id, owner_id, name, type, size, duration, created_at, expires_at, deleted) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)",
        [m.id, m.workspace_id, m.client_id, m.owner_id, m.name, m.type, m.size, m.duration, m.created_at, m.expires_at],
      ),
    get: (id) => db.get("SELECT * FROM media WHERE id=$1", [id]),
    live: (id, workspaceId) => db.get("SELECT * FROM media WHERE id=$1 AND workspace_id=$2 AND deleted=0", [id, workspaceId]),
    isLive: async (id) => Boolean(await db.get("SELECT id FROM media WHERE id=$1 AND deleted=0", [id])),
    // Every live file record and grant in a workspace, for code that must check files without waiting.
    async index(workspaceId) {
      const rows = await db.all("SELECT * FROM media WHERE workspace_id=$1 AND deleted=0", [workspaceId]);
      const grants = await db.all(
        "SELECT media_access.media_id, media_access.client_id FROM media_access JOIN media ON media.id=media_access.media_id WHERE media.workspace_id=$1",
        [workspaceId],
      );
      return { rows: new Map(rows.map((r) => [r.id, r])), grants: new Set(grants.map((g) => `${g.media_id}|${g.client_id}`)) };
    },
    grant: (mediaId, clientId) =>
      db.run("INSERT INTO media_access(media_id, client_id) VALUES($1, $2) ON CONFLICT DO NOTHING", [mediaId, clientId]),
    hasGrant: async (mediaId, clientId) =>
      Boolean(await db.get("SELECT media_id FROM media_access WHERE media_id=$1 AND client_id=$2", [mediaId, clientId])),
    link: (parentId, childId) => db.run("INSERT INTO media_links(parent_id, child_id) VALUES($1, $2)", [parentId, childId]),
    children: async (parentId) => (await db.all("SELECT child_id FROM media_links WHERE parent_id=$1", [parentId])).map((r) => r.child_id),
    markDeleted: (id) => db.run("UPDATE media SET deleted=1 WHERE id=$1", [id]),
    markDeletedInWorkspace: (id, workspaceId) => db.run("UPDATE media SET deleted=1 WHERE id=$1 AND workspace_id=$2", [id, workspaceId]),
    markChildrenDeleted: (parentId) =>
      db.run("UPDATE media SET deleted=1 WHERE id IN (SELECT child_id FROM media_links WHERE parent_id=$1)", [parentId]),
    expired: async (nowIso) => (await db.all("SELECT id FROM media WHERE deleted=0 AND expires_at<=$1", [nowIso])).map((r) => r.id),
    // Deleted records whose bytes are still in storage.
    awaitingRemoval: async () => (await db.all("SELECT id FROM media WHERE deleted=1 AND files_removed=0")).map((r) => r.id),
    markFilesRemoved: (id) => db.run("UPDATE media SET files_removed=1 WHERE id=$1", [id]),
    idsForClient: async (workspaceId, clientId) =>
      (await db.all("SELECT id FROM media WHERE workspace_id=$1 AND client_id=$2", [workspaceId, clientId])).map((r) => r.id),
    idsInWorkspace: async (workspaceId) => (await db.all("SELECT id FROM media WHERE workspace_id=$1", [workspaceId])).map((r) => r.id),
    // Removes a file's record, grants and thumbnail links (not the bytes on disk).
    async purge(id) {
      await db.run("DELETE FROM media_access WHERE media_id=$1", [id]);
      await db.run("DELETE FROM media_links WHERE parent_id=$1 OR child_id=$1", [id]);
      await db.run("DELETE FROM media WHERE id=$1", [id]);
    },
  };
}
