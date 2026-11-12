import { startWorker } from "./jobs.js";
import { command } from "../src/avalen/ecosystem/actions.js";
import { createService } from "./app.js";
const service = createService();
service.setCommandHandler(command);
startWorker(service);
const port = Number(process.env.PORT || 5180),
  host = process.env.HOST || "127.0.0.1";
service.server.listen(port, host, () => {
  console.log(`Avalen service: http://${host}:${port}`);
  if (
    !process.env.AVALEN_SETUP_TOKEN &&
    !service.db.prepare("SELECT id FROM users LIMIT 1").get()
  )
    console.log(`First-run setup token: ${service.bootstrap}`);
});
