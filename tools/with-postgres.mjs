// Runs a command against a throwaway PostgreSQL server:
//   node tools/with-postgres.mjs <command> [args…]
// It creates a fresh cluster in a temporary folder, starts it on a free local port
// (no network listener beyond 127.0.0.1), creates database "avalen_test", runs the
// command with DATABASE_URL set, then stops the server and deletes the folder.
// Never touches a real database. Needs PostgreSQL's initdb/pg_ctl: on macOS,
// `brew install postgresql@17`, or point PG_BIN at its bin folder.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = process.env.PG_BIN || ["/opt/homebrew/opt/postgresql@17/bin", "/usr/local/opt/postgresql@17/bin", "/usr/lib/postgresql/17/bin"].find((d) => existsSync(join(d, "initdb")));
if (!bin) {
  console.error("PostgreSQL 17 was not found. Install it (brew install postgresql@17) or set PG_BIN.");
  process.exit(1);
}
const command = process.argv.slice(2);
if (!command.length) {
  console.error("Usage: node tools/with-postgres.mjs <command> [args…]");
  process.exit(1);
}

const freePort = () =>
  new Promise((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const dir = mkdtempSync(join(tmpdir(), "avalen-pg-"));
const data = join(dir, "data");
const port = await freePort();
// On macOS the server refuses to start without an explicit locale in its environment.
const pgEnv = { ...process.env, LC_ALL: "C" };
const pg = (tool, args) => execFileSync(join(bin, tool), args, { stdio: ["ignore", "ignore", "inherit"], env: pgEnv });
let started = false;
const stop = () => {
  if (started) {
    try { pg("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]); } catch {}
    started = false;
  }
  rmSync(dir, { recursive: true, force: true });
};
process.on("SIGINT", () => { stop(); process.exit(130); });

try {
  pg("initdb", ["-D", data, "-U", "avalen", "--auth=trust", "--encoding=UTF8", "--locale=C", "--no-instructions"]);
  // No socket file: macOS limits socket paths to ~100 characters, and TCP on 127.0.0.1 is enough.
  pg("pg_ctl", ["-D", data, "-l", join(dir, "server.log"), "-w", "-o", `-p ${port} -c unix_socket_directories='' -c listen_addresses=127.0.0.1 -c fsync=off`, "start"]);
  started = true;
  pg("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "avalen", "avalen_test"]);
} catch (e) {
  console.error("Could not start a temporary PostgreSQL server:", e.message);
  if (existsSync(join(dir, "server.log"))) console.error(readFileSync(join(dir, "server.log"), "utf8"));
  stop();
  process.exit(1);
}

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `postgres://avalen@127.0.0.1:${port}/avalen_test`, PG_BIN: bin },
});
child.on("exit", (code, signal) => {
  stop();
  process.exitCode = signal ? 1 : code ?? 1;
});
