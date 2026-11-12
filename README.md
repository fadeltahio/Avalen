# Avalen

A responsive coaching workspace built with React and Vite. The current design uses black, white and photographic session layouts; light mode is available under More → Appearance. The active application is in `src/avalen/`; the older prototype in `src/main.jsx` is retained but is not loaded.

## Run

From this folder, with Node.js installed:

```sh
pnpm install --frozen-lockfile
npm run dev -- --port 5173
```

Open [Avalen locally](http://127.0.0.1:5173). Existing installations can simply run the second command. Use Skip for now or Let’s go with test coach code **00000**. Switch Client/Coach at the top. The server must stay running while you test; it permits testing over a trusted local network.

```sh
npm test
npm run build
npx playwright test tests/editorial-flow.spec.js
```

Browser tests use Chrome and Playwright WebKit. Install WebKit with `pnpm exec playwright install webkit`; set `CHROME_PATH` if Chrome is not in the default macOS Applications folder. Tests use isolated browser profiles, not your saved app profile.

## Navigation

- Client: Home, Train (training/nutrition/habits), Nutrition (coach targets/meal plan/diary/photo logging), Activity, More (profile/coach/membership/appearance/devices/privacy). Tap a session photograph for details, save a session with the star, or download its scheduled calendar event.
- Coach: Dashboard, Clients (plans/nutrition/progress/check-ins/documents/billing), Programs, Inbox, Business.
- Workouts: editable sets/reps, previous results, rest timer, swap/skip, pause/resume, completion summary and downloadable 1080×1920 story artwork using background photos or an uploaded photo.
- Coach branding is shared with all clients **inside this local workspace**. It does not remotely update separate devices or change native launcher icons.

## Important boundaries

The default development URL opens the **device preview**. Its records are saved in this browser's localStorage; uploaded photos, videos and PDFs live in IndexedDB. Use test data only in this mode. JSON exports contain records, not the underlying media files. Clearing browser storage can lose data; changing browsers/ports creates a separate workspace.

The role switch and code 00000 are not authentication. Messaging and payments are local records, not remotely delivered messages or card charges. Apple Health/WHOOP are clearly marked not connected. Food photos and InBody reports require manual, verified entries; there is no pretend AI scan. Attention flags are rule-based, not AI diagnoses.

The separate **connected workspace** implements authenticated coach/client accounts, private invitations, account authorization, server persistence, private media and revision-checked saves. Run `npm run dev:connected` and open `http://127.0.0.1:5173/?connected=1`; for a production bundle, run `npm run build` then `npm start` and open `http://127.0.0.1:5180/`. First-time owner setup requires the service setup token. See [ECOSYSTEM_SETUP.md](ECOSYSTEM_SETUP.md) for setup, supported scope and existing-record migration. One owner workspace is supported per service; this is not public multi-coach signup.

Public release still needs configured HTTPS hosting, monitored persistent storage and tested backups/recovery, account recovery and lifecycle controls, the chosen external integrations, privacy/security review, and native builds/App Store submission. The connected-mode default also needs explicit deployment configuration before using a different public port; see [FUNCTIONAL_REVIEW.md](FUNCTIONAL_REVIEW.md). There is no offline service-worker guarantee.

See [AUDIT.md](AUDIT.md) for repairs, validation and remaining limitations. Shared design values live in `src/avalen/tokens.css`; motion respects both system Reduce Motion and the app preference. No new animation library was required.

## Reference design update — 12 October 2026

The app now includes a photo-backed set/rep logger, inline coach demonstration videos, eleven exercise photographs, coach exercise-photo uploads, an animated liquid water tracker, an expanding glass navigation pill and glowing saved-set feedback. Nutrition has Daily updates with meal summaries, coach-target recommendations and water logging.

See [REFERENCE_DESIGN_UPDATE.md](REFERENCE_DESIGN_UPDATE.md) for usage, asset provenance, validation results and fidelity limits. Custom exercises support coach media and otherwise use a labelled group cover.

## Premium redesign — 14 October 2026

The current interface uses Newsreader display typography, Space Grotesk body text, deep ink surfaces, warm ivory controls and a restrained sage accent. Home leads with a single workout, then daily nutrition and interactive water tracking, then the latest coach message. Navigation stays labeled. Nutrition puts the food diary before secondary recommendations, and the calendar keeps its selected day visible when resized. See [PREMIUM_REDESIGN.md](PREMIUM_REDESIGN.md) for the design and validation notes. [OLIVE_WATER_UPDATE.md](OLIVE_WATER_UPDATE.md) records the preceding water-rendering work.


## Previous ice reference — 14 October 2026

The latest requested reference uses pale ice blue, monochrome fitness imagery, rounded date capsules and white pill controls. The active stylesheet is `src/avalen/ice-design.css`. Existing workspaces adopt light once while preserving records, and subsequent theme choices persist. See [ICE_REFERENCE_UPDATE.md](ICE_REFERENCE_UPDATE.md) for the design, generated studio asset and validation notes.


## Glass and typography refinement

The icy reference now uses Manrope text with Space Grotesk headings, translucent glass surfaces, and a mobile glass capsule with a sliding active-tab lens. See [GLASS_REFINEMENT.md](GLASS_REFINEMENT.md) for the material, font files, fallbacks and validation.


## Previous smoked-glass direction

The latest supplied references are implemented in `src/avalen/atmosphere.css`: an atmospheric blurred photographic canvas, large lightweight white type, simpler session sheets and brighter glass control edges. The previous ice skin is no longer loaded. See [SMOKED_GLASS_UPDATE.md](SMOKED_GLASS_UPDATE.md) for layout changes, record preservation and review captures.


## Current editorial design — 16 October 2026

The latest supplied Equinox references replace the glass appearance. The active skin is `src/avalen/editorial.css`, with the new home and session detail flow in `src/avalen/editorial.jsx`. The launch wordmark, full-photo welcome, quick setup, staggered session images, labeled bottom navigation, and full-screen details follow the supplied direction using Avalen branding and existing training data.

The one-time `editorial-v1` appearance migration sets black as the default and preserves all records; later light/dark choices persist. Existing image/video uploads, workout drafts, water logs and coach functionality remain available. New session favorites are stored per client. The calendar action downloads an all-day event on the coach’s scheduled date. It does not remotely book or reschedule a session.

The active browser checks are `tests/editorial-flow.spec.js`. Older visual-reference tests document superseded designs and navigation. Review captures are in `output/editorial-reference/`.

Validation: production build and all 8 unit checks passed. The current editorial, nutrition and workout flows have 30 browser scenarios verified in Chrome and WebKit, including 320, 390, 768 and 1440 pixel layouts and record preservation.


## Coach plans and nutrition — 16 October 2026

Home now shows live calorie/macro rings against the coach’s prescription, a meal suggestion, photo/manual food logging and scheduled training. Nutrition has its own main navigation item and shows the coach’s meal plan. The photo flow supports capture/upload, portion review and confirmation before updating the diary; automatic recognition is deferred at the user’s request and labeled coming soon. The coach can edit daily targets and each meal’s calories and macros. See [DESIGN_AND_NUTRITION_UPDATE.md](DESIGN_AND_NUTRITION_UPDATE.md) for sources, image prompts, media paths and behavior.
