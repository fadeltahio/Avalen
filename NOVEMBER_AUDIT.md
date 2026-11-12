# Avalen audit — 1 November 2026

Walked through as a new client and as a coach on a 390px phone viewport, then in light theme and on desktop. Every route and tab was captured, every visible control on the main screens was clicked by a crawler, and the deeper dialogs were opened by hand. Everything ran in fresh browser profiles against this copy on port 5199. The owner's install on port 5173 and its saved data were not touched.

## Overall

Avalen is closer to finished than it feels. The crawler found **no dead buttons and no console errors**. The feeling of "complicated" and "not premium" comes from four things, not from broken features:

1. Too many ways to reach the same place, and too many controls stacked above the content.
2. Primary actions that compete with each other, or move while you use them.
3. Leftovers from older visual directions sitting beside the black-and-white editorial design.
4. Screen titles written as slogans instead of saying where you are.

## What is already good

- The welcome screen, photography and editorial type are the strongest part of the product. Keep them.
- Home hero: one workout, one clear button, a good first read.
- Food logging: search, portion, meal, "after this meal" remaining calories and undo. Tight and well judged.
- Session detail page, and the shared workout artwork.
- The check-in form puts required measurements first.
- The coach's "Up next" review queue is the right idea: it tells the coach what to do first.
- Honest copy about what is not connected. No invented AI, wearable or payment results.

## What was wrong, and what changed

### Client

| Finding | Why it hurt | Change |
| --- | --- | --- |
| The rest timer pushed the Log button down about 80px after each set | The most repeated tap in the app moved under the thumb | Rest now rises from the bottom dock. The Log button stays exactly where it was |
| Log button was mint green | Only saturated block in a black-and-white app | White like every other primary button. Flashes green only to confirm a saved set |
| "Saved as you go" sat on screen permanently | Constant noise | Confirmation appears only when a set saves |
| Exercise photos were saturated stock images with red curtains | Looked cheap against the art-directed photography | Stock exercise images render in black and white. Coach uploads keep their colour |
| Water card was a blue liquid with a lime button | Leftover from an older direction, the most off-brand screen | Monochrome liquid and square controls. Keeps the interaction |
| "0 drinks" shown beside "1.8 L logged" | Contradicted itself | Count appears only when there are drinks to count |
| Workout result repeated itself, and Share sat below the fold | Felt padded, and the point of the screen was hidden | One line of filler removed, whole-number volume, Share and Save pinned to the bottom |
| Train had a Nutrition tab, and the header had a calendar icon that opened Train | Duplicate routes | Both removed. Nutrition has one home |
| Progress had a second chat icon under the header one | Duplicate | Removed |
| More listed the coach three times | Clutter | One "Your coach" entry |
| Date strips showed no month | Unclear around month changes | Month and year above Train and Home strips |
| Nutrition "Daily updates" repeated Home | Long page | Collapsed under one disclosure |
| "1 sessions", a food empty state with a water-drop icon, a chart axis reaching −1 kg, an unstyled grey square for Reduce motion | Small errors that read as unfinished | Fixed. Reduce motion is a real switch |

### Coach

| Finding | Why it hurt | Change |
| --- | --- | --- |
| Inbox was one dropdown and one thread | Could not see who wrote or what they said. The biggest workflow gap | Phone shows a conversation list with preview, date and unread count, then the thread. Desktop shows both |
| A thread opening marked messages read | With a list, a hidden thread would have silently cleared unread counts | Messages are only marked read once the thread is actually open |
| Every review card had a solid white button | Five primary actions at once, so nothing led | Only "Up next" is solid. The rest are outlined |
| Client page had about 360px of chrome above any content | Back link, label, name, goal, actions, tabs and "More sections" as separate rows | Back and Next review share one row, duplicate label and avatar removed, More sits in the tab row |
| Paused filter existed but nothing could pause a client | Dead end, called out in `FUNCTIONAL_REVIEW.md` | Pause and Resume coaching with a clear explanation. Membership is not changed. Saved to the coaching timeline |
| Coach saw client wording on a client's progress ("Your focus", "View your lifts") | Wrong voice | Coach view has its own copy on the Overview tab |

### Both

**Workouts finished just after midnight were rejected.** This older bug is the most serious thing the audit found. The browser dates a workout by the client's local day, but the account service compared it with the plan's timezone, which defaults to UTC. In Egypt that left two to three hours after each midnight when a connected client's finished workout failed with "The completed workout contains invalid dates or set values." The service now rejects only a date no timezone has reached, so a client could at most log a workout dated one day ahead. Who may write records is unchanged. Check-ins have the related problem described below.

Slogan titles were replaced with plain names: "Made for you." → You, "In your corner." → Your coach, "Your people." → Clients, "Better plans. Less admin." → Programs, "A healthier business." → Business. The editorial voice stays on Home and Welcome, where it belongs.

## Motion added

All of it respects the system and in-app reduced-motion settings, and no animation delays or triggers a save.

- **Splash:** wordmark letters arrive one by one.
- **Welcome:** photograph settles, then the words rise in sequence.
- **Sheets:** on phones every dialog rises from the bottom with a drag handle and leaves the same way.
- **Screens:** each screen settles in once per session, then sections reveal as you scroll. It never replays on return.
- **Home:** the hero photograph settles on the first arrival of a session.
- **Rings:** nutrition rings sweep up once, then only move when values change.
- **Workout:** Log flashes green with a check when a set saves, and rest rises from the dock.
- **Details:** date strip glides to the chosen day, nav icons pop on selection, arrows nudge on press, inbox threads slide in.

## Still needs a decision or real work

| Item | Note |
| --- | --- |
| Check-ins dated by the plan's timezone, default UTC | **Not fixed.** In Egypt, a check-in sent just after midnight is saved under the previous day. Nothing is lost, but the date is wrong. The real fix is to store each client's timezone at sign-up instead of defaulting to UTC, which changes scheduling and reminders, so it needs its own pass |
| Client messages sit under More | Coaching is the product, yet the coach is not in the bottom bar. Worth considering a Coach tab in place of More, with settings behind the avatar. Not changed, because it reshapes navigation |
| FormLab name | A client will not know what it means. "Technique" would be clearer. Not changed, it is a brand decision |
| Programs is empty in the demo | Every demo client is on a programme, yet the coach sees "Create your first programme". The seed may also feed real workspaces, so it was left alone |
| Programme builder | Long on a phone, and "Reason for change" appears even when building a template. Needs its own pass |
| Programs or programmes | Navigation says Programs, the app elsewhere says programme. Pick one |
| "Your photos, your pace" and InBody copy | Still client-voiced in the coach view of Photos and Body. The Overview tab is corrected, these two are not |
| Paused clients see no indication | Coaching pauses silently on their side |
| Light theme | Holds up well. Worth a dedicated pass on older cards |

Handoff priorities are unchanged and still come next: explicit deployment mode, account recovery, staging with tested restores, and a physical iPhone pilot.

## Verification

- `npm test`: 52 of 52 passed.
- `npm run build`: passed.
- Browser tests, Chrome, phone viewport: **there was no single clean 105 of 105 run.** The full run gave 96 passed and 9 failed. Every failure was diagnosed, then those tests, the five new tests in `tests/november-audit.spec.js` and all of `tests/functional-review.spec.js` were rerun: **31 of 31 passed.**
- The 96 passes came before the "You put in the work." heading was restored and before the test edits below. The coach-tab spacing rule was added after the 31 passes, so no browser suite ran on it. It was measured directly instead: 12px between tabs and More at 320, 375, 390 and 430px, with no sideways scroll.

The 9 failures:

| Count | Cause | Outcome |
| --- | --- | --- |
| 3 | I removed the "You put in the work." heading | Heading restored |
| 1 | Test used the old inbox dropdown | Test updated |
| 1 | Test still clicked the Train → Nutrition tab, removed on purpose | Test updated |
| 1 | Test measured a dialog while the new sheet was still rising | Test now waits for the animation |
| 1 | Check-in date test, run between local midnight and UTC midnight | Passed in a browser set to UTC and passed again after UTC midnight. The bug is listed above and is not fixed |
| 2 | Timeouts, one while still setting up the page | Passed on rerun. The Mac was overloaded: load average above 30 with almost no free memory |

Testing also caught a bug in the new inbox: tapping any client other than the active one did not open their thread, because changing the active client remounts the whole page. Fixed, with a regression test. An older bookmark test could never finish because it clicked Account on a screen that hides the header. That test was corrected. Existing tests in `premium-polish`, `repair-polish`, `signature-flows`, `product-refinements` and `functional-review` were edited for the reasons above.

`playwright.audit.config.js` runs the suite against this copy on port 5199. Use it instead of `playwright.config.js` while the original install is on port 5173, because the default config silently reuses whatever answers there.

Not tested: a physical iPhone, WebKit, and real keyboard, camera or microphone behaviour. Animation smoothness on a real mid-range phone is unmeasured, and this Mac was too overloaded to judge it.

## Second pass: recovery, sign-up questions, load-in and coach pages

Added after the audit above. The Verification section above describes the earlier pass only.

- **Live recovery map:** a front and back body map for clients and for coaches viewing a client. It shows which muscles were trained, which are recovering and which are ready, with a preview of tomorrow and two days out. It is an estimate from logged sets and says so on screen. The recovery windows are working defaults informed by published research, not measured values.
- **Sign-up questions:** after joining, a client answers training, injury and health questions that reach the coach automatically. A "Yes" on the health question is flagged by the account service, so a client cannot clear it. The coach sees "New client intake" first in the review queue and can mark it reviewed.
- **Load-in:** a curtain lifts off the wordmark and the first screen settles in beneath it.
- **Coach pages:** compact review queue and client cards, a shorter client page, and a sticky tab row.

### Bugs found by the full test run

| Bug | Cause | Outcome |
| --- | --- | --- |
| Clients page wider than the screen beside the sidebar at 768px. Stats spilled out of each card (266px of content in 226px) | My compact client cards used a row that could not wrap | Fixed, with a regression test that failed before the fix |
| Welcome photo pushed the page 14px sideways while it settled | My photo animation was not clipped | Fixed, with a regression test that failed before the fix |

The 768px test only failed sometimes because it measured before the client cards had loaded. After the fix, every coach and client main screen was swept at 320, 375, 390, 430, 761, 768, 800, 900, 1024 and 1280px, recording every animation frame: no sideways overflow. Screens deeper than the main navigation were not swept.

The connected bookmark test (`functional-review:220`) timed out once in this pass and passed in the runs either side of it. Its cause is **not proven**. Its timeout on 31 October is a separate matter: that was the hidden Account button described above, already corrected. `tests/helpers/service.js` now closes open sockets at shutdown, which removes one confirmed way for that step to hang, but a silent socket never appeared in 16 timed runs, so that may not be why it failed. Treat this test as possibly flaky.

### Verification

On the final code, in Chrome:

- `npm test`: 62 of 62 passed.
- All browser suites, 135 tests, for the first time in this work: **110 passed and 25 failed.** One failure, `workout-logger:13`, passed on rerun; the Mac had gone to sleep during that run. That makes 111 of 135.
- The other 24 also fail on the original 1 November zip, run with its own tests. All 24 stop at the same steps on both versions, so these are not regressions from this work.

Earlier passes ran only part of the suite. Reports of "85 of 87" and "31 of 31" did not include these 24 tests.

Those 24 tests in `branding`, `flows`, `glass-navigation`, `ice-design`, `reference-design`, `visual-polish` and `water-optics` are out of date. Fifteen look for navigation labels that no longer exist (`Today`, `Plan`, `You`, `Coach`). They stop early, so **they currently check nothing past that step**, such as water logging and custom habits. Those flows have less automated cover than the suite size suggests until the tests are rewritten.

Still not tested: a physical iPhone beyond opening the app, WebKit, and animation smoothness on a real phone.

## Third pass: WHOOP loader and training flow

Studied from a 73-second WHOOP screen recording. Ideas were adapted, not copied: Avalen keeps its own mark and its black-and-white look, with no green or blue accents.

| WHOOP idea | Decision |
| --- | --- |
| Logo draws itself: an arc sweeps clockwise while the letter is drawn inside, then the screen fades up beneath | **Adopted** with Avalen's A. It lives in `index.html`, so it is already moving before the app has loaded. It leaves only once fully drawn |
| Black loader on every screen change | **Rejected.** WHOOP is waiting on a network. Showing it when Avalen has nothing to wait for would be a fake delay. The mark appears only on a real wait, and only after 220ms so a quick load never flashes it |
| Exercises expand in place, with a Start button always on screen | **Adopted.** Session rows open to show target sets and the client's last sets. Begin Workout is pinned to the bottom |
| Exercise page with Progress, History and Instructions | **Adopted.** Reachable from a session and from Progress → Strength, for clients and for coaches viewing a client. Pills follow the scroll and jump to a section |
| Volume chart you can scrub | **Adopted.** Press or drag to read a session, or use the keyboard. Month and six-month ranges |
| Personal records | **Adopted.** Top three distinct sets, dated to the first day each was reached |
| Floating logo button in the navigation | **Not adopted.** It reshapes navigation, which is still an open decision above |

Every number on the exercise page comes from logged sets. Skipped sets never count, and bodyweight and timed exercises report reps or seconds instead of kilograms. With nothing logged, the page says so.

### Bug found by looking at the screens

All 12 new browser tests passed while the ring **vanished at the end of the loader**. The final dash pattern moved the whole circle into the gap. Screenshots of each stage showed it. A regression test failed before the fix (gap 283) and passes after it (gap 0).

### Verification

On the final code, in Chrome:

- `npm test`: 67 of 67 passed.
- All browser suites, 148 tests: **124 passed and 24 failed.** The 24 are the same tests described in the second pass, and each stops at the same step as before, so none is a regression. `workout-logger:13` and the bookmark test `functional-review:220` both passed.
- Layout was checked at 320 and 390px on the session and exercise pages: no sideways scroll, and the workout button stays on screen. No page errors during the capture run.

Not tested: a physical iPhone, WebKit, and chart scrubbing by finger. Scrubbing was tested with a mouse and a keyboard. Where a browser lacks scroll-linked animation, the exercise photo simply stays still.
