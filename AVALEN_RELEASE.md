# Avalen — charcoal design & connected local workspace

## Try it

Run `pnpm dev` and open http://127.0.0.1:5173.

- **Explore demo** opens six sample clients with clearly labelled demonstration history.
- **Get Started** creates a clean client profile. Use test code **00000**. Existing profiles are retained.
- Use **Client / Coach** in the header to switch perspectives. This is a preview control, not an authorization boundary.
- On desktop, navigation becomes a sidebar. On smaller screens it stays in the five-tab bottom bar.

## Implemented and connected

### Design

Charcoal backgrounds, restrained emerald/blue/amber/purple data colours, white primary actions, minimalist Avalen mark, mountain onboarding, photography-based workout cards, consistent typography and spacing, mobile safe-area padding, responsive desktop layouts, reduced-motion support, keyboard focus indicators and native modal focus handling.

### Client navigation

**Today** — draggable/native-touch calendar; scheduled, completed, missed and recovery-day states; future workout locking; actual nutrition totals and habit history; check-in shortcut.

**Plan → Training** — coach-prescribed workouts, exercise details and optional uploaded demonstrations; persistent workout drafts; previous-performance prefill; load/repetition controls; effort rating; per-exercise rest timer; undo/skip set; exercise swap; notes; contextual coach messages; early finish with confirmation; duplicate-completion prevention; actual session volume and PR calculation.

**Plan → Nutrition** — structured or flexible prescription; calorie and macro rings; date-specific diary; starter food library with approximate values; favourites; manual foods; meal-photo uploads; nutrition details and entry removal.

**Plan → Habits** — coach-set steps, water, sleep, mobility and custom habits; direct entry, increment controls, target meters and daily persistence.

**Progress** — body-weight scrubbing with pointer and keyboard support; optional vibration where the browser supports it; measurement logging; per-exercise estimated 1RM history; training/nutrition adherence; 12-week consistency map with a colour key and date drill-down; genuine uploaded progress photos with slider comparison; coach-verified InBody graphs; workout history and meaningful milestones.

**Sharing** — completed-workout results and 4/8/12-week progress stories; five photographic backgrounds or a personal photo; 1080×1920 PNG export; device share when supported; downloadable-image fallback; caption copy. Values are taken from saved records. Sharing opens a device sheet or downloads a file; it does not post directly to Instagram.

**Coach** — membership/programme overview, manually recorded price and next due date, member feed with likes/saves, direct messages and attachments, weekly check-ins, previous-check-in score comparison and coach feedback.

**You** — profile, goal, membership shortcut, coaching contact, local-data/privacy explanation, personal JSON export, reduced motion, client-preview switch and fresh-profile onboarding.

### Coach navigation

**Dashboard** — explainable attention queue for stalled weight, missing workouts, late check-ins, nutrition outside target, overdue billing, ending programmes and exercise skips across multiple sessions; direct links to relevant client sections; review/renewal counts; recent training wins.

**Clients** — search; All/Needs attention/On track/Check-in due/Ending soon/Paused filters; new client creation; health snapshot; changes since the previous review; seven-day flag snoozing; decision timeline; client progress and check-in views.

**Client plans** — programme, phase and week count; named days; five preset covers or uploads; exercise search and custom exercise creation; sets/reps/load/rest/RPE/RIR/tempo/notes; optional video; duplicate days; move exercises up or remove; programme templates; assignment with a full-duration schedule; per-date schedule edits; temporary bodyweight travel plans; coach-approved rule-based load suggestions; custom habit targets.

**Nutrition** — flexible/structured targets, meal guidance and calorie edits, reason for changes, immediate reflection in the client view and decision history.

**Inbox** — per-client text/photo/video/audio-file messages, read state within this workspace, saved replies, contextual messages, check-in review and feedback, member-post publishing with photos/videos.

**Business** — manual membership amount/currency/status/due date; subscription CSV export; in-app coach name, brand and uploaded logo. Branding does not dynamically change an installed device’s app icon.

Coach branding is inherited by every client in that coach’s workspace, including future clients. **Business → Brand → Save brand** applies the name/logo together to client headers, desktop navigation, the branded welcome screen and newly exported workout/progress images. Removing the custom logo restores the Avalen mark for everyone. This remains local-workspace behaviour until cloud synchronization is connected; already-downloaded images are not changed retroactively.

**Documents** — actual PDF/image storage and download; manually verified weight/body-fat/muscle values, optionally linked to a report, shown in the client’s graphs.

## Data model and preservation

The new implementation lives in `src/avalen/`. The previous `src/main.jsx` and `src/styles.css` are retained. The entry point now loads the new implementation.

Structured records use `avalen.workspace.v1` in localStorage. Binary uploads use the `avalen-media` IndexedDB database. The old prototype’s storage is not deleted; only a legacy profile name/email is optionally reused. Old prototype workout/nutrition records are not automatically migrated.

Client and coach screens share one local data model. This is not multi-user or multi-device synchronization. Concurrent tabs can overwrite local changes; do not use it as a production data store.

## Honest production boundary

This is a polished **local functional preview**, not an App Store-ready SaaS release. Use test data only.

Not connected:

- Real authentication, secure coach invitations, tenant/role access control and server-side validation.
- Encrypted cloud records, private media storage, backup/restore, audit enforcement, retention and account deletion workflows.
- Live message delivery, push notifications and background jobs.
- Payment collection, verified payment status, recurring billing and payment webhooks.
- AI food recognition, PDF OCR and verified extraction pipelines.
- Wearables, health-platform imports, barcode/large food database integrations.
- Native iOS/Android packaging, store signing, installed-icon branding and real-device certification.

The role switch and 00000 code are deliberately labelled test tools. Uploaded health reports are not protected from another person using this browser profile. No secrets or payment credentials are embedded. File-type/size checks and a restrictive content security policy are present, but they are not substitutes for a backend security review.

## Remaining product roadmap (not represented as finished)

The larger architecture brief also describes configurable alert thresholds, saved roster views, group chat, message reactions/threaded replies, in-app voice recording, leads/forms/automations, advanced set structures (supersets/circuits/drop sets/AMRAP/duration/distance/%1RM), drag-and-drop planning, rep ranges, recurring multi-phase scheduling, additional/custom body measurements, unit conversion and recipes. These require further implementation. Uploaded audio is supported; recording audio inside the app is not.

## Validation

Verified October 11, 2026: production build passed; 8 logic tests passed; all 48 end-to-end cases passed across Chrome and WebKit. Full dependency audit reported zero known advisories after a transitive development-package patch. See AUDIT.md for the repairs and validation scope. This is not a penetration test or a production security certification.

- `pnpm test` — state/attention/completion/travel tests.
- `pnpm test:e2e` — isolated Chrome and WebKit browser flows, including mobile widths 320/390 and tablet/desktop widths 768/1440.
- `pnpm build` — production bundle.

Browser checks cover fresh onboarding, workout persistence, PNG export, two-way check-in review, nutrition edits, food details, habits, programme edits, posts, photo comparisons, documents, InBody graphs, future-day locking, keyboard chart interaction, uploaded covers, membership and branding, all ten top-level screens and horizontal overflow.

WebKit testing is a Safari-engine check, not a claim of testing physical iPhones. Vibration and device share vary by platform.
