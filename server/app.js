// The Avalen HTTP service. This file only does three things: build the shared
// server context, run each request through the right group of route handlers in
// order, and serve the built web app for everything that isn't an API call. All of
// the actual route logic lives in server/routes/*.js, grouped by topic; server/
// context.js builds the database connection and the handful of primitives every
// route needs (the signed-in user, committing a workspace change, finding a media
// file). See docs/ARCHITECTURE.md for how this fits together.
import http from "node:http";
import { fail } from "./permissions.js";
import { createContext } from "./context.js";
import { NOT_HANDLED, body, serveStatic } from "./http-utils.js";
import { createOpenAccountRoutes, createAccountRoutes } from "./routes/accounts.js";
import { createWorkspaceRoutes } from "./routes/workspace.js";
import { createMediaRoutes } from "./routes/media.js";
import { createPublicPaymentRoutes, createPaymentRoutes } from "./routes/payments.js";
import { createPublicWearableRoutes, createWearableRoutes } from "./routes/wearables.js";
import { createCoachingRoutes } from "./routes/coaching.js";

export { body };

export async function createService(options = {}) {
  const ctx = await createContext(options);

  // Reached directly by an outside service (Paymob, a wearable provider), before any
  // Avalen session cookie or CSRF check applies to the request.
  const publicRoutes = [createPublicPaymentRoutes(ctx), createPublicWearableRoutes(ctx)];

  // Reached without a signed-in session: checking the service and every way of
  // getting one (sign in, sign up, accept an invitation).
  const openRoutes = [createOpenAccountRoutes(ctx)];

  // Everything else, reached only once ctx.authenticate confirms who is asking.
  const protectedRoutes = [
    createAccountRoutes(ctx),
    createPaymentRoutes(ctx),
    createWearableRoutes(ctx),
    createWorkspaceRoutes(ctx),
    createCoachingRoutes(ctx),
    createMediaRoutes(ctx),
  ];

  async function tryRoutes(routes, req, res, url, user) {
    for (const handler of routes) {
      const result = await handler(req, res, url, user);
      if (result !== NOT_HANDLED) return result;
    }
    return NOT_HANDLED;
  }

  async function route(req, res) {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");

    if (!url.pathname.startsWith("/api/")) return serveStatic(url, res, ctx.dist);

    const fromPublic = await tryRoutes(publicRoutes, req, res, url);
    if (fromPublic !== NOT_HANDLED) return fromPublic;

    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) fail(403, "Cross-site requests are not allowed.");
      if (req.headers["x-avalen"] !== "1") fail(403, "Use the Avalen app for this action.");
    }

    const fromOpen = await tryRoutes(openRoutes, req, res, url);
    if (fromOpen !== NOT_HANDLED) return fromOpen;

    const user = await ctx.authenticate(req);
    const fromProtected = await tryRoutes(protectedRoutes, req, res, url, user);
    if (fromProtected !== NOT_HANDLED) return fromProtected;

    fail(404, "Not found.");
  }

  const server = http.createServer((req, res) => {
    route(req, res)
      .then((result) => {
        if (result !== undefined && !res.writableEnded) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        }
      })
      .catch((error) => {
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.writeHead(error.status || 500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.status ? error.message : "The service could not complete this request. Try again." }));
        if (!error.status) console.error(error);
      });
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;

  return {
    server,
    store: ctx.store,
    files: ctx.files,
    db: ctx.db,
    root: ctx.root,
    bootstrap: ctx.bootstrap,
    load: ctx.load,
    commit: ctx.commit,
    permittedMedia: ctx.permittedMedia,
    wearables: ctx.wearables,
    setCommandHandler: ctx.setCommandHandler,
  };
}
