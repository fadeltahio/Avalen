// Connecting WHOOP and Google Health, reading synced recovery/sleep/strain data, and
// the two endpoints a wearable provider calls directly (the OAuth redirect back, and
// WHOOP's webhook) — both reached before any session check.
import { requireClient } from "../permissions.js";
import { NOT_HANDLED, body } from "../http-utils.js";

// Reached by the wearable provider's own site, not by the Avalen app, so there is
// no session cookie to check here.
export function createPublicWearableRoutes(ctx) {
  const { wearables } = ctx;

  return async function handlePublicWearableRoutes(req, res, url) {
    // Wearable OAuth returns arrive from the provider's site, so the SameSite=Strict
    // session cookie is not sent; the single-use state identifies the client.
    const wearableReturn = url.pathname.match(/^\/api\/wearables\/(whoop|google)\/callback$/);
    if (wearableReturn && req.method === "GET") {
      res.writeHead(302, { Location: await wearables.callback(wearableReturn[1], url.searchParams) });
      res.end();
      return;
    }

    if (url.pathname === "/api/wearables/whoop/webhook" && req.method === "POST") {
      await wearables.webhook(await body(req, 65536, true), req.headers);
      res.writeHead(204);
      res.end();
      return;
    }

    return NOT_HANDLED;
  };
}

export function createWearableRoutes(ctx) {
  const { wearables, limit, load } = ctx;

  return async function handleWearableRoutes(req, res, url, user) {
    if (!url.pathname.startsWith("/api/wearables/")) return NOT_HANDLED;
    const part = url.pathname.slice("/api/wearables/".length).split("/");

    if (part[0] === "status" && req.method === "GET") return wearables.status(user, (await load(user)).data);
    if (part[0] === "days" && req.method === "GET")
      return wearables.days(user, (await load(user)).data, url.searchParams.get("clientId") || user.client_id, url.searchParams.get("count"));
    if (part[0] === "summary" && req.method === "GET") return wearables.summary(user, (await load(user)).data);
    if (part[0] === "upload" && req.method === "POST") {
      limit(req, "wearable-upload");
      return wearables.upload(user, await body(req, 65536));
    }
    if (part[0] === "sync" && req.method === "POST") {
      limit(req, "wearable-sync");
      const input = await body(req, 4096);
      const clientId = user.role === "client" ? user.client_id : input.clientId;
      requireClient(user, (await load(user)).data, clientId);
      return wearables.sync(user.workspace_id, clientId, input.provider, 14);
    }
    if (part[1] === "connect" && req.method === "POST") {
      limit(req, "wearable-connect");
      return wearables.start(user, part[0]);
    }
    if (part.length === 1 && req.method === "DELETE")
      return wearables.disconnect(user, part[0], { keepHistory: url.searchParams.get("history") !== "delete" });

    return NOT_HANDLED;
  };
}
