import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { fixture } from "./helpers/service.js";
import { callbackHmac, settle, validCallback, HMAC_FIELDS } from "../server/paymob.js";
import {
  earningsByMonth, formatMoney, lastPeriods, markPaid, monthSummary, paymentChangeError,
  paymentState, recordPayment, requestPayment, toMinor, voidPayment,
} from "../src/avalen/payments-model.js";

const coachData = () => ({ clients: [{ id: "c1", name: "Ali Hassan" }, { id: "c2", name: "Mona Adel" }, { id: "c3", name: "Paused", paused: true }], payments: [] });

test("money converts to Paymob minor units, including three-decimal Omani rials", () => {
  assert.equal(toMinor(2500, "EGP"), 250000);
  assert.equal(toMinor(99.99, "AED"), 9999);
  assert.equal(toMinor(12.345, "OMR"), 12345);
  assert.equal(formatMoney(2500, "EGP"), "2,500 EGP");
  assert.deepEqual(lastPeriods("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
});

test("the month view says who paid, who owes (overdue first) and what was earned", () => {
  const d = coachData();
  requestPayment(d, { clientId: "c1", amount: 2500, currency: "EGP", label: "November coaching", period: "2026-11", dueDate: "2026-11-05" });
  recordPayment(d, { clientId: "c2", amount: 2000, currency: "EGP", label: "November coaching", period: "2026-11", method: "instapay", paidOn: "2026-11-02" });
  recordPayment(d, { clientId: "c2", amount: 1500, currency: "EGP", label: "October coaching", period: "2026-10", method: "cash", paidOn: "2026-10-03" });
  const month = monthSummary(d, "2026-11", "2026-11-10");
  assert.deepEqual(month.earned, { EGP: 2000 });
  assert.deepEqual(month.outstanding, { EGP: 2500 });
  assert.deepEqual(month.rows.map((r) => [r.client.id, r.state]), [["c1", "overdue"], ["c2", "paid"]]);
  assert.equal(month.overdue, 1);
  assert.equal(paymentState(d.payments[0], "2026-11-04"), "due");
  assert.deepEqual(earningsByMonth(d, ["2026-10", "2026-11"]).map((m) => m.totals.EGP), [1500, 2000]);
  voidPayment(d, d.payments[0].id);
  assert.equal(monthSummary(d, "2026-11", "2026-11-10").rows[0].state, "none");
});

test("only the coach edits payments, and nobody but Paymob can confirm one", () => {
  const before = coachData();
  requestPayment(before, { clientId: "c1", amount: 2500, currency: "EGP", label: "Coaching", period: "2026-11", dueDate: "2026-11-25" });
  const prev = before.payments;
  const next = (fn) => { const copy = structuredClone(prev); fn(copy); return copy; };
  assert.match(paymentChangeError(prev, next((p) => { p[0].status = "paid"; p[0].method = "cash"; p[0].paidAt = new Date().toISOString(); }), "client"), /managed by your coach/);
  assert.equal(paymentChangeError(prev, next((p) => markPaid({ payments: p }, p[0].id, "cash", "2026-11-10")), "coach"), null);
  assert.match(paymentChangeError(prev, next((p) => { p[0].verified = true; }), "coach"), /Only Paymob/);
  assert.match(paymentChangeError(prev, next((p) => { p[0].status = "paid"; p[0].method = "paymob"; p[0].paidAt = new Date().toISOString(); }), "coach"), /how it was paid/);
  assert.match(paymentChangeError(prev, [], "coach"), /Void a payment instead/);
  const confirmed = next((p) => Object.assign(p[0], { status: "paid", method: "paymob", verified: true, paidAt: new Date().toISOString(), paymob: { transactionId: "77" } }));
  assert.match(paymentChangeError(confirmed, structuredClone(confirmed).map((p) => ({ ...p, status: "void" })), "coach"), /cannot be changed/);
  const started = next((p) => { p[0].paymob = { attempts: [{ ref: `${p[0].id}.1`, at: "x" }] }; });
  assert.match(paymentChangeError(started, structuredClone(started).map((p) => ({ ...p, amount: 3000 })), "coach"), /started paying/);
});

const callbackObj = (reference, overrides = {}) => ({
  id: 192036465, pending: false, amount_cents: 250000, success: true, is_auth: false, is_capture: false,
  is_standalone_payment: true, is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 4567,
  has_parent_transaction: false, error_occured: false, currency: "EGP", owner: 302852, created_at: "2026-11-12T14:32:10.123456",
  source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
  order: { id: 217503754, merchant_order_id: reference },
  ...overrides,
});

test("callback signatures follow Paymob's field order and reject any change", () => {
  const obj = callbackObj("p.1");
  const hmac = callbackHmac(obj, "secret");
  assert.equal(HMAC_FIELDS.length, 20);
  assert.match(hmac, /^[0-9a-f]{128}$/);
  assert.equal(validCallback(obj, hmac, "secret"), true);
  assert.equal(validCallback(obj, hmac.toUpperCase(), "secret"), true);
  assert.equal(validCallback({ ...obj, amount_cents: 1 }, hmac, "secret"), false);
  assert.equal(validCallback(obj, hmac, "other"), false);
  assert.equal(validCallback(obj, "nope", "secret"), false);
  const payment = { amount: 2500, currency: "EGP", status: "due", paymob: {} };
  assert.equal(settle(payment, obj).kind, "paid");
  assert.equal(settle(payment, { ...obj, success: false }).kind, "failed");
  assert.equal(settle(payment, { ...obj, pending: true }).kind, "failed");
  assert.equal(settle(payment, { ...obj, amount_cents: 100 }).kind, "mismatch");
  assert.equal(settle({ ...payment, paymob: { transactionId: "192036465" } }, obj), null);
});

test("server: coach connects Paymob, client pays, only a signed callback marks it paid", async () => {
  const sent = [];
  const fetchImpl = async (url, options) => {
    sent.push({ url, options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ id: "pi_test_1", intention_order_id: 217503754, client_secret: "egy_csk_test_abc" }), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  const secretsKey = randomBytes(32).toString("base64");
  const f = await fixture({ fetchImpl, publicUrl: "https://coach.example/", secretsKey });
  try {
    const keys = { region: "egypt", publicKey: "egy_pk_test_PUBLIC123", secretKey: "egy_sk_test_SECRET999", hmacSecret: "HMACSECRET777", integrationIds: "4567, 8910" };
    const connected = await f.call("/api/payments/account", { method: "PUT", account: f.coach, body: keys });
    assert.equal(connected.status, 200);
    assert.deepEqual([connected.connected, connected.region, connected.currency, connected.integrations], [true, "egypt", "EGP", [4567, 8910]]);
    assert.ok(!JSON.stringify(connected).includes("SECRET999") && !JSON.stringify(connected).includes("HMACSECRET777"));
    const stored = f.db.prepare("SELECT * FROM payment_accounts").get();
    assert.ok(!JSON.stringify(stored).includes("SECRET999") && !JSON.stringify(stored).includes("HMACSECRET777"), "secrets are sealed at rest");

    const clientId = f.coach.data.clients[0].id;
    const invite = await f.call("/api/invitations", { method: "POST", account: f.coach, body: { clientId } });
    const client = await f.call("/api/join", { method: "POST", body: { invite: invite.invite, email: "client@test.app", password: "client-password-123" } });
    assert.equal(client.status, 200);
    assert.equal(JSON.stringify(client).includes("SECRET999"), false);
    assert.equal((await f.call("/api/payments/account", { account: client })).status, 403);

    const coachNow = await f.call("/api/workspace", { account: f.coach });
    const data = structuredClone(coachNow.data);
    const request = requestPayment(data, { clientId, amount: 2500, currency: "EGP", label: "November coaching", period: "2026-11", dueDate: "2026-11-25" });
    const other = requestPayment(data, { clientId, amount: 1000, currency: "EGP", label: "Extra session", period: "2026-11", dueDate: "2026-11-25" });
    const saved = await f.call("/api/workspace", { method: "PATCH", account: f.coach, body: { revision: coachNow.revision, data } });
    assert.equal(saved.status, 200);

    const clientNow = await f.call("/api/workspace", { account: client });
    assert.equal(clientNow.data.payments.length, 2);
    const forged = structuredClone(clientNow.data);
    Object.assign(forged.payments[0], { status: "paid", method: "cash", paidAt: new Date().toISOString() });
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: client, body: { revision: clientNow.revision, data: forged } })).status, 403);

    assert.equal((await f.call(`/api/payments/${request.id}/checkout`, { method: "POST", account: f.coach, body: {} })).status, 403);
    assert.equal((await f.call(`/api/payments/${request.id}/checkout`, { method: "POST", account: client, body: {} })).status, 400);
    const checkout = await f.call(`/api/payments/${request.id}/checkout`, { method: "POST", account: client, body: { phone: "+201001234567" } });
    assert.equal(checkout.status, 200);
    assert.equal(checkout.url, "https://accept.paymob.com/unifiedcheckout/?publicKey=egy_pk_test_PUBLIC123&clientSecret=egy_csk_test_abc");
    const intent = sent[0];
    assert.equal(intent.url, "https://accept.paymob.com/v1/intention/");
    assert.equal(intent.options.headers.Authorization, "Token egy_sk_test_SECRET999");
    assert.deepEqual([intent.body.amount, intent.body.currency, intent.body.special_reference, intent.body.payment_methods], [250000, "EGP", `${request.id}.1`, [4567, 8910]]);
    assert.equal(intent.body.notification_url, "https://coach.example/api/paymob/callback");
    assert.equal(intent.body.billing_data.phone_number, "+201001234567");

    const post = (obj, hmac) => fetch(`${f.base}/api/paymob/callback?hmac=${hmac}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "TRANSACTION", obj }) });
    const obj = callbackObj(`${request.id}.1`);
    assert.equal((await post(obj, callbackHmac(obj, "wrong-secret"))).status, 401);
    assert.equal((await f.call("/api/workspace", { account: f.coach })).data.payments.find((p) => p.id === request.id).status, "due");
    assert.equal((await post(obj, callbackHmac(obj, "HMACSECRET777"))).status, 200);
    assert.equal((await post(obj, callbackHmac(obj, "HMACSECRET777"))).status, 200, "a retried callback is accepted once");
    const after = await f.call("/api/workspace", { account: f.coach });
    const paid = after.data.payments.find((p) => p.id === request.id);
    assert.deepEqual([paid.status, paid.method, paid.verified, paid.paymob.transactionId, paid.paymob.cardLast4], ["paid", "paymob", true, "192036465", "2346"]);
    assert.equal((await f.call("/api/workspace", { account: client })).data.clients[0].phone, "+201001234567");

    const tampered = structuredClone(after.data);
    tampered.payments.find((p) => p.id === request.id).status = "void";
    assert.equal((await f.call("/api/workspace", { method: "PATCH", account: f.coach, body: { revision: after.revision, data: tampered } })).status, 403);
    assert.equal((await f.call(`/api/payments/${request.id}/checkout`, { method: "POST", account: client, body: {} })).status, 409);

    await f.call(`/api/payments/${other.id}/checkout`, { method: "POST", account: client, body: {} });
    const short = callbackObj(`${other.id}.1`, { id: 555, amount_cents: 100 });
    assert.equal((await post(short, callbackHmac(short, "HMACSECRET777"))).status, 200);
    assert.equal((await f.call("/api/workspace", { account: f.coach })).data.payments.find((p) => p.id === other.id).status, "due", "a mismatched amount never marks a payment paid");
    assert.equal((await post(callbackObj("unknown.1"), "0".repeat(128))).status, 404);
  } finally {
    await f.close();
  }
});
