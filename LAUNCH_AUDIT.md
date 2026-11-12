# Avalen launch audit — 7 November 2026

First deep audit and polish run toward App Store and Google Play. Scope: what works, what blocks real coaches and clients, what to change in the workflow, and what to remove.

## Built in this pass

| Area | What changed | Verified |
|---|---|---|
| Launch | The Avalen mark draws, settles, then the name opens out of it before the app appears. Once per session; tap skips; reduced motion shows it still. | Frame captures at 390 px; launch tests pass |
| Workout logger | Bigger number pads with round steppers that animate the value; set progress pips; prescription chips; logged sets as cards that pop in; the screen stays awake during a workout (where the browser allows). | Logger, signature and essential-flow suites pass (33/33) |
| Rest timer | A rest card rises from the bottom with a large ring and time. When rest ends: the ring closes, a check draws itself, two ripples, a vibration, and one **Next set** button that returns you to the log button with a pulse. | Captured running, done and next-set states |
| Exercise complete | Drawn check, "Exercise complete", up-next card. | Captured |
| Avalen assistant | Floating animated mark on every main screen. Opens a chat with preset questions and free typing. Client: week, next workout, protein, best lifts, focus. Coach: who needs attention, check-ins due, missed workouts, client summary, overdue payments. Answers come only from saved records; anything else says plainly that open AI is not connected. Coach answers link straight to the client. | 4 unit tests; captured as client and coach |
| Food | Library grows from 10 to 49 foods, including 39 everyday Egyptian dishes and staples with Arabic names and alternative spellings (foul, tameya, koshary…). Barcode lookup through Open Food Facts (about 4,600 products sold in Egypt, e.g. Juhayna, Domty). Camera scanning where the browser supports it, typed barcode everywhere. Not-found products go straight to manual entry. Photo diary unchanged. | 4 unit tests; a real Juhayna barcode (6222014330674) loads label values into review |

Egyptian dish values are typical home-style estimates per stated portion, checked so energy from protein, carbs and fat sits within 20% of the stated calories. Packaged products use their own label values from Open Food Facts. There is no public database of every Zahran, Kheir Zaman or Seoudi product; the barcode route covers what shoppers actually scan, and the community database grows as products are added.

## Launch blockers (must fix before public release)

1. **Hosted backend.** Coach ↔ client sharing only works in connected mode, which today runs only on port 5180 or with `?connected=1`. Needs an HTTPS deployment with backups and monitoring.
2. **Account recovery and deletion.** No forgotten-password, password-change or in-app account deletion. Apple requires in-app deletion for apps with account creation (Guideline 5.1.1(v)). Password reset needs an email provider.
3. **Native apps.** No Capacitor/iOS/Android projects yet. Xcode is not installed on this Mac. Apple Developer ($99/yr) and Google Play ($25 once) accounts are not open yet.
4. **Google Play testing rule.** New personal developer accounts must run a closed test with 12 testers for 14 continuous days before production.
5. **Privacy.** Privacy policy URL, App Store privacy labels and Play data-safety form. Health and body data need a clear statement of what is stored and where.
6. **App Review demo.** Reviewers need a working demo login. Keep the demo workspace but make it a proper review account in connected mode.

## Workflow: what to improve

- **Role switcher in the header** ("Client ▾ / Coach"). Right for the demo, wrong for real accounts — a client must never see a coach switch. Show it only in demo mode.
- **Camera barcode on iPhone.** Safari has no barcode detector, so iPhone users type the number today. The native build should use the ML Kit / Vision scanner plugin.
- **Photo tab in food logging.** Recognition is not connected; it is a photo diary. Rename the tab "Photo diary" or move it under Manual until recognition exists, so it does not look broken.
- **Assistant free text.** Unknown questions get an honest fallback. Connecting a real AI provider is a paid, consent-gated step (the server already has the consent and HTTPS guard).
- **Rest alerts while locked.** The web app cannot alert on the lock screen. With the native build: local notification when rest ends, then an iOS Live Activity (lock-screen/Dynamic Island workout card) and an Android ongoing notification.

## What to remove or consolidate

- **Archived prototype** `src/main.jsx` and its old styles: not used by the active entry; remove from the shipped bundle.
- **Layered logger styles.** Logger rules are spread over more than ten stylesheets that override each other. `logger-premium.css` is now the final layer; fold the older layers into it once the design is settled.
- **Stale browser tests.** About 24 older tests still look for removed labels (e.g. old nav names) and stop early. Rewrite them against the current UI so a red test always means a real bug.

## Verification this pass

- Unit tests: 75/75 pass (includes 8 new: assistant and food library).
- Browser, full suite: 124/148 pass. The 24 failures are the same stale tests as before this pass (they look for old nav labels such as "You", "Plan", "Today", "Coach"); none involve the new logger, assistant or food code.
- The first full run caught two real regressions, both fixed and re-verified (37/37 on the affected suites): stepper buttons measured 43.99 px against a 44 px minimum, and the assistant's looping idle animation kept pages from ever settling. The assistant now animates on arrival and while thinking, then rests.
- Production build: passes.
- Not yet verified: a physical iPhone and Android phone, Safari/WebKit, camera scanning on a real device, VoiceOver.
