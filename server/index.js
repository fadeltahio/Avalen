import { startWorker } from "./jobs.js";
import { command } from "../src/avalen/ecosystem/actions.js";
import { createService } from "./app.js";
import { assertProductionConfig } from "./config.js";
import { log, errorFields } from "./log.js";

// A production server with incomplete configuration stops here, before touching any
// data, with a list of what is missing (names only, never values).
try {
  assertProductionConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
// On a host without a persistent disk the generated key file would be lost on every
// deploy, making stored Paymob and wearable tokens unreadable. Require it as a secret.
if (process.env.DATABASE_URL && !process.env.AVALEN_SECRETS_KEY) {
  console.error("AVALEN_SECRETS_KEY is required with DATABASE_URL. Generate one with: openssl rand -base64 32");
  process.exit(1);
}

// Last-resort logging. A promise nobody handled is logged and the server carries on;
// a thrown exception leaves the process in an unknown state, so it is logged and the
// process exits for the host to restart it.
process.on("unhandledRejection", (reason) => log("error", "unhandled promise rejection", errorFields(reason)));
process.on("uncaughtException", (error) => {
  log("error", "uncaught exception, exiting", errorFields(error));
  process.exit(1);
});

let service;
try {
  service = await createService();
} catch (error) {
  log("error", "Avalen could not start", errorFields(error, { stack: false }));
  process.exit(1);
}
service.setCommandHandler(command);
const stopWorker = await startWorker(service);
const port = Number(process.env.PORT || 5180),
  host = process.env.HOST || "127.0.0.1";
const needsOwner = !process.env.AVALEN_SETUP_TOKEN && !(await service.store.users.any());
service.server.listen(port, host, () => {
  console.log(`Avalen service: http://${host}:${port}`);
  if (needsOwner) console.log(`First-run setup token: ${service.bootstrap}`);
});

// Hosts send SIGTERM before replacing the server: finish requests in flight, then close
// the database so no save is cut off halfway.
process.on("SIGTERM", () => {
  log("info", "shutting down");
  stopWorker();
  service.server.close(async () => {
    await service.db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10000).unref();
});
