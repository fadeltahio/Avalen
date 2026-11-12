import { test, expect } from "@playwright/test";
const nav = (p, name) =>
  p
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true });
async function demo(p) {
  await p.goto("/");
  await p.getByRole("button", { name: "Explore demo" }).click();
  await expect(
    p.getByRole("heading", { name: /Make it count,/ }),
  ).toBeVisible();
}
async function revise(p, fn) {
  await p.evaluate(fn);
  await p.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "avalen.workspace.v1",
        newValue: localStorage.getItem("avalen.workspace.v1"),
      }),
    ),
  );
}
const workspace = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("avalen.workspace.v1")));
async function begin(p) {
  await demo(p);
  await p
    .getByRole("button", { name: "View Upper Body A", exact: true })
    .click();
  await p.getByRole("button", { name: "Begin Workout", exact: true }).click();
}

test("rapid interrupted navigation settles on the last choice and Back restores the previous scroll position", async ({
  page: p,
}) => {
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await demo(p);
  await expect(p.locator(".motion-nav-indicator")).toBeVisible();
  expect(
    (await p.locator(".motion-nav-indicator").boundingBox()).width,
  ).toBeGreaterThan(40);
  await p.evaluate(() => scrollTo(0, 600));
  const top = await p.evaluate(() => scrollY);
  await nav(p, "Nutrition").click();
  await expect(
    p.getByRole("heading", { name: "Nutrition.", exact: true }),
  ).toBeVisible();
  await p.goBack();
  await expect(
    p.getByRole("heading", { name: /Make it count,/ }),
  ).toBeVisible();
  await expect.poll(() => p.evaluate(() => scrollY)).toBe(top);
  await p.evaluate(() => {
    const buttons = [...document.querySelectorAll(".bottom-nav button")];
    for (const label of ["Nutrition", "Progress", "Train"])
      buttons.find((b) => b.getAttribute("aria-label") === label).click();
  });
  await expect(nav(p, "Train")).toHaveAttribute("aria-current", "page");
  await expect(
    p.getByRole("tab", { name: "Training", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const preference of ["system", "app"])
  test(`${preference} reduced motion renders exact updated metrics without running animations`, async ({
    page: p,
  }) => {
    if (preference === "system")
      await p.emulateMedia({ reducedMotion: "reduce" });
    await demo(p);
    if (preference === "app")
      await revise(p, () => {
        const d = JSON.parse(localStorage.getItem("avalen.workspace.v1"));
        d.settings.reducedMotion = true;
        localStorage.setItem("avalen.workspace.v1", JSON.stringify(d));
      });
    const before = await p
      .locator(".home-macro")
      .first()
      .getAttribute("aria-label");
    await revise(p, () => {
      const d = JSON.parse(localStorage.getItem("avalen.workspace.v1"));
      const n = new Date(),
        date = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
      d.foodLogs.push({
        id: "motion-food",
        clientId: d.activeClientId,
        date,
        name: "A measured meal",
        meal: "Lunch",
        kcal: 420,
        p: 30,
        c: 40,
        f: 10,
        portion: "1 serving",
      });
      localStorage.setItem("avalen.workspace.v1", JSON.stringify(d));
    });
    await expect(p.locator(".home-macro").first()).not.toHaveAttribute(
      "aria-label",
      before,
    );
    const target = Number(
      (await p.locator(".home-macro").first().getAttribute("aria-label")).match(
        /Calories: (\d+)/,
      )[1],
    );
    await expect(p.locator(".home-macro-ring b").first()).toHaveText(
      target.toLocaleString(),
    );
    await nav(p, "Nutrition").click();
    await expect(nav(p, "Nutrition")).toHaveAttribute("aria-current", "page");
    expect(
      await p.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    ).toBe(0);
  });

test("macro progress starts at actual values on revisit, without recounting from zero", async ({
  page: p,
}) => {
  await demo(p);
  const initial = await p.locator(".home-macro-ring b").first().textContent();
  await nav(p, "Nutrition").click();
  await nav(p, "Home").click();
  await expect(p.locator(".home-macro-ring b").first()).toHaveText(initial);
  expect(await p.locator(".home-macro-ring b").first().textContent()).toBe(
    initial,
  );
});

test("rest pause, adjustment and resume survive reload and never change logged performance", async ({
  page: p,
}) => {
  await begin(p);
  await p.getByRole("button", { name: "Log set 1", exact: true }).click();
  await p.getByRole("button", { name: "Pause rest", exact: true }).click();
  await expect(p.locator(".rest-paused")).toBeVisible();
  const d = await workspace(p),
    saved = d.drafts[d.activeClientId];
  await p.getByRole("button", { name: "+30s", exact: true }).click();
  const extended = await workspace(p);
  expect(extended.drafts[d.activeClientId].restRemainingMs).toBe(
    saved.restRemainingMs + 30000,
  );
  await p.getByRole("button", { name: "Close dialog", exact: true }).click();
  await p.reload();
  await p.getByRole("button", { name: /^Resume workout:/ }).click();
  await expect(p.locator(".rest-paused")).toBeVisible();
  await p.getByRole("button", { name: "Resume rest", exact: true }).click();
  await expect(p.locator(".rest-running")).toBeVisible();
  const after = await workspace(p);
  expect(after.drafts[d.activeClientId].restRemainingMs).toBeUndefined();
  expect(after.drafts[d.activeClientId].sets).toEqual(saved.sets);
  await p.getByRole("button", { name: "Skip rest", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Log set 2", exact: true }),
  ).toBeEnabled();
});

test("dialog Escape dismissal restores keyboard focus and no dormant animation remains", async ({
  page: p,
}) => {
  await demo(p);
  await p.getByRole("button", { name: "Search sessions", exact: true }).focus();
  await p
    .getByRole("button", { name: "Search sessions", exact: true })
    .press("Enter");
  const dialog = p.getByRole("dialog", { name: "Find your next session" });
  await expect(dialog).toBeVisible();
  await p
    .getByRole("searchbox", { name: "Search sessions" })
    .fill("No such session");
  await expect(
    p.getByRole("heading", { name: "No sessions found." }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Close dialog", exact: true }).focus();
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    p.getByRole("button", { name: "Search sessions", exact: true }),
  ).toBeFocused();
  expect(await p.evaluate(() => document.body.style.overflow)).toBe("");
});

test("a waveform uses the input stream, falls silent with it, and a recording can really pause and resume", async ({
  page: p,
}) => {
  const installMicrophone = () => {
    const media = navigator.mediaDevices;
    if (!media) return;
    Object.defineProperty(media, "getUserMedia", {
      configurable: true,
      value: async () => {
        const context = new AudioContext();
        await context.resume();
        const oscillator = context.createOscillator(),
          gain = context.createGain(),
          destination = context.createMediaStreamDestination();
        oscillator.frequency.value = 440;
        gain.gain.value = 0.4;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        window.testMicrophone = { context, gain };
        return destination.stream;
      },
    });
  };
  await demo(p);
  await p.goto("/#/client/coach?tab=Check-in");
  await p.getByRole("button", { name: "Start check-in", exact: true }).click();
  await p.evaluate(installMicrophone);
  await p.locator(".checkin-voice-disclosure > summary").click();
  await p.getByRole("button", { name: "Record voice", exact: true }).click();
  const recording = p.locator('.record-control[data-recording="recording"]');
  await expect(recording).toBeVisible();
  await expect
    .poll(() =>
      p
        .locator(".voice-meter i")
        .evaluateAll((bars) =>
          Math.max(
            ...bars.map((b) =>
              Number(b.style.transform.match(/[\d.]+/)?.[0] || 0),
            ),
          ),
        ),
    )
    .toBeGreaterThan(0.05);
  await p.evaluate(() => {
    window.testMicrophone.gain.gain.value = 0;
  });
  await expect
    .poll(() =>
      p
        .locator(".voice-meter i")
        .evaluateAll((bars) =>
          Math.max(
            ...bars.map((b) =>
              Number(b.style.transform.match(/[\d.]+/)?.[0] || 0),
            ),
          ),
        ),
    )
    .toBeLessThan(0.04);
  await p.getByRole("button", { name: "Pause recording", exact: true }).click();
  await expect(p.locator(".record-control")).toHaveAttribute(
    "data-recording",
    "paused",
  );
  const seconds = await p.getByRole("timer").textContent();
  await p.waitForTimeout(1100);
  await expect(p.getByRole("timer")).toHaveText(seconds);
  await p
    .getByRole("button", { name: "Resume recording", exact: true })
    .click();
  await expect(recording).toBeVisible();
  await p.getByRole("button", { name: "Stop recording", exact: true }).click();
  await expect(p.locator(".record-control")).toHaveAttribute(
    "data-recording",
    "complete",
    { timeout: 15000 },
  );
  await expect(p.locator(".record-control audio")).toBeVisible();
});
