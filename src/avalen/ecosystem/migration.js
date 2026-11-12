import { getDeviceFile } from "../store.js";
import { request } from "./connection.js";
export function collectDeviceMedia(data) {
  const records = new Map();
  function walk(value, clientId, shared = false) {
    if (!value || typeof value !== "object") return;
    if (value.id && /^(image|audio|video)\//.test(value.type || "")) {
      let item = records.get(value.id);
      if (!item) {
        item = { file: value, clientIds: new Set(), shared: false };
        records.set(value.id, item);
      }
      if (clientId) item.clientIds.add(clientId);
      if (shared) item.shared = true;
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) walk(child, clientId, shared);
      return;
    }
    for (const child of Object.values(value))
      walk(child, value.clientId || clientId, shared);
  }
  for (const client of data.clients) walk(client, client.id);
  for (const [key, value] of Object.entries(data)) {
    if (key === "clients") continue;
    if (["coach", "library", "templates", "posts"].includes(key))
      walk(value, null, true);
    else if (Array.isArray(value))
      for (const row of value) walk(row, row.clientId || null);
    else if (key === "drafts")
      for (const [id, draft] of Object.entries(value)) walk(draft, id);
  }
  return [...records.values()].map((r) => ({
    ...r,
    clientIds: [...r.clientIds],
  }));
}
export async function migrateDeviceMedia(data, onProgress) {
  const files = collectDeviceMedia(data),
    failed = [];
  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    onProgress?.(`${i + 1} / ${files.length} recordings and images`);
    try {
      const blob = await getDeviceFile(item.file.id);
      if (!blob)
        throw new Error("Original file is missing from device storage.");
      await request("/media", {
        method: "POST",
        body: blob,
        headers: {
          "Content-Type": blob.type,
          "X-Client-Id": item.clientIds[0] || data.activeClientId,
          "X-Import-Id": item.file.id,
          "X-Media-Clients": JSON.stringify(item.clientIds),
          "X-Media-Scope": item.shared ? "workspace" : "client",
          "X-File-Name": encodeURIComponent(item.file.name || "Imported file"),
        },
      });
    } catch (e) {
      failed.push({ name: item.file.name || item.file.id, error: e.message });
    }
  }
  return { total: files.length, failed };
}
