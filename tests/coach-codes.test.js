import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers/service.js";
import { formatCode, normalizeCode } from "../server/coach-codes.js";

const password = "strong-password-123";

test("codes are typed forgivingly and shown in two halves", () => {
  assert.equal(normalizeCode(" abc-23x "), "ABC23X");
  assert.equal(formatCode("ABC23X"), "ABC-23X");
});

test("a new coach gets an empty workspace and a code; a client joins with it", async () => {
  const f = await fixture();
  try {
    const coach = await f.call("/api/signup/coach", { method: "POST", body: { name: "Sara Coach", email: "Sara@Example.com", password } });
    assert.equal(coach.status, 200);
    assert.equal(coach.user.role, "coach");
    assert.equal(coach.data.clients.length, 0);
    assert.equal(coach.data.coach.name, "Sara Coach");
    assert.equal(coach.data.demo, false);

    const { code } = await f.call("/api/coach-code", { account: coach });
    assert.match(code, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    assert.equal((await f.call("/api/coach-code", { account: coach })).code, code, "the same code until it is replaced");

    // The original single-owner coach has a different code; codes never cross workspaces.
    const owner = await f.call("/api/coach-code", { account: f.coach });
    assert.notEqual(owner.code, code);

    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Omar Client", email: "omar@example.com", password, code: code.toLowerCase().replace("-", " ") } });
    assert.equal(client.status, 200);
    assert.equal(client.user.role, "client");
    const fresh = await f.call("/api/workspace", { account: coach });
    assert.equal(fresh.data.clients.length, 1);
    assert.equal(fresh.data.clients[0].name, "Omar Client");
    assert.equal(fresh.data.clients[0].id, client.user.clientId);
    assert.ok(fresh.data.timeline.some((e) => e.clientId === client.user.clientId && e.title === "Joined with your coach code"));
    // The client sees only their own record.
    assert.equal(client.data.clients.length, 1);
    assert.equal((await f.call("/api/workspace", { account: f.coach })).data.clients.some((c) => c.name === "Omar Client"), false);
  } finally { await f.close(); }
});

test("wrong codes, taken emails and missing names are refused without creating anything", async () => {
  const f = await fixture();
  try {
    const coach = await f.call("/api/signup/coach", { method: "POST", body: { name: "Sara", email: "sara@example.com", password } });
    const { code } = await f.call("/api/coach-code", { account: coach });
    const bad = await f.call("/api/signup/client", { method: "POST", body: { name: "X", email: "x@example.com", password, code: "ZZZ-ZZZ" } });
    assert.equal(bad.status, 404);
    assert.equal((await f.call("/api/signup/client", { method: "POST", body: { name: "", email: "y@example.com", password, code } })).status, 400);
    assert.equal((await f.call("/api/signup/client", { method: "POST", body: { name: "Y", email: "sara@example.com", password, code } })).status, 409);
    assert.equal((await f.call("/api/signup/coach", { method: "POST", body: { name: "Again", email: "SARA@example.com", password } })).status, 409);
    assert.equal((await f.call("/api/workspace", { account: coach })).data.clients.length, 0);
    // A client cannot read or replace a coach code.
    const client = await f.call("/api/signup/client", { method: "POST", body: { name: "Z", email: "z@example.com", password, code } });
    assert.equal((await f.call("/api/coach-code", { account: client })).status, 403);
    assert.equal((await f.call("/api/coach-code/replace", { method: "POST", account: client })).status, 403);
  } finally { await f.close(); }
});

test("a replaced code stops working; clients who joined stay connected", async () => {
  const f = await fixture();
  try {
    const coach = await f.call("/api/signup/coach", { method: "POST", body: { name: "Sara", email: "sara@example.com", password } });
    const first = (await f.call("/api/coach-code", { account: coach })).code;
    const joined = await f.call("/api/signup/client", { method: "POST", body: { name: "A", email: "a@example.com", password, code: first } });
    const second = (await f.call("/api/coach-code/replace", { method: "POST", account: coach })).code;
    assert.notEqual(second, first);
    assert.equal((await f.call("/api/signup/client", { method: "POST", body: { name: "B", email: "b@example.com", password, code: first } })).status, 404);
    assert.equal((await f.call("/api/signup/client", { method: "POST", body: { name: "C", email: "c@example.com", password, code: second } })).status, 200);
    assert.equal((await f.call("/api/workspace", { account: joined })).status, 200);
    assert.equal((await f.call("/api/workspace", { account: coach })).data.clients.length, 2);
  } finally { await f.close(); }
});

test("coach sign-up can be closed for a single-coach service", async () => {
  const f = await fixture({ coachSignup: false });
  try {
    assert.equal((await f.call("/api/status")).coachSignup, false);
    assert.equal((await f.call("/api/signup/coach", { method: "POST", body: { name: "S", email: "s@example.com", password } })).status, 403);
  } finally { await f.close(); }
});

test("deleting a coach account removes its code", async () => {
  const f = await fixture();
  try {
    const coach = await f.call("/api/signup/coach", { method: "POST", body: { name: "Sara", email: "sara@example.com", password } });
    const { code } = await f.call("/api/coach-code", { account: coach });
    const deleted = await f.call("/api/account/delete", { method: "POST", account: coach, body: { password, confirm: "DELETE" } });
    assert.equal(deleted.status, 200, JSON.stringify(deleted));
    assert.equal((await f.call("/api/signup/client", { method: "POST", body: { name: "A", email: "a@example.com", password, code } })).status, 404);
  } finally { await f.close(); }
});
