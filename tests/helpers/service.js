import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { createService } from "../../server/app.js";
import { command } from "../../src/avalen/ecosystem/actions.js";

// AVALEN_TEST_DB=postgres (set by `pnpm test:postgres`) gives every fixture its own
// empty PostgreSQL database on the throwaway server; otherwise a SQLite file.
export const testingPostgres = process.env.AVALEN_TEST_DB === "postgres";
async function freshDatabase() {
  if (!testingPostgres) return { url: undefined, drop: async () => {} };
  if (!process.env.DATABASE_URL) throw new Error("AVALEN_TEST_DB=postgres needs DATABASE_URL (run through tools/with-postgres.mjs).");
  const name = `test_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await client.end();
    },
  };
}

export async function fixture(options = {}) {
  const database = await freshDatabase();
  const root = mkdtempSync(join(tmpdir(), "avalen-test-")),
    service = await createService({ root, setupToken: "test-owner-token", databaseUrl: database.url, ...options });
  service.setCommandHandler(command);
  await new Promise((resolve) =>
    service.server.listen(0, "127.0.0.1", resolve),
  );
  const base = `http://127.0.0.1:${service.server.address().port}`;
  async function call(
    path,
    { account, method = "GET", body, headers = {} } = {},
  ) {
    const res = await fetch(base + path, {
      method,
      headers: {
        "X-Avalen": "1",
        "Idempotency-Key": crypto.randomUUID(),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(account
          ? { Cookie: account.cookie, "X-CSRF-Token": account.csrf }
          : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await res.json();
    return {
      ...value,
      status: res.status,
      cookie: res.headers.get("set-cookie")?.split(";")[0] || account?.cookie,
    };
  }
  const coach = await call("/api/setup", {
    method: "POST",
    body: {
      setupToken: "test-owner-token",
      email: "coach@test.app",
      password: "strong-password-123",
      name: "Coach",
      clientName: "Client One",
    },
  });
  return {
    ...service,
    base,
    call,
    coach,
    close: async () => {
      // close() alone waits on every socket, including one a browser opened and never used.
      const closed = new Promise((resolve) => service.server.close(resolve));
      service.server.closeAllConnections();
      await closed;
      await service.db.close();
      await database.drop();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
