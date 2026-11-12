import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createService } from "../../server/app.js";
import { command } from "../../src/avalen/ecosystem/actions.js";
export async function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "avalen-test-")),
    service = createService({ root, setupToken: "test-owner-token", ...options });
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
      service.db.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
