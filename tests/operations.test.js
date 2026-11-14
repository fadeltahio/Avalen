// What a host and an on-call person rely on: the health endpoint, structured request
// logs that hold no personal data, and the security headers and cookie settings.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, testingPostgres } from "./helpers/service.js";

test("the health endpoint reports the database and, on request, file storage", async () => {
  const f = await fixture();
  try {
    const res = await fetch(`${f.base}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.deepEqual(body.checks, { database: "ok" }, "the host's check covers the database only");
    assert.equal(body.database, testingPostgres ? "postgres" : "sqlite");
    const original = f.files.check;
    f.files.check = async () => { throw new Error("bucket unreachable"); };
    try {
      const down = await fetch(`${f.base}/api/health?deep=1`);
      assert.equal(down.status, 503);
      assert.deepEqual((await down.json()).checks, { database: "ok", storage: "unavailable" });
      assert.equal((await fetch(`${f.base}/api/health`)).status, 200, "a storage outage doesn't fail the host's check");
    } finally {
      f.files.check = original;
    }
    const deep = await (await fetch(`${f.base}/api/health?deep=1`)).json();
    assert.deepEqual(deep.checks, { database: "ok", storage: "ok" }, "recovery shows on the next check");
    assert.equal((await fetch(`${f.base}/api/health`, { method: "HEAD" })).status, 200);
    assert.equal(JSON.stringify(deep).match(/coach@test\.app|password|secret/i), null, "nothing personal or secret");
  } finally {
    await f.close();
  }
});

test("request logs are one JSON line per request, without query strings or account details", async () => {
  const f = await fixture({ logRequests: true });
  const lines = [];
  const write = process.stdout.write;
  process.stdout.write = (chunk, ...rest) => {
    if (String(chunk).startsWith("{")) lines.push(String(chunk));
    return write.call(process.stdout, chunk, ...rest);
  };
  try {
    await f.call("/api/login", { method: "POST", body: { email: "coach@test.app", password: "strong-password-123" } });
    const res = await fetch(`${f.base}/api/paymob/return?id=123&secret=abc`, { headers: { "X-Request-Id": "req-abc-123" } });
    assert.equal(res.headers.get("x-request-id"), "req-abc-123");
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    process.stdout.write = write;
    await f.close();
  }
  const entries = lines.join("").trim().split("\n").map((l) => JSON.parse(l)).filter((e) => e.msg === "request");
  const login = entries.find((e) => e.path === "/api/login");
  assert.ok(login, "the sign-in request was logged");
  assert.deepEqual(Object.keys(login).sort(), ["level", "method", "ms", "msg", "path", "requestId", "status", "time"]);
  const ret = entries.find((e) => e.requestId === "req-abc-123");
  assert.equal(ret.path, "/api/paymob/return", "the query string is left out");
  assert.equal(lines.join("").includes("coach@test.app"), false, "no email address in the logs");
  assert.equal(lines.join("").includes("secret=abc"), false);
});

test("malformed addresses get 400, not a server error", async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(`${f.base}/%E0%A4%A`)).status, 400);
    const job = await f.call("/api/jobs/%E0%A4%A", { account: f.coach });
    assert.equal(job.status, 404);
  } finally {
    await f.close();
  }
});

test("outside HTTPS-only mode there is no HSTS and cookies aren't marked Secure", async () => {
  const f = await fixture();
  try {
    const res = await fetch(`${f.base}/api/login`, { method: "POST", headers: { "X-Avalen": "1", "Content-Type": "application/json" }, body: JSON.stringify({ email: "coach@test.app", password: "strong-password-123" }) });
    assert.equal(res.headers.get("strict-transport-security"), null);
    assert.doesNotMatch(res.headers.get("set-cookie"), /Secure/);
  } finally {
    await f.close();
  }
});

test("in production, cookies are HTTPS-only and HSTS is sent, without extra settings", { skip: !testingPostgres && "production needs PostgreSQL" }, async () => {
  const fileEnv = { AVALEN_R2_BUCKET: "b", AVALEN_R2_ENDPOINT: "https://r2.invalid", AVALEN_R2_ACCESS_KEY_ID: "k", AVALEN_R2_SECRET_ACCESS_KEY: "s" };
  const f = await fixture({ production: true, fileEnv, logRequests: false });
  try {
    const res = await fetch(`${f.base}/api/login`, { method: "POST", headers: { "X-Avalen": "1", "Content-Type": "application/json" }, body: JSON.stringify({ email: "coach@test.app", password: "strong-password-123" }) });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("set-cookie"), /HttpOnly; SameSite=Strict; Path=\/; Max-Age=604800; Secure/);
    assert.equal(res.headers.get("strict-transport-security"), "max-age=31536000");
    const health = await (await fetch(`${f.base}/api/health`)).json();
    assert.equal(health.database, "postgres");
    assert.equal(health.storage, "r2");
  } finally {
    await f.close();
  }
});
