import { test, expect } from "@playwright/test";
import { fixture } from "./helpers/service.js";
import { workspaceChanges } from "../src/avalen/ecosystem/changes.js";

let service;
test.beforeEach(async () => {
  service = await fixture();
});
test.afterEach(async () => {
  await service.close();
});
async function login(page, email, password, route) {
  await page.goto(`${service.base}/?connected=1${route}`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("avalen.editorial.splash", "seen"));
  await page.reload();
}

test("a client ends coaching, keeps their history, downloads it and joins a new coach", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { code } = await service.call("/api/coach-code", { account: service.coach });
  const client = await service.call("/api/signup/client", { method: "POST", body: { name: "Maya Chen", email: "maya@test.app", password: "client-password-123", code } });
  const seen = await service.call("/api/workspace", { account: client });
  const next = structuredClone(seen.data);
  next.foodLogs.push({ id: "koshary", clientId: client.user.clientId, date: new Date().toISOString().slice(0, 10), name: "Koshary", meal: "Lunch", kcal: 700, p: 20, c: 120, f: 15 });
  await service.call("/api/workspace", { method: "PATCH", account: client, body: { revision: seen.revision, changes: workspaceChanges(seen.data, next) } });

  await login(page, "maya@test.app", "client-password-123", "#/client/you");
  await page.getByRole("button", { name: /^End coaching/ }).click();
  const dialog = page.getByRole("dialog", { name: "End coaching with your coach?" });
  await expect(dialog).toContainText("You keep your account and your own records");
  await dialog.getByRole("button", { name: "End coaching", exact: true }).click();

  await expect(page.getByRole("heading", { name: "You’re not connected to a coach" })).toBeVisible();
  await expect(page.getByText(/1 food logs/)).toBeVisible();
  await expect(page.locator("nav.bottom-nav")).toHaveClass(/is-hidden/);
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download your history/ }).click();
  expect((await saved).suggestedFilename()).toBe("avalen-my-history.json");

  const second = await service.call("/api/signup/coach", { method: "POST", body: { name: "Second Coach", email: "second@test.app", password: "strong-password-456" } });
  const { code: secondCode } = await service.call("/api/coach-code", { account: second });
  await page.getByLabel("Coach code", { exact: true }).fill(secondCode);
  await page.getByRole("button", { name: "Join coach", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re not connected to a coach" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  const secondView = await service.call("/api/workspace", { account: second });
  expect(secondView.data.clients.map((c) => c.name)).toEqual(["Maya Chen"]);
  expect(errors).toEqual([]);
});
