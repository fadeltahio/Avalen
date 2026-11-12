import { test, expect } from "@playwright/test";

test("coach branding is inherited by every client, new clients, shares and desktop, and resets together", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore demo" }).click();
  await page.getByLabel("Workspace role").selectOption("coach");
  await page.getByRole("button", { name: "Coach brand settings" }).click();
  await page.getByLabel("Coaching brand").fill("North Coaching");
  await page
    .getByLabel("Upload your logo")
    .setInputFiles("src/assets/share-track-dawn-v2.jpg");
  await expect(
    page.getByAltText("Coaching logo", { exact: true }),
  ).toBeVisible();
  // Upload is a draft; clients should not see it before Save.
  await expect(
    page.getByRole("banner").getByAltText("North Coaching logo"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await expect(
    page.getByText("Brand saved for all 6 connected clients."),
  ).toBeVisible();
  await page.getByLabel("Workspace role").selectOption("client");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "You", exact: true }).click();
  for (const id of [
    "client-0",
    "client-1",
    "client-2",
    "client-3",
    "client-4",
    "client-5",
  ]) {
    await page.getByLabel("Client preview").selectOption(id);
    await expect(
      page.getByRole("banner").getByAltText("North Coaching logo"),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole("banner").getByAltText("North Coaching logo"),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "Progress story" }).click();
  await expect(
    page.getByRole("dialog").getByAltText("North Coaching logo"),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save image", exact: true }).click();
  expect((await dl).suggestedFilename()).toBe("avalen-progress.png");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.locator("aside").getByAltText("North Coaching logo"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole("button", { name: "You", exact: true }).click();
  await page
    .getByRole("button", { name: "Start a fresh test profile" })
    .click();
  await page.getByRole("button", { name: "Return to Get Started" }).click();
  await expect(
    page.getByRole("heading", { name: "North Coaching", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get Started", exact: true }).click();
  await page.getByLabel("Your name").fill("New Member");
  await page.getByLabel("Email", { exact: true }).fill("new@example.test");
  await page.getByLabel("Coach code").fill("00000");
  await page.getByRole("button", { name: "Join my coach" }).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(
    page.getByRole("banner").getByAltText("North Coaching logo"),
  ).toBeVisible();
  await page.getByLabel("Workspace role").selectOption("coach");
  await page.getByRole("button", { name: "Coach brand settings" }).click();
  await page.getByRole("button", { name: "Use Avalen mark" }).click();
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await page.getByLabel("Workspace role").selectOption("client");
  await expect(
    page.getByRole("banner").getByAltText("North Coaching logo"),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "You", exact: true }).click();
  await page.getByLabel("Client preview").selectOption("client-0");
  await expect(
    page.getByRole("banner").getByAltText("North Coaching logo"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("banner").getByRole("img", { name: "Avalen", exact: true }),
  ).toBeVisible();
});
