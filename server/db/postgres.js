// The PostgreSQL driver behind the storage layer: the same async interface as
// server/db/sqlite.js. Each transaction checks out its own connection; calls made
// inside it (directly or through the store) are routed to that connection by
// AsyncLocalStorage, so storage functions don't need a connection passed in.
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

// Millisecond timestamps are stored as bigint; return them as numbers like SQLite does.
// They stay far below 2^53, so nothing is lost.
pg.types.setTypeParser(20, (value) => Number(value));

export function postgresDriver(connectionString, { max = 10 } = {}) {
  const pool = new pg.Pool({
    connectionString,
    max,
    // Render and most hosts require TLS outside their private network; a local URL doesn't.
    ssl: /sslmode=require|sslmode=verify/.test(connectionString) ? { rejectUnauthorized: !/sslmode=require/.test(connectionString) } : undefined,
  });
  const current = new AsyncLocalStorage();
  const query = (text, params = []) => (current.getStore() || pool).query(text, params);

  return {
    dialect: "postgres",
    all: async (text, params) => (await query(text, params)).rows,
    get: async (text, params) => (await query(text, params)).rows[0] ?? null,
    run: async (text, params) => ({ changes: (await query(text, params)).rowCount ?? 0 }),
    exec: async (text) => {
      await query(text);
    },
    async transaction(fn) {
      if (current.getStore()) return fn();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await current.run(client, fn);
        await client.query("COMMIT");
        return value;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
