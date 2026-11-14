import { test, expect } from "@playwright/test";
import { fixture } from "./helpers/service.js";

// The Forgot password flow through the app's own screens, against a real server whose
// email goes to a stand-in for Resend.
const sent = [];
const fetchImpl = async (url, init = {}) => {
  if (String(url) !== "https://api.resend.com/emails") return globalThis.fetch(url, init);
  sent.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ id: "email" }), { status: 200 });
};
const codeFrom = async () => {
  for (let i = 0; i < 50 && !sent.length; i++) await new Promise((r) => setTimeout(r, 20));
  return /\b(\d{6})\b/.exec(sent.at(-1).text)[1];
};

test("a coach who forgot their password gets a code by email, sets a new one and signs in", async ({ page }) => {
  sent.length = 0;
  const service = await fixture({ emailEnv: { AVALEN_EMAIL_API_KEY: "re_test", AVALEN_EMAIL_FROM: "Avalen <no-reply@avalen.test>" }, fetchImpl });
  try {
    await page.goto(`${service.base}/?connected=1`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("coach@test.app");
    await page.getByRole("button", { name: "Send code", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("we’ve sent a 6-digit code");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("coach@test.app");
    const code = await codeFrom();

    // A wrong code is refused and the typed new password stays.
    await page.getByLabel("6-digit code").fill(code === "000000" ? "111111" : "000000");
    await page.getByLabel("New password").fill("brand-new-password-1");
    await page.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("That code is wrong or has expired");
    await expect(page.getByLabel("New password")).toHaveValue("brand-new-password-1");

    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Password changed. Sign in with your new password.");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("coach@test.app");
    await page.getByLabel("Password", { exact: true }).fill("brand-new-password-1");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  } finally {
    await service.close();
  }
});

test("without an email service the sign-in screen doesn't offer Forgot password", async ({ page }) => {
  const service = await fixture({ emailEnv: {} });
  try {
    await page.goto(`${service.base}/?connected=1`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Forgot password?" })).toHaveCount(0);
  } finally {
    await service.close();
  }
});
