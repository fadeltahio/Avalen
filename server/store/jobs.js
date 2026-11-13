// The background task queue (transcriptions today).
export function jobStore(db) {
  const clientOf = db.dialect === "postgres" ? "(payload::jsonb->>'clientId')" : "json_extract(payload, '$.clientId')";
  return {
    enqueue: (j) =>
      db.run(
        "INSERT INTO jobs(id, workspace_id, kind, record_id, run_at, payload) VALUES($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
        [j.id, j.workspace_id, j.kind, j.record_id, j.run_at, JSON.stringify(j.payload)],
      ),
    get: (id, workspaceId) => db.get("SELECT * FROM jobs WHERE id=$1 AND workspace_id=$2", [id, workspaceId]),
    due: (now, limit) => db.all("SELECT * FROM jobs WHERE state IN ('pending','retry') AND run_at<=$1 ORDER BY run_at LIMIT $2", [now, limit]),
    // True only for the one worker that moves the task from waiting to running.
    claim: async (id) => (await db.run("UPDATE jobs SET state='running', attempts=attempts+1 WHERE id=$1 AND state IN ('pending','retry')", [id])).changes > 0,
    finish: (id, payload) => db.run("UPDATE jobs SET state='done', payload=$1, error=NULL WHERE id=$2", [JSON.stringify(payload), id]),
    fail: (id, state, error, runAt) => db.run("UPDATE jobs SET state=$1, error=$2, run_at=$3 WHERE id=$4", [state, error, runAt, id]),
    requeueInterrupted: (now) => db.run("UPDATE jobs SET state='retry', run_at=$1 WHERE state='running'", [now]),
    deleteForClient: (workspaceId, clientId) => db.run(`DELETE FROM jobs WHERE workspace_id=$1 AND ${clientOf}=$2`, [workspaceId, clientId]),
    deleteWorkspace: (workspaceId) => db.run("DELETE FROM jobs WHERE workspace_id=$1", [workspaceId]),
  };
}
