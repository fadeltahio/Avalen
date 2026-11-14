// Phase 3: each client-related list in a workspace lives in its own table. A row keeps
// the record exactly as the app wrote it (`data`, because the app compares records by
// their exact JSON), its position in the list (`seq`, because some screens treat the
// last item as the newest), who it belongs to (the client and their coaching
// relationship) and a few queryable columns such as dates, calories and amounts.
// The workspace object the app receives is rebuilt from these rows unchanged.

import { rowKeys } from "../../src/avalen/ecosystem/changes.js";

const number = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v) => (typeof v === "string" ? v : null);
const flag = (v) => (v ? 1 : 0);

// collection in the workspace object → table, with any extra queryable columns.
// owner "client": the client's own records, which go with them if they leave their coach
// (the former coach keeps payments, messages, documents and their own notes and plans).
export const AREAS = [
  { collection: "clients", table: "client_records", client: (r) => r?.id, date: (r) => r?.created },
  { collection: "foodLogs", table: "food_logs", owner: "client", extra: [["meal", "text", (r) => text(r.meal)], ["kcal", "real", (r) => number(r.kcal)], ["protein_g", "real", (r) => number(r.p)], ["carbs_g", "real", (r) => number(r.c)], ["fat_g", "real", (r) => number(r.f)]] },
  { collection: "nutritionDays", table: "nutrition_days", owner: "client", extra: [["complete", "int", (r) => flag(r.complete)]] },
  { collection: "habitLogs", table: "habit_logs", owner: "client" },
  { collection: "activityLogs", table: "activity_logs", owner: "client" },
  { collection: "measurements", table: "measurements", owner: "client", extra: [["weight_kg", "real", (r) => number(r.weight)], ["waist_cm", "real", (r) => number(r.waist)], ["body_fat_pct", "real", (r) => number(r.bodyFat)]] },
  { collection: "checkins", table: "checkins", owner: "client", extra: [["reviewed", "int", (r) => flag(r.reviewed)]] },
  { collection: "messages", table: "messages", date: (r) => r?.at, extra: [["from_role", "text", (r) => text(r.from)], ["is_read", "int", (r) => flag(r.read)]] },
  { collection: "photos", table: "progress_photos", owner: "client" },
  { collection: "documents", table: "client_documents" },
  { collection: "inbodies", table: "body_scans", owner: "client" },
  { collection: "payments", table: "client_payments", date: (r) => r?.dueDate, extra: [["amount", "real", (r) => number(r.amount)], ["currency", "text", (r) => text(r.currency)], ["status", "text", (r) => text(r.status)]] },
  { collection: "timeline", table: "timeline_events", date: (r) => r?.at },
  { collection: "revisions", table: "plan_revisions", date: (r) => r?.at },
  { collection: "notifications", table: "notifications", owner: "client", date: (r) => r?.at },
  { collection: "formSubmissions", table: "form_submissions", owner: "client" },
  { collection: "scheduleProposals", table: "schedule_proposals" },
  { collection: "insightDecisions", table: "insight_decisions" },
  { collection: "clientPreferences", table: "client_preferences", owner: "client" },
  { collection: "dismissed", table: "dismissed_flags" },
];

const clientOf = (area, row) => text(area.client ? area.client(row) : row?.clientId);
const dateOf = (area, row) => text(area.date ? area.date(row) : row?.date ?? row?.at);
// Every client a workspace's rows mention, so each has a coaching relationship.
export function clientIdsIn(data) {
  const ids = [];
  for (const area of AREAS) if (Array.isArray(data[area.collection])) for (const row of data[area.collection]) ids.push(clientOf(area, row));
  return ids.filter(Boolean);
}

export function recordStore(db) {
  return {
    // A workspace's rows for one list, in their saved order, exactly as recorded.
    // `hidden`: relationships of clients who left with their own records; those rows are
    // neither shown to the coach nor touched by the coach's saves.
    async list(area, workspaceId, hidden = new Set()) {
      const rows = (await db.all(`SELECT data, seq, relationship_id FROM ${area.table} WHERE workspace_id=$1`, [workspaceId])).filter((r) => !(area.owner === "client" && hidden.has(r.relationship_id)));
      return rows.sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => JSON.parse(r.data));
    },
    async has(area, workspaceId) {
      return Boolean(await db.get(`SELECT record_key FROM ${area.table} WHERE workspace_id=$1 LIMIT 1`, [workspaceId]));
    },
    // Makes the table match `rows`: new rows added, changed or moved rows rewritten,
    // rows no longer in the list removed.
    async sync(area, workspaceId, rows, relationshipFor, hidden = new Set()) {
      const stored = new Map(
        (await db.all(`SELECT record_key, data, seq, relationship_id FROM ${area.table} WHERE workspace_id=$1`, [workspaceId]))
          .filter((r) => !(area.owner === "client" && hidden.has(r.relationship_id)))
          .map((r) => [r.record_key, r]),
      );
      // Rows of a client who has just left went with them; this save doesn't touch them.
      if (area.owner === "client") rows = rows.filter((row) => !hidden.has(relationshipFor(clientOf(area, row))));
      const keys = rowKeys(rows), extras = area.extra || [];
      const names = ["client_id", "relationship_id", "record_date", ...extras.map(([name]) => name), "seq", "data"];
      for (const [seq, row] of rows.entries()) {
        const key = keys[seq], json = JSON.stringify(row), old = stored.get(key);
        stored.delete(key);
        if (old && old.data === json && Number(old.seq) === seq) continue;
        const client = clientOf(area, row);
        const values = [client, client ? relationshipFor(client) ?? null : null, dateOf(area, row), ...extras.map(([, , pick]) => (row && typeof row === "object" ? pick(row) : null)), seq, json];
        if (old)
          await db.run(
            `UPDATE ${area.table} SET ${names.map((n, i) => `${n}=$${i + 1}`).join(", ")} WHERE workspace_id=$${names.length + 1} AND record_key=$${names.length + 2}`,
            [...values, workspaceId, key],
          );
        else
          await db.run(
            `INSERT INTO ${area.table}(workspace_id, record_key, ${names.join(", ")}) VALUES($1, $2, ${names.map((_, i) => `$${i + 3}`).join(", ")})`,
            [workspaceId, key, ...values],
          );
      }
      for (const key of stored.keys()) await db.run(`DELETE FROM ${area.table} WHERE workspace_id=$1 AND record_key=$2`, [workspaceId, key]);
    },
    // Everything in a workspace, except the own records and profile of `keep` relationships
    // (clients who keep their history when the coach deletes their account).
    async deleteWorkspace(workspaceId, keep = new Set()) {
      for (const area of AREAS) {
        if ((area.owner !== "client" && area.collection !== "clients") || !keep.size) {
          await db.run(`DELETE FROM ${area.table} WHERE workspace_id=$1`, [workspaceId]);
          continue;
        }
        for (const row of await db.all(`SELECT record_key, relationship_id FROM ${area.table} WHERE workspace_id=$1`, [workspaceId]))
          if (!keep.has(row.relationship_id)) await db.run(`DELETE FROM ${area.table} WHERE workspace_id=$1 AND record_key=$2`, [workspaceId, row.record_key]);
      }
    },
    // A client's own records under one relationship (deleting their account).
    async deleteClientRecords(relationshipId) {
      for (const area of AREAS) if (area.owner === "client") await db.run(`DELETE FROM ${area.table} WHERE relationship_id=$1`, [relationshipId]);
    },
    // Everything a person can take with them, across every coach they've had.
    async forPerson(userId) {
      const out = {};
      for (const area of AREAS) {
        if (area.collection === "clients") continue;
        const rows = await db.all(
          `SELECT t.data, t.seq, t.record_date FROM ${area.table} t JOIN coaching_relationships r ON r.id=t.relationship_id WHERE r.client_user_id=$1`,
          [userId],
        );
        if (area.owner === "client" || ["messages", "payments", "documents"].includes(area.collection))
          out[area.collection] = rows.sort((a, b) => String(a.record_date ?? "").localeCompare(String(b.record_date ?? "")) || Number(a.seq) - Number(b.seq)).map((r) => JSON.parse(r.data));
      }
      return out;
    },
    deleteProfile: (workspaceId, clientId) => db.run("DELETE FROM client_records WHERE workspace_id=$1 AND record_key=$2", [workspaceId, `id:${clientId}`]),
    // The client's profile as their coach last had it.
    async clientRecord(workspaceId, clientId) {
      const row = await db.get("SELECT data FROM client_records WHERE workspace_id=$1 AND record_key=$2", [workspaceId, `id:${clientId}`]);
      return row ? JSON.parse(row.data) : null;
    },
    // The workspace a payment request belongs to, without opening every workspace.
    async workspaceOfPayment(paymentId) {
      return (await db.get("SELECT workspace_id FROM client_payments WHERE record_key=$1", [`id:${paymentId}`]))?.workspace_id ?? null;
    },
  };
}

// The CREATE TABLE statements for every area, used to write the migration files.
export function areaSchema(dialect) {
  const type = { text: "TEXT", int: "INTEGER", real: dialect === "postgres" ? "DOUBLE PRECISION" : "REAL" };
  return AREAS.map(({ table, extra = [] }) =>
    [
      `CREATE TABLE IF NOT EXISTS ${table}(`,
      "  workspace_id TEXT NOT NULL REFERENCES workspaces(id),",
      "  record_key TEXT NOT NULL,",
      "  client_id TEXT,",
      "  relationship_id TEXT REFERENCES coaching_relationships(id) ON DELETE SET NULL,",
      "  record_date TEXT,",
      ...extra.map(([name, kind]) => `  ${name} ${type[kind]},`),
      "  seq INTEGER NOT NULL,",
      "  data TEXT NOT NULL,",
      "  PRIMARY KEY(workspace_id, record_key));",
      `CREATE INDEX IF NOT EXISTS ${table}_client ON ${table}(client_id, record_date);`,
    ].join("\n"),
  ).join("\n\n") + "\nCREATE INDEX IF NOT EXISTS client_payments_key ON client_payments(record_key);\n";
}
