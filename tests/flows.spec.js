import { test, expect } from "@playwright/test";
test("coach covers, custom habits, membership and branding flow through to client", async ({
  page,
}) => {
  await demo(page);
  await page.getByLabel("Workspace role").selectOption("coach");
  await nav(page, "Clients").click();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: "Jordan Williams" }) })
    .click();
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Edit programme" }).click();
  await page
    .getByLabel("Upload a workout cover")
    .setInputFiles("src/assets/share-track-dawn-v2.jpg");
  await expect(
    page.getByText("share-track-dawn-v2.jpg", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save programme", exact: true })
    .click();
  await page.getByRole("button", { name: "Add custom habit" }).click();
  await page.getByLabel("Habit", { exact: true }).last().fill("Evening walk");
  await page.getByRole("button", { name: "Save habit targets" }).click();
  await page.getByRole("tab", { name: "Billing", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("3100");
  await page.getByRole("button", { name: "Save membership" }).click();
  await page.getByLabel("Workspace role").selectOption("client");
  await expect(
    page.getByRole("heading", { name: "Upper Body A" }),
  ).toBeVisible();
  await expect(page.locator(".workout-hero")).toHaveCSS(
    "background-image",
    /blob:/,
  );
  await nav(page, "Plan").click();
  await page.getByRole("tab", { name: "Habits", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Evening walk" }),
  ).toBeVisible();
  await nav(page, "Coach").click();
  await expect(page.getByText("EGP 3,100", { exact: true })).toBeVisible();
  await page.getByLabel("Workspace role").selectOption("coach");
  await page.getByRole("button", { name: "Coach brand settings" }).click();
  await page.getByLabel("Coaching brand").fill("Forma coaching");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page).toHaveTitle(/Forma coaching/);
});
const nav = (page, name) =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true });
async function demo(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore demo" }).click();
}
async function close(page) {
  await page.getByRole("button", { name: "Close dialog" }).click();
}
test("fresh onboarding, workout draft persistence, finish and real PNG export", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByLabel("Your name").fill("Taylor Test");
  await page.getByLabel("Email", { exact: true }).fill("taylor@example.test");
  await page.getByLabel("Coach code").fill("00000");
  await page.getByRole("button", { name: "Join my coach" }).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Taylor/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Start Workout", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Weight (kg)", exact: true })
    .fill("62.5");
  await page.getByRole("spinbutton", { name: "Reps", exact: true }).fill("11");
  await page.getByRole("button", { name: "Log set 1" }).click();
  await close(page);
  await page.reload();
  await page.getByRole("button", { name: "Resume workout" }).click();
  await expect(page.getByText("62.5 × 11", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page.getByRole("button", { name: "Finish & see results" }).click();
  await expect(
    page.getByRole("heading", { name: "You showed up." }),
  ).toBeVisible();
  await expect(page.getByText("687.5", { exact: true })).toBeVisible();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save image", exact: true }).click();
  const file = await promise;
  expect(file.suggestedFilename()).toBe("avalen-progress.png");
  await file.saveAs("test-results/workout-share.png");
  await close(page);
  await expect(
    page.getByRole("button", { name: "Workout complete" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("client check-in reaches coach review and feedback returns to messages", async ({
  page,
}) => {
  await demo(page);
  await nav(page, "Coach").click();
  await page.getByRole("tab", { name: "Check-in", exact: true }).click();
  await page.getByRole("button", { name: "Start check-in" }).click();
  await page
    .getByLabel("What went well?")
    .fill("Training felt strong this week.");
  await page.getByLabel("What felt difficult?").fill("Sleep was inconsistent.");
  await page.getByRole("button", { name: "Send check-in" }).click();
  await page.getByLabel("Workspace role").selectOption("coach");
  await nav(page, "Inbox").click();
  await page.getByRole("tab", { name: "Check-ins", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "Waiting for review" })
    .first()
    .click();
  await expect(
    page.getByText("Training felt strong this week.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Feedback to client")
    .fill("Keep the plan. Prioritise a consistent bedtime.");
  await page.getByRole("button", { name: "Complete review" }).click();
  await page.getByLabel("Workspace role").selectOption("client");
  await nav(page, "Coach").click();
  await page.getByRole("tab", { name: "Messages", exact: true }).click();
  await expect(
    page.getByText("Keep the plan. Prioritise a consistent bedtime.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("coach nutrition change reaches client, food details and habits persist", async ({
  page,
}) => {
  await demo(page);
  await page.getByLabel("Workspace role").selectOption("coach");
  await nav(page, "Clients").click();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: "Jordan Williams" }) })
    .click();
  await page.getByRole("tab", { name: "Nutrition", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("2300");
  await page
    .getByLabel("Why are you making this change?")
    .fill("Adjusted for the current training block.");
  await page.getByRole("button", { name: "Save nutrition plan" }).click();
  await page.getByLabel("Workspace role").selectOption("client");
  await nav(page, "Plan").click();
  await page.getByRole("tab", { name: "Nutrition", exact: true }).click();
  await expect(page.getByText("2,300", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByRole("button", { name: /Greek yogurt 200/ }).click();
  await page.getByRole("button", { name: "Add to diary" }).click();
  await page.getByRole("button").filter({ hasText: "Greek yogurt" }).click();
  await expect(
    page.getByRole("heading", { name: "Greek yogurt" }),
  ).toBeVisible();
  await close(page);
  await page.getByRole("tab", { name: "Habits" }).click();
  await page.getByLabel("Drink water", { exact: true }).fill("2.5");
  await page.reload();
  await nav(page, "Plan").click();
  await page.getByRole("tab", { name: "Habits" }).click();
  await expect(page.getByLabel("Drink water", { exact: true })).toHaveValue(
    "2.5",
  );
});
test("coach programme and member post are reflected on client side", async ({
  page,
}) => {
  await demo(page);
  await page.getByLabel("Workspace role").selectOption("coach");
  await nav(page, "Clients").click();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: "Jordan Williams" }) })
    .click();
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Edit programme" }).click();
  await page
    .getByLabel("Day name", { exact: true })
    .fill("Upper Body · Quality First");
  await page
    .getByRole("button", { name: "Save programme", exact: true })
    .click();
  await nav(page, "Inbox").click();
  await page.getByRole("tab", { name: "Feed", exact: true }).click();
  await page.getByRole("button", { name: "New post" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("A more intentional week");
  await page
    .getByLabel("Post", { exact: true })
    .fill("Focus on quality, not rushing your sets.");
  await page.getByRole("button", { name: "Publish to members" }).click();
  await page.getByLabel("Workspace role").selectOption("client");
  await expect(
    page.getByRole("heading", { name: "Upper Body · Quality First" }),
  ).toBeVisible();
  await nav(page, "Coach").click();
  await page.getByRole("tab", { name: "Feed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A more intentional week" }),
  ).toBeVisible();
});
test("photos, documents, verified InBody, future locking and keyboard chart", async ({
  page,
}) => {
  await demo(page);
  await nav(page, "Progress").click();
  const chart = page.getByRole("slider", { name: /weight history/ });
  await chart.focus();
  await chart.press("ArrowLeft");
  await expect(chart).toHaveAttribute("aria-valuenow", "7");
  await page.getByRole("tab", { name: "Photos", exact: true }).click();
  await page
    .getByLabel("Add photo", { exact: true })
    .setInputFiles("src/assets/share-recovery-v2.jpg");
  await expect(page.getByAltText(/^Progress /)).toHaveCount(1);
  await page
    .getByLabel("Add photo", { exact: true })
    .setInputFiles("src/assets/share-track-dawn-v2.jpg");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByAltText("Before", { exact: true })).toBeVisible();
  await page
    .getByRole("slider", { name: "Slide to compare photos" })
    .fill("30");
  await close(page);
  await page.getByLabel("Workspace role").selectOption("coach");
  await nav(page, "Clients").click();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: "Jordan Williams" }) })
    .click();
  await page.getByRole("tab", { name: "Documents" }).click();
  await page
    .getByLabel(/Add a PDF or image report/)
    .setInputFiles("src/assets/share-recovery-v2.jpg");
  await expect(
    page.getByRole("button", { name: /share-recovery-v2.jpg/ }),
  ).toBeVisible();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("74");
  await page.getByLabel("Body fat (%)").fill("18");
  await page.getByLabel("Skeletal muscle (kg)").fill("33");
  await page
    .getByRole("button", { name: "Save verified measurements" })
    .click();
  await page.getByLabel("Workspace role").selectOption("client");
  await nav(page, "Progress").click();
  await page.getByRole("tab", { name: "Body", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: /bodyFat history/ }),
  ).toBeVisible();
  await nav(page, "Today").click();
  const name = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    const client = data.clients.find(c => c.id === data.activeClientId);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const future = client.schedule.find(s => s.date > today && client.program.days.some(d => d.id === s.dayId));
    if (!future) throw new Error('Demo has no upcoming workout to verify');
    return new Date(`${future.date}T12:00:00`).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  });
  await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Scheduled for/ }),
  ).toBeDisabled();
});
for (const width of [320, 390, 768, 1440])
  test(`navigation and no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await demo(page);
    const menu =
      width > 760
        ? page.locator("aside nav")
        : page.getByRole("navigation", { name: "Main navigation" });
    for (const label of ["Today", "Plan", "Progress", "Coach", "You"]) {
      await menu.getByRole("button", { name: label, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    await page.getByLabel("Workspace role").selectOption("coach");
    for (const label of [
      "Dashboard",
      "Clients",
      "Programs",
      "Inbox",
      "Business",
    ]) {
      await menu.getByRole("button", { name: label, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    await menu.getByRole("button", { name: "Dashboard", exact: true }).click();
    await page.screenshot({
      path: `test-results/coach-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Workspace role").selectOption("client");
    await page.screenshot({
      path: `test-results/client-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
