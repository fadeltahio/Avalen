// A production server must never start half-configured: no silent SQLite, no local
// file storage, no missing secrets, and the reason is printed by name without values.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configProblems, assertProductionConfig } from "../server/config.js";
import { openStore } from "../server/store/index.js";
import { openFiles } from "../server/files/index.js";
import { createService } from "../server/app.js";

const secrets = {
  DATABASE_URL: "postgresql://avalen:db-password-value@dpg-internal-a:5432/avalen",
  AVALEN_SECRETS_KEY: Buffer.alloc(32, 9).toString("base64"),
  AVALEN_R2_BUCKET: "avalen-staging",
  AVALEN_R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  AVALEN_R2_ACCESS_KEY_ID: "access-key-id-value",
  AVALEN_R2_SECRET_ACCESS_KEY: "secret-access-key-value",
  AVALEN_PUBLIC_URL: "https://api.avalen.example",
  AVALEN_SETUP_TOKEN: "setup-token-value-that-is-long-enough-123",
  AVALEN_CLIENT_IP_HEADER: "cf-connecting-ip",
};
const production = (overrides = {}) => ({ NODE_ENV: "production", ...secrets, ...overrides });

test("outside production nothing is required", () => {
  assert.deepEqual(configProblems({}), []);
  assert.deepEqual(configProblems({ NODE_ENV: "development" }), []);
});

test("a complete production configuration passes", () => {
  assert.deepEqual(configProblems(production()), []);
  assert.deepEqual(configProblems(production({ AVALEN_CLIENT_IP_HEADER: "", AVALEN_TRUST_PROXY: "true" })), []);
});

test("every missing or invalid production setting is named, and no value is ever printed", () => {
  for (const name of Object.keys(secrets)) {
    const problems = configProblems(production({ [name]: "" }));
    assert.equal(problems.length, 1, `${name}: ${problems}`);
    assert.match(problems[0], new RegExp(`^${name} is not set`));
  }
  const invalid = {
    DATABASE_URL: "sqlite:///data/avalen.sqlite",
    AVALEN_SECRETS_KEY: "too-short",
    AVALEN_R2_ENDPOINT: "http://account.r2.cloudflarestorage.com",
    AVALEN_PUBLIC_URL: "http://api.avalen.example",
    AVALEN_SETUP_TOKEN: "short",
  };
  for (const [name, value] of Object.entries(invalid))
    assert.match(configProblems(production({ [name]: value })).join("\n"), new RegExp(`^${name} is not valid`), name);
  assert.match(configProblems(production({ DATABASE_URL: "postgresql://dpg-internal-a:5432/avalen" })).join(), /DATABASE_URL is not valid/, "credentials are required");
  assert.match(configProblems(production({ AVALEN_PUBLIC_URL: "https://api.avalen.example/app" })).join(), /AVALEN_PUBLIC_URL is not valid/, "an origin, not a path");
  assert.match(configProblems(production({ AVALEN_SECURE_COOKIE: "false" })).join(), /AVALEN_SECURE_COOKIE/);
  assert.match(configProblems(production({ AVALEN_CLIENT_IP_HEADER: "" })).join(), /AVALEN_CLIENT_IP_HEADER is not set/);
  assert.match(configProblems(production({ AVALEN_DB_POOL_MAX: "500" })).join(), /AVALEN_DB_POOL_MAX/);

  const everything = configProblems({ NODE_ENV: "production" });
  assert.equal(everything.length, 9, "all problems are listed together");
  const broken = Object.fromEntries(Object.entries(invalid).map(([k, v]) => [k, v]));
  const error = (() => { try { assertProductionConfig(production(broken)); } catch (e) { return e; } })();
  assert.ok(error, "throws");
  for (const value of [...Object.values(secrets), ...Object.values(invalid)])
    assert.equal(error.message.includes(value), false, `the message doesn't contain "${value}"`);
});

test("in production the storage layer refuses to fall back to SQLite or the local folder", async () => {
  const root = mkdtempSync(join(tmpdir(), "avalen-config-"));
  try {
    await assert.rejects(openStore(root, { production: true }), /PostgreSQL is required in production/);
    assert.throws(() => openFiles({ mediaRoot: join(root, "media"), env: {}, production: true }), /Private file storage is required in production/);
    await assert.rejects(createService({ root, production: true, databaseUrl: "" }), /PostgreSQL is required in production/);
    assert.deepEqual(readdirSync(root), [], "nothing was written to the data folder");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the real server exits at once with a readable list when production settings are missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "avalen-config-"));
  try {
    const env = { PATH: process.env.PATH, NODE_ENV: "production", AVALEN_DATA_DIR: dir, PORT: "0", AVALEN_R2_SECRET_ACCESS_KEY: "secret-access-key-value", AVALEN_SETUP_TOKEN: "short" };
    const started = Date.now();
    const run = spawnSync(process.execPath, ["server/index.js"], { env, encoding: "utf8", timeout: 15000 });
    assert.equal(run.status, 1);
    assert.ok(Date.now() - started < 10000);
    assert.match(run.stderr, /production configuration is incomplete/);
    for (const name of ["DATABASE_URL", "AVALEN_SECRETS_KEY", "AVALEN_R2_BUCKET", "AVALEN_PUBLIC_URL", "AVALEN_SETUP_TOKEN", "AVALEN_CLIENT_IP_HEADER"]) assert.match(run.stderr, new RegExp(name));
    assert.equal(run.stderr.includes("secret-access-key-value"), false, "no value is printed");
    assert.deepEqual(readdirSync(dir), [], "no SQLite file or media folder was created");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
