// Paymob card payments: the coach's connection settings, a client paying a request,
// and the two endpoints Paymob itself calls (its server-to-server confirmation and
// the browser redirect back after checkout) — both reached before any session check.
import { coachOnly, fail } from "../permissions.js";
import { settle, validPhone } from "../paymob.js";
import { NOT_HANDLED, body } from "../http-utils.js";

// Paymob's server-to-server confirmation. Matches the attempt reference to a
// payment, checks the coach's HMAC signature, then settles exactly once.
async function paymobCallback(ctx, req, url) {
  const { store, paymob, commit } = ctx;
  const input = await body(req, 256 * 1024);
  const obj = input && typeof input === "object" ? input.obj : null;
  const reference = String(obj?.order?.merchant_order_id ?? obj?.merchant_order_id ?? "");
  const paymentId = reference.split(".")[0];
  let found = null;
  if (/^[\w-]{1,100}\.\d{1,3}$/.test(reference))
    for (const row of await store.workspaces.all()) {
      const payment = (row.data.payments || []).find((p) => p.id === paymentId && p.paymob?.attempts?.some((a) => a.ref === reference));
      if (payment) { found = { workspace: row.id, payment }; break; }
    }
  if (!found) fail(404, "Unknown payment.");
  if (!(await paymob.verify(found.workspace, obj, url.searchParams.get("hmac")))) fail(401, "Invalid signature.");
  const change = settle(found.payment, obj);
  if (!change) return { ok: true };
  await commit({ id: "paymob", role: "system", workspace_id: found.workspace }, undefined, (d) => {
    const record = d.payments.find((p) => p.id === paymentId);
    if (!record || record.paymob?.transactionId === change.transactionId) return d;
    if (change.kind === "paid")
      Object.assign(record, {
        status: "paid",
        method: "paymob",
        verified: true,
        paidAt: change.at,
        paymob: { ...record.paymob, transactionId: change.transactionId, orderId: change.orderId, cardLast4: change.cardLast4, previousStatus: change.previousStatus },
      });
    else
      record.paymob = {
        ...record.paymob,
        attempts: record.paymob.attempts.map((a) => (a.ref === reference ? { ...a, [change.kind === "failed" ? "failedAt" : "mismatchAt"]: change.at, transaction: change.transactionId } : a)),
      };
    return d;
  });
  return { ok: true };
}

// Reached directly by Paymob, before the signed-in session is known.
export function createPublicPaymentRoutes(ctx) {
  return async function handlePublicPaymentRoutes(req, res, url) {
    if (url.pathname === "/api/paymob/callback" && req.method === "POST")
      return paymobCallback(ctx, req, url);

    if (url.pathname === "/api/paymob/return" && req.method === "GET") {
      const id = url.searchParams.get("payment") || "";
      res.writeHead(302, { Location: `/#/client/you?tab=Payments${/^[\w-]{1,100}$/.test(id) ? `&returned=${encodeURIComponent(id)}` : ""}` });
      res.end();
      return;
    }

    return NOT_HANDLED;
  };
}

// The coach's own payment settings, and a client paying a request.
export function createPaymentRoutes(ctx) {
  const { paymob, limit, load, commit } = ctx;

  return async function handlePaymentRoutes(req, res, url, user) {
    if (url.pathname === "/api/payments/account") {
      coachOnly(user);
      if (req.method === "GET") return paymob.status(user.workspace_id);
      if (req.method === "PUT") return paymob.connect(user.workspace_id, await body(req, 8192));
      if (req.method === "DELETE") return paymob.disconnect(user.workspace_id);
    }

    const checkout = url.pathname.match(/^\/api\/payments\/([\w-]{1,100})\/checkout$/);
    if (checkout && req.method === "POST") {
      if (user.role !== "client") fail(403, "Only the client can pay a payment request.");
      limit(req, "checkout");
      const input = await body(req, 4096);
      const { data } = await load(user);
      const payment = data.payments.find((p) => p.id === checkout[1]);
      if (!payment || payment.clientId !== user.client_id) fail(404, "This payment request isn’t available.");
      if (payment.status !== "due")
        fail(409, payment.status === "paid" ? "This payment is already paid." : "Your coach cancelled this payment request.");
      const client = data.clients.find((c) => c.id === user.client_id);
      const phone = (typeof input.phone === "string" && input.phone.trim()) || client.phone || "";
      if (!validPhone(phone)) fail(400, "Add your mobile number. Paymob needs it to process the payment.");
      const attempt = (payment.paymob?.attempts?.length || 0) + 1;
      if (attempt > 20) fail(429, "Too many payment attempts for this request. Ask your coach to send a new one.");
      const reference = `${payment.id}.${attempt}`;
      const intention = await paymob.createIntention(user.workspace_id, {
        payment,
        client: { name: client.name, email: client.email || user.email },
        reference,
        phone,
      });
      await commit(user, undefined, (d) => {
        const record = d.payments.find((p) => p.id === payment.id);
        record.paymob = {
          ...(record.paymob || {}),
          attempts: [...(record.paymob?.attempts || []), { ref: reference, at: new Date().toISOString(), intentionId: intention.intentionId, orderId: intention.orderId }],
        };
        const person = d.clients.find((c) => c.id === user.client_id);
        if (!person.phone) person.phone = phone.trim();
        return d;
      });
      return { url: intention.url };
    }

    return NOT_HANDLED;
  };
}
