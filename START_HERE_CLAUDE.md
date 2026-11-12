# Avalen — Claude Code handoff

Prepared 1 November 2026. This is a source snapshot of the current Avalen coaching app, including the changes from the October functional review. It supersedes the old October 11 handoff. Read this file and `FUNCTIONAL_REVIEW.md` before continuing.

## Start working

If you are on the original Mac, you can open Claude Code directly in the existing `coachos-premium` folder. If using the ZIP, extract it and open its `coachos-premium` folder as your project. Do not overwrite an existing installation or its saved data with an extracted copy.

Requirements: Node.js 24 or later and pnpm. Connected media checks also require ffmpeg and ffprobe. Dependencies and generated build files are omitted from the ZIP.

```sh
pnpm install --frozen-lockfile
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`. Choose **Skip for now** to explore demo records, or **Let’s go** / **Get Started** with preview coach code **00000**. The Client/Coach selector is a preview tool. Appearance is under **More → Appearance**.

For authenticated accounts, follow `ECOSYSTEM_SETUP.md`. Copy `.env.example` to `.env`, choose your own setup token and settings, then:

```sh
npm run dev:connected
```

Open `http://127.0.0.1:5173/?connected=1`. This starts the interface on 5173 and the account service on 5180. If the interface is already running, start only `npm run server`. Owner setup must use the owner's own credentials. The last inspected local service was not configured; do not assume that it is currently running or that an owner account exists.

For a built version:

```sh
npm run build
npm start
```

Open `http://127.0.0.1:5180/`. Do not open `index.html` directly from the filesystem.

## Product direction to preserve

The user wants a professional, premium coaching app with clear daily actions, comfortable phone layouts, smooth motion, simple workout logging, useful coach tools and attractive workout-share artwork. Preserve the current black-and-white editorial direction, photography, typography, light theme and reduced-motion behavior. Do not restore an older visual direction from historical documents.

Keep existing features and records. Make real actions dependable; do not replace functional screens with decorative placeholders, fabricate AI results or claim a service is connected when it is not. Routine fixes can proceed within the user's requested scope; substantial new product direction should be discussed with the user.

## Architecture and active files

- `index.html` loads **`src/avalen/main.jsx`**, the active entry. `src/main.jsx` and `src/styles.css` are archived prototypes.
- `main.jsx`: application shell, onboarding, routes, profile, account entry and workout overlays.
- `store.js`, `persistence.js`, `local-transaction.js`, `seed.js`, `context.js`: browser records, migration, IndexedDB media, acknowledged local writes and shared state.
- `workspace-save.js`: shared form save acknowledgement, inline failure state and duplicate-submit guard added in the latest review.
- `editorial.jsx`, `nutrition-home.jsx`, `WeekRhythm.jsx`: current home, session cards/details/search, nutrition overview and real training-week navigation.
- `client.jsx`, `communication.jsx`, `insights.jsx`, `checkins.jsx`: client plan/progress, food logging, habits, messaging/feed, check-ins and associated coach editors.
- `coach.jsx`, `coach-review.js`: review queue, clients, programme/nutrition/schedule editors, templates, branding, manual billing and documents.
- `WorkoutLogger.jsx`, `workout.jsx`, `workout-input.js`, `RestTimer.jsx`, `rest-timer.js`: set entry, corrections, notes, timers, resume, completion and share exports.
- `src/avalen/ecosystem/`: account connection, commands, coaching memory, check-ins, scheduling, private technique-video review (FormLab), evidence-based observations, recording/uploads and optional provider adapters.
- `server/`: HTTP service, SQLite, permission projections, private media, optional AI adapter and background jobs. One owner workspace is supported per service; public multi-coach signup is not implemented.
- `public/`, `src/assets/`: required images, exercise content, local fonts, icon/manifest and theme boot script. Preserve asset license/source notes.
- Active CSS imports are defined in `src/avalen/main.jsx`. They currently include `tokens.css`, `avalen.css`, `refinements.css`, `workout-logger.css`, `reference-design.css`, `editorial.css`, `product-refinements.css`, `checkins.css`, `ecosystem/ecosystem.css`, `motion.css`, `essential-flows.css` and `experience-polish.css`. Historical stylesheet files are not all active.

## Changes already made in the latest review

1. Added acknowledged saving to profile/onboarding, manual activity/device preferences, client creation, programme assignment, brand, membership, habit targets, report measurements and custom-exercise creation. Failed input stays in place; the relevant controls are guarded while saving.
2. Retained a prepared PDF/image report after metadata-save failure and added an explicit retry using the same record ID.
3. Fixed travel-session details by resolving the prescription for the selected date, and made upcoming cards respect travel mode.
4. Added account-service retry without erasing typed sign-in details, plus visible failure/retry behavior for sign-out.
5. Corrected misleading connected-versus-device copy and the claim that a fresh test profile clears existing records.
6. Allowed authenticated clients to save/unsave their own session bookmarks. `server/permissions.js` now projects and validates `savedSessions` while keeping programme edits and other profiles protected.
7. Added `tests/functional-review.spec.js` and `tests/saved-sessions.test.js`. Aligned `tests/shared-polish.spec.js` with current screen names. Existing nutrition, workout, motion, draft recovery and connected-coaching tests remain.

## Highest-priority next work

Consult the detailed table in `FUNCTIONAL_REVIEW.md`.

1. **Explicit deployment mode.** Connected mode currently depends on port 5180 or `?connected=1`. A public HTTPS root on port 443, or the manifest's `/` launch URL, may open device preview. Make the production mode explicit and check root, invitation, logout return and installed-app relaunch.
2. **Account lifecycle.** Add the chosen forgotten-password/recovery, credential-change, session-revocation and account-removal flows. Clarify that profile email is coaching contact information, separate from sign-in email.
3. **Operational staging.** Configure private persistent storage, HTTPS, secure cookies, monitoring and tested database/media restore. The app code alone does not establish deployment readiness.
4. **Coaching pause/resume.** The Paused filter and reminder/review logic use `client.paused`, but the coach has no exposed pause/resume control. Membership status is separate; do not silently treat it as coaching state.
5. **Small UX cleanup.** Clarify the duplicate Nutrition destination in Train and main navigation; show the selected month/year above the calendar strip.
6. **Real phone pilot.** Check keyboard, camera/file picker, microphone, video feedback, app backgrounding/rest timers and interrupted saves on physical phones.
7. **Integrations and distribution.** Wearable syncing, actual payments, external push/email, automatic meal recognition and PDF extraction remain unconfigured or deliberately deferred. Native App Store distribution is a later delivery task.

## Data and service boundaries

Device preview uses localStorage for records and IndexedDB for binary media. A phone, different browser or different origin has separate local data. The LAN QR URL from the previous session is not portable and must be regenerated from the current Mac's Wi-Fi address. Keep the development server running while trying it on the same Wi-Fi.

Connected mode uses server accounts, invitations, authorized projections, revision-checked persistence and private media. Do not replace its authorization with the preview role selector. A JSON record export does not include underlying uploaded file bytes. Existing local workspaces require the explicit documented import workflow.

The ZIP excludes `.avalen-data/`, actual `.env` files, browser records/media, node_modules, generated builds, old screenshots/traces/logs and Git history. It includes `.env.example`, source assets and synthetic test fixtures. Real records and credentials need a separate intentional migration, not a source archive.

## Verification status — read before claiming completion

- The last completed full unit/API run in this chat passed **52 tests**, including the session-bookmark authorization regression. Fresh handoff checks also pass: **52/52 unit/API tests and the production build**. See `HANDOFF_VALIDATION.md` for their scope and limitations.
- The previous broad browser review and focused rerun were interrupted across environment restarts. Final JSON reports were not retained. **Do not claim all browser tests passed or that every button is certified.**
- Individual repairs were checked during that work, and isolated retry/travel screenshots exist in the original workspace. Screenshots do not replace a completed final regression run.
- Some older browser suites describe superseded visual references and labels. Diagnose failures against the active application before changing product behavior to satisfy an obsolete selector.

Recommended checks:

```sh
npm test
npm run build
pnpm exec playwright install webkit
pnpm exec playwright test tests/functional-review.spec.js tests/editorial-flow.spec.js tests/shared-polish.spec.js
```

The Chrome project defaults to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Set `CHROME_PATH` to your installed executable on another platform; install/adjust the browser setup as needed. Read `playwright.config.js` before running. `tests/functional-review.spec.js` includes real temporary coach/client accounts, held saves, retry paths, report downloads and bookmark persistence; connected tests require the production build and ffmpeg/ffprobe where media is exercised.

Broader current regression suites include `ecosystem`, `essential-flows`, `signature-flows`, `premium-polish`, `product-refinements`, `nutrition-home`, `workout-logger`, `checkins`, `repair-polish`, `phone-preview` and `motion` spec files. Run relevant checks in isolated profiles and temporary services. Never use the user's saved browser data or `.avalen-data` as test fixtures.

## Documentation order

1. This handoff and `CLAUDE.md`.
2. `HANDOFF_VALIDATION.md` for the package's actual checks.
3. `FUNCTIONAL_REVIEW.md` for current issues and priorities.
4. `ECOSYSTEM_SETUP.md` for accounts, storage, privacy and provider contracts.
5. `SIGNATURE_FLOWS.md`, `PREMIUM_AUDIT.md` and `MOTION_DESIGN.md` for the recent product work.
6. `README.md` for commands and context. Its dated historical sections document earlier directions; source imports define what is active.

## Version control

The project was untracked inside the parent workspace at handoff time. The archive contains no Git repository/history. Do not change global Git identity. Initialize or attach version control in the chosen working directory using the user's own identity and repository.

## Suggested first message to Claude Code

Read CLAUDE.md, START_HERE_CLAUDE.md, HANDOFF_VALIDATION.md and FUNCTIONAL_REVIEW.md. Continue building Avalen from this source snapshot. Preserve the current design and existing features/data. First verify the current build and focused browser regressions, then address deployment-mode routing, account recovery and coaching pause/resume in that order. Explain material tradeoffs and record what was actually tested. Do not treat historical test counts as proof of the current version.
