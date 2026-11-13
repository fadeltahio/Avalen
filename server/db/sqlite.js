// The SQLite driver behind the storage layer. It exposes the same async interface the
// PostgreSQL driver will (all/get/run/exec/transaction), so code above it never knows
// which database it talks to. SQL is written with $1, $2 … placeholders, as Postgres
// expects; they become SQLite's ?1, ?2 … here.
//
// node:sqlite has one connection. Because callers are async, two requests could
// otherwise interleave inside one transaction, so every transaction runs on its own
// and queries outside a transaction wait for it. Code inside a transaction may call the
// driver directly: AsyncLocalStorage routes those calls into the open transaction.
import { DatabaseSync, backup } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { chmodSync } from "node:fs";

export function sqliteDriver(filename) {
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  const statements = new Map();
  const statement = (text) => {
    let prepared = statements.get(text);
    if (!prepared) {
      prepared = db.prepare(text.replace(/\$(\d+)/g, "?$1"));
      statements.set(text, prepared);
    }
    return prepared;
  };
  const inTransaction = new AsyncLocalStorage();
  let queue = Promise.resolve();
  const inTurn = (fn) => {
    if (inTransaction.getStore()) return Promise.resolve().then(fn);
    const turn = queue.then(fn);
    queue = turn.catch(() => {});
    return turn;
  };

  return {
    dialect: "sqlite",
    all: (text, params = []) => inTurn(() => statement(text).all(...params)),
    get: (text, params = []) => inTurn(() => statement(text).get(...params) ?? null),
    run: (text, params = []) => inTurn(() => ({ changes: Number(statement(text).run(...params).changes) })),
    exec: (text) => inTurn(() => db.exec(text)),
    transaction(fn) {
      if (inTransaction.getStore()) return fn();
      return inTurn(async () => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const value = await inTransaction.run(true, fn);
          db.exec("COMMIT");
          return value;
        } catch (e) {
          if (db.isTransaction) db.exec("ROLLBACK");
          throw e;
        }
      });
    },
    // A consistent single-file copy, used by the daily snapshot job.
    backupTo: (path) => inTurn(() => backup(db, path)),
    close: () => inTurn(() => db.close()),
  };
}
