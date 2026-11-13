// Coaching relationships and client-owned workout history.
//
// A workout is stored once, in workout_sessions, owned by the client and tied to the
// coaching relationship it was logged under. `data` keeps the workout exactly as the
// app recorded it (the app compares workouts by their exact JSON); the other columns
// and workout_sets repeat what can be queried, such as dates, exercises and loads.
import { randomUUID } from "node:crypto";

const number = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const whole = (v) => (Number.isInteger(v) ? v : null);
const text = (v) => (typeof v === "string" ? v : null);

export function relationshipStore(db) {
  const forWorkspace = (workspaceId) => db.all("SELECT * FROM coaching_relationships WHERE workspace_id=$1", [workspaceId]);
  return {
    forWorkspace,
    // Brings a workspace's relationships in line with its client list: every client
    // (and any client a workout names) has one; a deleted or removed client's is ended;
    // a client's login is linked once it exists. Returns client id → relationship id.
    async sync(workspaceId, clients, workoutClientIds = []) {
      const now = new Date().toISOString();
      const existing = new Map((await forWorkspace(workspaceId)).map((r) => [r.client_id, r]));
      const listed = new Map(clients.filter((c) => c && typeof c.id === "string").map((c) => [c.id, c]));
      for (const clientId of new Set([...listed.keys(), ...workoutClientIds.filter((id) => typeof id === "string")])) {
        const client = listed.get(clientId), status = client && !client.deletedAt ? "active" : "ended", row = existing.get(clientId);
        if (!row)
          await db.run(
            "INSERT INTO coaching_relationships(id, workspace_id, client_id, status, started_at, ended_at) VALUES($1, $2, $3, $4, $5, $6)",
            [randomUUID(), workspaceId, clientId, status, now, status === "ended" ? now : null],
          );
        else if (row.status !== status)
          await db.run("UPDATE coaching_relationships SET status=$1, ended_at=$2 WHERE id=$3", [status, status === "ended" ? now : null, row.id]);
      }
      for (const row of existing.values())
        if (!listed.has(row.client_id) && row.status === "active")
          await db.run("UPDATE coaching_relationships SET status='ended', ended_at=$1 WHERE id=$2", [now, row.id]);
      await db.run(
        `UPDATE coaching_relationships SET client_user_id=(SELECT id FROM users WHERE users.workspace_id=coaching_relationships.workspace_id AND users.client_id=coaching_relationships.client_id)
         WHERE workspace_id=$1 AND client_user_id IS NULL`,
        [workspaceId],
      );
      return new Map((await forWorkspace(workspaceId)).map((r) => [r.client_id, r.id]));
    },
    deleteWorkspace: (workspaceId) => db.run("DELETE FROM coaching_relationships WHERE workspace_id=$1", [workspaceId]),
  };
}

export function workoutStore(db) {
  const inWorkspace = "JOIN coaching_relationships r ON r.id=workout_sessions.relationship_id WHERE r.workspace_id=$1";
  async function saveSets(session) {
    await db.run("DELETE FROM workout_sets WHERE session_id=$1", [session.id]);
    const sets = Array.isArray(session.sets) ? session.sets : [];
    for (const [position, set] of sets.entries()) {
      if (!set || typeof set !== "object") continue;
      await db.run(
        "INSERT INTO workout_sets(session_id, position, exercise_id, exercise_name, set_number, kind, weight_kg, reps, effort, skipped) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [session.id, position, text(set.exerciseId), text(set.name) ?? "", whole(set.set), text(set.kind), number(set.weight), number(set.reps), text(set.effort), set.skipped ? 1 : 0],
      );
    }
  }
  const columns = (s) => [text(s.clientId) ?? "", text(s.date) ?? "", text(s.dayId), text(s.title) ?? "", number(s.startedAt), text(s.finishedAt), whole(s.duration)];

  return {
    // The workspace's workouts in the order they were saved, exactly as recorded.
    async forWorkspace(workspaceId) {
      const rows = await db.all(`SELECT workout_sessions.id, workout_sessions.data, workout_sessions.seq FROM workout_sessions ${inWorkspace}`, [workspaceId]);
      return rows.sort((a, b) => Number(a.seq) - Number(b.seq) || (a.id < b.id ? -1 : 1)).map((r) => JSON.parse(r.data));
    },
    // Makes the stored workouts match `sessions`: new ones are added after the rest,
    // changed ones rewritten, and ones no longer listed removed with their sets.
    async sync(workspaceId, sessions, relationshipFor) {
      const stored = new Map((await db.all(`SELECT workout_sessions.id, workout_sessions.data, workout_sessions.seq FROM workout_sessions ${inWorkspace}`, [workspaceId])).map((r) => [r.id, r]));
      let seq = Math.max(0, ...[...stored.values()].map((r) => Number(r.seq))) + 1;
      const listed = new Set();
      for (const session of sessions) {
        if (!session || typeof session.id !== "string") continue;
        listed.add(session.id);
        const json = JSON.stringify(session), row = stored.get(session.id), relationship = relationshipFor(session.clientId) ?? null;
        if (row?.data === json) continue;
        if (row)
          await db.run(
            "UPDATE workout_sessions SET client_id=$1, training_date=$2, day_id=$3, title=$4, started_at=$5, finished_at=$6, duration_s=$7, relationship_id=$8, data=$9 WHERE id=$10",
            [...columns(session), relationship, json, session.id],
          );
        else
          await db.run(
            "INSERT INTO workout_sessions(client_id, training_date, day_id, title, started_at, finished_at, duration_s, relationship_id, data, seq, id) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            [...columns(session), relationship, json, seq++, session.id],
          );
        await saveSets(session);
      }
      for (const id of stored.keys())
        if (!listed.has(id)) {
          await db.run("DELETE FROM workout_sets WHERE session_id=$1", [id]);
          await db.run("DELETE FROM workout_sessions WHERE id=$1", [id]);
        }
    },
    async deleteWorkspace(workspaceId) {
      const ids = (await db.all(`SELECT workout_sessions.id FROM workout_sessions ${inWorkspace}`, [workspaceId])).map((r) => r.id);
      for (const id of ids) {
        await db.run("DELETE FROM workout_sets WHERE session_id=$1", [id]);
        await db.run("DELETE FROM workout_sessions WHERE id=$1", [id]);
      }
    },
  };
}
