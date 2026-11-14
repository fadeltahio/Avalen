// Password reset by emailed code, against the real server and database. Email goes to a
// stand-in for Resend that records each message instead of sending it.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers/service.js";

const emailEnv = { AVALEN_EMAIL_API_KEY: "re_test_key", AVALEN_EMAIL_FROM: "Avalen <no-reply@avalen.test>" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Records what the server asks Resend to send; `fail` makes Resend refuse.
function fakeResend() {
  const sent = [];
  const state = { fail: false };
  const fetchImpl = async (url, init = {}) => {
    if (String(url) !== "https://api.resend.com/emails") return globalThis.fetch(url, init);
    sent.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return state.fail ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({ id: `email_${sent.length}` }), { status: 200 });
  };
  const waitFor = async (n) => {
    for (let i = 0; i < 50 && sent.length < n; i++) await sleep(20);
    return sent;
  };
  return { sent, state, fetchImpl, waitFor };
}
const codeIn = (message) => /\b(\d{6})\b/.exec(message.body.text)?.[1];
const forgot = (f, email) => f.call("/api/password/forgot", { method: "POST", body: { email } });
const reset = (f, email, code, password) => f.call("/api/password/reset", { method: "POST", body: { email, code, password } });
const signIn = (f, email, password) => f.call("/api/login", { method: "POST", body: { email, password } });

test("without an email service, the app isn't offered password reset and the server refuses it", async () => {
  const f = await fixture({ emailEnv: {} });
  try {
    assert.equal((await f.call("/api/status")).passwordReset, false);
    const res = await forgot(f, "coach@test.app");
    assert.equal(res.status, 503);
    assert.match(res.error, /isn’t set up/);
  } finally {
    await f.close();
  }
});

test("a reset code is emailed through Resend, the reply is the same for unknown emails, and only a hash is stored", async () => {
  const email = fakeResend();
  const f = await fixture({ emailEnv, fetchImpl: email.fetchImpl });
  try {
    assert.equal((await f.call("/api/status")).passwordReset, true);
    const known = await forgot(f, "Coach@Test.app");
    assert.equal(known.status, 200);
    const [message] = await email.waitFor(1);
    assert.equal(message.headers.Authorization, "Bearer re_test_key");
    assert.equal(message.body.from, "Avalen <no-reply@avalen.test>");
    assert.deepEqual(message.body.to, ["coach@test.app"]);
    assert.match(message.body.subject, /password reset code/);
    const code = codeIn(message);
    assert.match(code, /^\d{6}$/);
    assert.match(message.body.html, new RegExp(code));

    const unknown = await forgot(f, "nobody@test.app");
    assert.deepEqual({ status: unknown.status, message: unknown.message }, { status: known.status, message: known.message }, "no hint whether the account exists");
    await sleep(100);
    assert.equal(email.sent.length, 1, "nothing is sent for an unknown email");

    const rows = await f.db.all("SELECT code_hash FROM password_resets");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].code_hash.includes(code), false, "the code itself isn't stored");
    assert.equal((await forgot(f, "not-an-email")).status, 400);
  } finally {
    await f.close();
  }
});

test("the right code sets the new password once, signs out every device and sends a confirmation", async () => {
  const email = fakeResend();
  const f = await fixture({ emailEnv, fetchImpl: email.fetchImpl });
  try {
    const before = await signIn(f, "coach@test.app", "strong-password-123");
    assert.equal((await f.call("/api/workspace", { account: before })).status, 200);
    await forgot(f, "coach@test.app");
    const code = codeIn((await email.waitFor(1))[0]);
    const wrong = code === "000000" ? "111111" : "000000";

    assert.equal((await reset(f, "coach@test.app", wrong, "brand-new-password-1")).status, 400);
    assert.equal((await reset(f, "coach@test.app", code, "short")).status, 400, "a short password is refused");
    const done = await reset(f, "coach@test.app", code, "brand-new-password-1");
    assert.equal(done.status, 200, done.error);

    assert.equal((await f.call("/api/workspace", { account: before })).status, 401, "the earlier session no longer works");
    assert.equal((await signIn(f, "coach@test.app", "strong-password-123")).status, 401, "the old password no longer works");
    assert.equal((await signIn(f, "coach@test.app", "brand-new-password-1")).status, 200, "the new one does");
    assert.equal((await reset(f, "coach@test.app", code, "another-password-22")).status, 400, "a code works once");
    const sent = await email.waitFor(2);
    assert.match(sent[1].body.subject, /password was changed/);
  } finally {
    await f.close();
  }
});

test("five wrong guesses end a code, an expired code is refused, and a new request replaces the old code", async () => {
  const email = fakeResend();
  const f = await fixture({ emailEnv, fetchImpl: email.fetchImpl });
  try {
    await forgot(f, "coach@test.app");
    const first = codeIn((await email.waitFor(1))[0]);
    const wrong = first === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) assert.equal((await reset(f, "coach@test.app", wrong, "brand-new-password-1")).status, 400);
    assert.equal((await reset(f, "coach@test.app", first, "brand-new-password-1")).status, 400, "the right code no longer works after 5 wrong guesses");

    await forgot(f, "coach@test.app");
    const second = codeIn((await email.waitFor(2))[1]);
    await forgot(f, "coach@test.app");
    const third = codeIn((await email.waitFor(3))[2]);
    if (second !== third) assert.equal((await reset(f, "coach@test.app", second, "brand-new-password-1")).status, 400, "an earlier code stops working");
    await f.db.run("UPDATE password_resets SET expires=$1", [Date.now() - 1000]);
    assert.equal((await reset(f, "coach@test.app", third, "brand-new-password-1")).status, 400, "an expired code is refused");
    assert.equal((await signIn(f, "coach@test.app", "strong-password-123")).status, 200, "the password is unchanged");
  } finally {
    await f.close();
  }
});

test("at most 3 codes an hour are emailed per account, and a failing email service doesn't break the reply", async () => {
  const email = fakeResend();
  const f = await fixture({ emailEnv, fetchImpl: email.fetchImpl });
  try {
    for (let i = 0; i < 4; i++) assert.equal((await forgot(f, "coach@test.app")).status, 200);
    await sleep(150);
    assert.equal(email.sent.length, 3);

    email.state.fail = true;
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    await f.call("/api/signup/client", { method: "POST", body: { name: "Maya", email: "maya@test.app", password: "client-password-123", code } });
    const res = await forgot(f, "maya@test.app");
    assert.equal(res.status, 200, "the reply doesn't reveal a sending failure");
    await email.waitFor(4);
    assert.equal(email.sent.length, 4, "the server did try");
    assert.equal((await f.call("/api/status")).status, 200, "and keeps running");
  } finally {
    await f.close();
  }
});

test("deleting an account deletes its reset codes", async () => {
  const email = fakeResend();
  const f = await fixture({ emailEnv, fetchImpl: email.fetchImpl });
  try {
    const { code } = await f.call("/api/coach-code", { account: f.coach });
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Maya", email: "maya@test.app", password: "client-password-123", code } });
    await forgot(f, "maya@test.app");
    await email.waitFor(1);
    assert.equal(Number((await f.db.get("SELECT COUNT(*) AS n FROM password_resets WHERE user_id=$1", [client.user.id])).n), 1);
    const deleted = await f.call("/api/account/delete", { method: "POST", account: client, body: { confirm: "DELETE", password: "client-password-123" } });
    assert.equal(deleted.status, 200, deleted.error);
    assert.equal(Number((await f.db.get("SELECT COUNT(*) AS n FROM password_resets WHERE user_id=$1", [client.user.id])).n), 0);
  } finally {
    await f.close();
  }
});
