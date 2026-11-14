// Applies the numbered SQL files in server/migrations/<dialect>/ that a database has not
// had yet, each in its own transaction, and records them in schema_migrations.
// Files are never edited after release: a change to the schema is a new file.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const folder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export function migrationFiles(dialect) {
  return readdirSync(join(folder, dialect))
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: Number(f.slice(0, 3)), name: f.slice(4, -4), sql: readFileSync(join(folder, dialect, f), "utf8") }));
}

export async function migrate(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const applied = new Set((await db.all("SELECT version FROM schema_migrations")).map((r) => Number(r.version)));
  const ran = [];
  for (const file of migrationFiles(db.dialect)) {
    if (applied.has(file.version)) continue;
    // A SQLite migration that rebuilds a table referenced by others starts with
    // "-- sqlite: foreign keys off". SQLite only allows switching reference checks off
    // outside a transaction, so every reference is verified before the change commits.
    const rebuild = db.dialect === "sqlite" && file.sql.startsWith("-- sqlite: foreign keys off");
    if (rebuild) await db.exec("PRAGMA foreign_keys=OFF");
    try {
      await db.transaction(async () => {
        // Two servers starting together: the second waits here, then skips what the first applied.
        if (db.dialect === "postgres") {
          await db.get("SELECT pg_advisory_xact_lock(724301)");
          if (await db.get("SELECT version FROM schema_migrations WHERE version=$1", [file.version])) return;
        }
        await db.exec(file.sql);
        if (rebuild) {
          const broken = await db.all("PRAGMA foreign_key_check");
          if (broken.length) throw new Error(`Migration ${file.version} would leave ${broken.length} broken references (first in ${broken[0].table}).`);
        }
        await db.run("INSERT INTO schema_migrations(version, name, applied_at) VALUES($1, $2, $3)", [file.version, file.name, new Date().toISOString()]);
      });
    } finally {
      if (rebuild) await db.exec("PRAGMA foreign_keys=ON");
    }
    ran.push(file.version);
  }
  return ran;
}
