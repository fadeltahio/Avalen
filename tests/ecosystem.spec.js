import { test, expect } from "@playwright/test";
import { fixture } from "./helpers/service.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let service;
test.beforeEach(async () => {
  service = await fixture();
});
test.afterEach(async () => {
  await service.close();
});
async function login(
  page,
  email = "coach@test.app",
  password = "strong-password-123",
  route = "#/coach/dashboard",
) {
  await page.goto(`${service.base}/?connected=1${route}`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Account", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem("avalen.editorial.splash", "seen");
  });
  await page.reload();
}
async function clientAccount() {
  const clientId = service.coach.data.clients[0].id;
  const invite = await service.call("/api/invitations", {
    method: "POST",
    account: service.coach,
    body: { clientId },
  });
  const client = await service.call("/api/join", {
    method: "POST",
    body: {
      invite: invite.invite,
      email: "client@test.app",
      password: "client-password-123",
    },
  });
  return { ...client, clientId };
}
test("authenticated client text check-in reaches coach review, shared feedback and private memory remain separate", async ({
  page,
  browser,
}) => {
  const client = await clientAccount();
  await login(
    page,
    "client@test.app",
    "client-password-123",
    "#/client/coach?tab=Check-in",
  );
  await page
    .getByRole("button", { name: "Start check-in", exact: false })
    .click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("81.4");
  await page
    .getByLabel("Your update (optional)")
    .fill("Low energy after a busy week.");
  await page.getByRole("button", { name: "Send check-in" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Check-in sent" }),
  ).toBeVisible();
  const coachContext = await browser.newContext({
      viewport: { width: 1440, height: 950 },
    }),
    coachPage = await coachContext.newPage();
  await login(
    coachPage,
    undefined,
    undefined,
    `#/coach/clients?client=${client.clientId}&section=Check-ins`,
  );
  await coachPage
    .getByRole("button", { name: /Waiting for review/ })
    .first()
    .click();
  await expect(
    coachPage.getByText("Client update: Low energy after a busy week."),
  ).toBeVisible();
  await coachPage
    .getByLabel("Feedback to client")
    .fill("Let’s make next week more manageable.");
  await coachPage.getByRole("button", { name: "Complete review" }).click();
  await expect(
    coachPage.getByRole("status").filter({ hasText: "Check-in reviewed" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /Reviewed by coach/ })
    .first()
    .click();
  await expect(
    page.getByText("Let’s make next week more manageable.", { exact: true }),
  ).toBeVisible();
  await coachContext.close();
});
test("FormLab uploads playable video, coach publishes timestamp and drawing, client can replay feedback", async ({
  page,
  browser,
}) => {
  const client = await clientAccount(),
    temporary = mkdtempSync(join(tmpdir(), "avalen-ui-video-")),
    file = join(temporary, "movement.mp4");
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=320x240:d=2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    file,
  ]);
  try {
    await login(
      page,
      "client@test.app",
      "client-password-123",
      "#/client/plan?tab=FormLab",
    );
    await page.getByRole("button", { name: "Send a form video" }).click();
    await page
      .getByLabel("Record or choose exercise video")
      .setInputFiles(file);
    await expect(page.getByText(/Ready to send/)).toBeVisible({
      timeout: 30000,
    });
    await page.getByLabel("Share this private recording").check();
    await page
      .getByRole("button", { name: "Send to coach", exact: true })
      .click();
    await expect(page.getByText("Waiting for coach review")).toBeVisible();
    const coachContext = await browser.newContext({
        viewport: { width: 1440, height: 950 },
      }),
      coachPage = await coachContext.newPage();
    await login(
      coachPage,
      undefined,
      undefined,
      `#/coach/clients?client=${client.clientId}&section=FormLab`,
    );
    await coachPage
      .getByRole("button", { name: /Waiting for coach review/ })
      .click();
    await expect(coachPage.getByLabel("Video position")).toBeVisible();
    await coachPage
      .getByLabel("Comment at 0:00")
      .fill("Keep the setup steady.");
    const stage = coachPage.getByRole("img", {
      name: "Draw technique annotations on the paused video",
    });
    await stage.scrollIntoViewIfNeeded();
    const box = await stage.boundingBox();
    await coachPage.mouse.move(
      box.x + box.width * 0.2,
      box.y + box.height * 0.3,
    );
    await coachPage.mouse.down();
    await coachPage.mouse.move(
      box.x + box.width * 0.6,
      box.y + box.height * 0.6,
    );
    await coachPage.mouse.up();
    await coachPage
      .getByRole("button", { name: "Add timestamped note" })
      .click();
    await coachPage
      .getByLabel("Overall feedback")
      .fill("A useful starting point.");
    await coachPage
      .getByRole("button", { name: "Share feedback with client" })
      .click();
    await expect(
      coachPage
        .getByRole("status")
        .filter({ hasText: "Technique feedback shared" }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /Feedback ready/ }).click();
    await expect(
      page.getByRole("button", { name: /Keep the setup steady.*1 drawing/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mark feedback as viewed" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Feedback marked as viewed" }),
    ).toBeVisible();
    await coachContext.close();
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("client schedule proposal requires coach approval and updates the calendar without changing prescriptions", async ({
  page,
  browser,
}) => {
  const today = new Date().toISOString().slice(0, 10),
    date = (n) =>
      new Date(Date.parse(today + "T12:00:00Z") + n * 86400000)
        .toISOString()
        .slice(0, 10);
  let state = await service.call("/api/workspace", { account: service.coach });
  const c = state.data.clients[0],
    clientId = c.id,
    originalProgram = structuredClone(c.program);
  c.schedule = [
    { date: date(1), dayId: c.program.days[0].id },
    { date: date(5), dayId: c.program.days[1].id },
  ];
  state = await service.call("/api/workspace", {
    method: "PATCH",
    account: service.coach,
    body: { revision: state.revision, data: state.data },
  });
  expect(state.status).toBe(200);
  await clientAccount();
  await login(page, "client@test.app", "client-password-123", "#/client/plan");
  await page.getByRole("button", { name: "Adjust training dates" }).click();
  await page
    .getByLabel("Scheduled session", { exact: true })
    .selectOption(date(1));
  await page.getByLabel("New date", { exact: true }).fill(date(2));
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.getByRole("table")).toContainText(date(2));
  await page
    .getByRole("button", { name: "Request coach approval", exact: true })
    .click();
  await expect(
    page.getByText("Awaiting coach approval", { exact: true }),
  ).toBeVisible();
  let stored = await service.call("/api/workspace", { account: service.coach });
  expect(stored.data.clients[0].schedule[0].date).toBe(date(1));
  const ctx = await browser.newContext({
      viewport: { width: 1440, height: 950 },
    }),
    coach = await ctx.newPage();
  await login(
    coach,
    undefined,
    undefined,
    `#/coach/clients?client=${clientId}&section=Plan`,
  );
  await coach.getByRole("button", { name: "Review proposal" }).click();
  await coach
    .getByRole("button", { name: "Approve schedule", exact: true })
    .click();
  await expect(
    coach.getByRole("status").filter({ hasText: "Training dates updated" }),
  ).toBeVisible();
  stored = await service.call("/api/workspace", { account: service.coach });
  expect(stored.data.clients[0].schedule[0].date).toBe(date(2));
  expect(stored.data.clients[0].program).toEqual(originalProgram);
  expect(stored.data.timeline.some((e) => e.type === "schedule-decision")).toBe(
    true,
  );
  await page.reload();
  await expect(
    page.getByText("Awaiting coach approval", { exact: true }),
  ).toHaveCount(0);
  await ctx.close();
});

test("intelligence approved change preserves programme versions and private decision context", async ({
  page,
}) => {
  const today = new Date().toISOString().slice(0, 10),
    date = (n) =>
      new Date(Date.parse(today + "T12:00:00Z") + n * 86400000)
        .toISOString()
        .slice(0, 10);
  let state = await service.call("/api/workspace", { account: service.coach }),
    client = state.data.clients[0];
  const ex = client.program.days[0].exercises[0];
  state.data.checkins = [
    {
      id: "low-one",
      clientId: client.id,
      date: date(-7),
      scores: { Energy: 1 },
    },
    {
      id: "low-two",
      clientId: client.id,
      date: date(-1),
      scores: { Energy: 2 },
    },
  ];
  await service.store.workspaces.save(
    service.coach.user
      ? (await service.db.get("SELECT workspace_id FROM users WHERE role='coach'")).workspace_id
      : "",
    state.data,
  );
  await login(
    page,
    undefined,
    undefined,
    `#/coach/clients?client=${client.id}&section=Intelligence`,
  );
  const card = page
    .locator(".insight-card")
    .filter({ hasText: "Energy and training deserve a conversation" });
  await card.getByRole("button", { name: "Review next step" }).click();
  await page.getByLabel("Coach’s next step").selectOption("recovery");
  await page
    .getByLabel(`Load (kg) · currently ${ex.weight}`)
    .fill(String(ex.weight - 5));
  await page
    .getByLabel("Reason / coaching context (optional)")
    .fill("Private review: client requested a lighter week.");
  await expect(page.getByRole("table")).toContainText(String(ex.weight - 5));
  await page.getByRole("button", { name: "Approve these changes" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Reviewed action saved" }),
  ).toBeVisible();
  state = await service.call("/api/workspace", { account: service.coach });
  expect(state.data.clients[0].program.days[0].exercises[0].weight).toBe(
    ex.weight - 5,
  );
  expect(
    state.data.revisions.filter((r) => r.field === "program"),
  ).toHaveLength(2);
  expect(state.data.insightDecisions).toHaveLength(1);
  await page.getByRole("tab", { name: "Coaching Memory", exact: true }).click();
  await expect(
    page.getByText("Private review: client requested a lighter week.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("voice check-in survives a failed save and can be retried without duplicate submission", async ({
  page,
}) => {
  await clientAccount();
  const temporary = mkdtempSync(join(tmpdir(), "avalen-voice-ui-")),
    file = join(temporary, "voice.wav");
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    file,
  ]);
  try {
    await login(
      page,
      "client@test.app",
      "client-password-123",
      "#/client/coach?tab=Check-in",
    );
    await page
      .getByRole("button", { name: "Start check-in", exact: false })
      .click();
    await page.getByLabel("Weight (kg)", { exact: true }).fill("80.5");
    await page
      .locator(".checkin-voice-disclosure > summary")
      .filter({ hasText: "Add a voice update" })
      .click();
    await page
      .getByLabel("Upload Voice update", { exact: true })
      .setInputFiles(file);
    await expect(
      page.getByText("No transcription provider is connected.", {
        exact: false,
      }),
    ).toBeVisible();
    await page.route("**/api/commands", (route) => route.abort("failed"));
    await page
      .getByRole("button", { name: "Send check-in", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "connection was interrupted",
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.unroute("**/api/commands");
    await page
      .getByRole("button", { name: "Retry unsaved action", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Action saved." }),
    ).toBeVisible();
    const result = await service.call("/api/workspace", {
      account: service.coach,
    });
    expect(result.data.checkins).toHaveLength(1);
    expect(result.data.checkins[0].audio.type).toBe("audio/wav");
    expect(result.data.checkins[0].transcript).toBe("");
    await page.reload();
    await page.getByRole("button", { name: /Waiting for review/ }).click();
    await expect(page.locator("audio")).toHaveCount(1);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("existing nutrition logging and workout completion remain functional in authenticated accounts", async ({
  page,
}) => {
  await clientAccount();
  await login(page, "client@test.app", "client-password-123");
  const nav = (name) =>
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name, exact: true });
  await nav("Nutrition").click();
  await page.locator(".nutrition-plan-disclosure > summary").click();
  await page
    .getByRole("button", { name: "Log planned Breakfast", exact: true })
    .click();
  await page.getByRole("button", { name: /0\.5×/ }).click();
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect
    .poll(async () => {
      const result = await service.call("/api/workspace", {
        account: service.coach,
      });
      return result.data.foodLogs.length;
    })
    .toBe(1);
  let saved = await service.call("/api/workspace", { account: service.coach });
  expect(saved.data.foodLogs[0].kcal).toBe(240);
  await nav("Home").click();
  await page
    .getByRole("button", { name: "Start Workout", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Weight (kg)", exact: true })
    .fill("55");
  await page.getByRole("spinbutton", { name: "Reps", exact: true }).fill("10");
  await page.getByRole("button", { name: "Log set 1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit set 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish session early", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish & see results", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "You showed up.", exact: true }),
  ).toBeVisible();
  saved = await service.call("/api/workspace", { account: service.coach });
  expect(saved.data.sessions).toHaveLength(1);
  expect(saved.data.sessions[0].sets[0].weight).toBe(55);
});

test('pending workout finish keeps its review guarded until acknowledgement and creates one saved session',async({page})=>{
 await clientAccount();await login(page,'client@test.app','client-password-123');
 await page.getByRole('button',{name:'Start Workout',exact:true}).click();await page.getByRole('button',{name:'Log set 1',exact:true}).click();await expect(page.getByRole('button',{name:'Edit set 1',exact:true})).toBeVisible();await page.getByRole('button',{name:'Finish session early',exact:true}).click();
 let release,held=false;const pending=new Promise(resolve=>release=resolve);
 await page.route('**/api/workspace',async route=>{if(route.request().method()==='PATCH'){held=true;await pending;}await route.continue();});
 try{
  await page.getByRole('button',{name:'Finish & see results',exact:true}).click();await expect.poll(()=>held).toBe(true);await expect(page.getByRole('button',{name:'Saving workout…',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Keep going',exact:true})).toBeDisabled();await expect(page.getByRole('dialog',{name:'Ready to finish?',exact:true}).getByRole('button',{name:'Close dialog',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:/^Return to/}).first()).toBeDisabled();
 }finally{release();}
 await expect(page.getByRole('button',{name:'Keep going',exact:true})).toHaveCount(0);const saved=await service.call('/api/workspace',{account:service.coach});expect(saved.data.sessions).toHaveLength(1);expect(saved.data.drafts).toEqual({});
 await page.close();
});
