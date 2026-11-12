import { equal } from "../src/avalen/ecosystem/memory.js";
import { fail } from "./permissions.js";
const fileFields = new Set([
  "file",
  "audio",
  "photo",
  "logo",
  "coverFile",
  "videoFile",
  "imageFile",
  "thumbnail",
  "responseAudio",
]);
export function validateMediaChanges(
  before,
  after,
  user,
  lookup,
  hasGrant = () => false,
) {
  function walk(value, clientId, key = "") {
    if (!value || typeof value !== "object") return;
    if (
      value.id &&
      (fileFields.has(key) ||
        /^(image|audio|video)\//.test(value.type || "") ||
        value.type === "application/pdf")
    ) {
      const file = lookup(user, value.id);
      if (
        file.client_id !== "workspace" &&
        (!clientId ||
          (file.client_id !== clientId && !hasGrant(file.id, clientId)))
      )
        fail(403, "This file is not assigned to the selected client.");
      return;
    }
    if (Array.isArray(value)) {
      for (const row of value) walk(row, clientId, key);
      return;
    }
    for (const [field, child] of Object.entries(value))
      walk(child, value.clientId || clientId, field);
  }
  for (const [key, value] of Object.entries(after)) {
    if (
      equal(value, before[key]) ||
      ["timeline", "revisions", "insightDecisions", "notifications"].includes(
        key,
      )
    )
      continue;
    if (Array.isArray(value)) {
      for (const row of value) {
        if (!row || typeof row !== "object") continue;
        const old = (before[key] || []).find((r) =>
          row.id
            ? r.id === row.id
            : r.clientId === row.clientId && r.date === row.date,
        );
        if (!equal(row, old))
          walk(row, key === "clients" ? row.id : row.clientId || null, key);
      }
    } else if (key === "drafts") {
      for (const [id, draft] of Object.entries(value))
        if (!equal(draft, before.drafts[id])) walk(draft, id);
    } else walk(value, null, key);
  }
}
