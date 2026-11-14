// The PostgreSQL driver behind the storage layer: the same async interface as
// server/db/sqlite.js. Each transaction checks out its own connection; calls made
// inside it (directly or through the store) are routed to that connection by
// AsyncLocalStorage, so storage functions don't need a connection passed in.
//
// Hosted databases close connections during maintenance, failover and restarts. A
// closed connection must never take the process down: the pool and every checked-out
// connection have an error listener, a broken connection is discarded instead of being
// returned to the pool, and the request that was using it fails with a 503 (see
// errors.js) while the next request gets a fresh connection.
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { markUnavailable, isUnavailable } from "./errors.js";
import { log, errorFields } from "../log.js";

// Millisecond timestamps are stored as bigint; return them as numbers like SQLite does.
// They stay far below 2^53, so nothing is lost.
pg.types.setTypeParser(20, (value) => Number(value));

export function postgresDriver(
  connectionString,
  {
    max = 10,
    // Waiting this long for a free or new connection fails the request instead of hanging it.
    connectionTimeout = 5000,
    // A single statement running longer than this is cancelled by the server.
    statementTimeout = 15000,
    // A transaction left open without activity is ended by the server.
    idleInTransactionTimeout = 30000,
  } = {},
) {
  const pool = new pg.Pool({
    connectionString,
    max,
    connectionTimeoutMillis: connectionTimeout,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    statement_timeout: statementTimeout,
    idle_in_transaction_session_timeout: idleInTransactionTimeout,
    application_name: "avalen",
    // Render and most hosts require TLS outside their private network; a local URL doesn't.
    ssl: /sslmode=require|sslmode=verify/.test(connectionString) ? { rejectUnauthorized: !/sslmode=require/.test(connectionString) } : undefined,
  });
  // An idle connection closed by the server: the pool has already removed it.
  pool.on("error", (error) => log("warn", "database connection closed while idle", errorFields(error, { stack: false })));
  const current = new AsyncLocalStorage();
  const query = async (text, params = []) => {
    try {
      return await (current.getStore() || pool).query(text, params);
    } catch (error) {
      throw markUnavailable(error);
    }
  };

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
      let client;
      try {
        client = await pool.connect();
      } catch (error) {
        throw markUnavailable(error);
      }
      let broken = null;
      const onError = (error) => {
        broken = error;
        log("warn", "database connection closed during a request", errorFields(error, { stack: false }));
      };
      client.on("error", onError);
      try {
        await client.query("BEGIN");
        const value = await current.run(client, fn);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        if (isUnavailable(error)) broken ??= error;
        // A lost connection has already rolled back on the server; there is nothing to send.
        if (!broken) await client.query("ROLLBACK").catch(() => {});
        throw markUnavailable(error);
      } finally {
        client.off("error", onError);
        // Passing the error discards the connection rather than reusing a broken one.
        client.release(broken || undefined);
      }
    },
    close: () => pool.end(),
  };
}
