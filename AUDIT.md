# Avalen — audit and polish

## Baseline (11 October 2026)

Active app: `src/avalen/main.jsx`, React/Vite; structured records in localStorage, media in IndexedDB. The older `src/main.jsx` and `src/styles.css` are archived and not imported. Preserve them and all user data.

Baseline: 3/3 unit tests and production build pass. Browser suite: 24/28 pass (Chrome 14/14; WebKit 10/14). WebKit failures involve two image-download waits, one screenshot timeout, and a logger correction flow. These require regression checks, not an assumption that Safari is supported perfectly.

## Functional findings

- Contextual coach messages can select the wrong client; removing message context clears typed text.
- Async feed, meal, message and exercise-video uploads can race, erase edits or target a reordered exercise. Publishing/exporting can run before uploads finish.
- Program numbers accept invalid/fractional values; assignment schedules only 28 days regardless of duration. Invalid schedule dates fail silently.
- Exercise swaps can hide retained high-numbered sets. Resume summary can overlook unfinished earlier exercises.
- Workout shares drop custom covers, can export an old background during upload, and do not constrain long titles.
- Consistency mishandles rest days, off-target food logs and clients without habits. Missing chart values become zero. Measurement defaults depend on insertion order.
- Whitespace validation, repeated submissions, stale success feedback and upload errors need attention.
- Browser-storage recovery must not overwrite unreadable records. Modal accessible names, media loading/error states and input labels need improvement.

## Smoothness and visual findings

- Light-mode preference exists without a complete light palette; appearance/device controls lack styling.
- Scattered colors, spacing and motion values undermine consistency. Some small supporting text lacks contrast, and some controls are undersized.
- Per-keystroke workspace persistence and repeated history calculations add avoidable work.
- Keep motion purposeful and limited to transform/opacity; respect reduced motion, preserve readable charts and avoid layout shifts.

## External requirements — not pretend integrations

This is a local preview, not a secure multi-user service. Real authentication/authorization, remote messaging and synchronization, payment processing, Apple Health/WHOOP, automatic food/InBody analysis, backup/recovery infrastructure, and native App Store packaging need separate service setup and credentials. Existing honest unavailable/manual states must remain. Do not use real sensitive client records in the preview.

## Repair results

### Shared foundation — implemented

- Missing chart readings stay absent instead of producing zero dips; chart history is sorted and supports Home/End keys.
- Named dialogs, keyboard focus return, inline field errors, whitespace checks, explicit non-submit button defaults, skip-to-content link and media failure/loading states.
- Unreadable/unsupported local workspaces stop in a recovery screen with a downloadable raw copy; they are not overwritten by demo records.
- Target-aware message context and coach-wide unread count; coach pages are loaded on demand with a skeleton state.
- Media URLs cannot briefly point to the previously selected file. Downloads attach a real link and retain image URLs longer for WebKit.
- Transitive development dependency `source-map-js` updated from 1.2.1 to 1.2.2 for [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Full pnpm audit now reports zero known vulnerabilities; no application dependency added. This is not a penetration test or production security certification.

### Client and coach repairs — implemented

- Contextual messages open and remain with the selected client. Removing context preserves the typed message. Coach feed reactions use a coach identity.
- Feed, meal and message uploads use synchronous guards; publishing cannot run before an attachment is stored. Feed upload completion preserves intervening text edits. Exercise demonstration and cover uploads resolve by stable IDs and block programme saving while pending.
- Programmes validate finite/ranged numbers and whole set/rep/week counts; assignment schedules the complete block. Invalid schedule dates show feedback and disable saving.
- Exercise swaps retain all saved set numbers. Resume cards also find unfinished earlier exercises. Demonstration videos are available in the live logger, and history calculations are memoized across timer ticks.
- Session records retain coach-uploaded covers. Sharing waits for custom media and constrains long canvas titles. Image export succeeds in Chrome and WebKit.
- Consistency distinguishes rest days, partial nutrition and empty habit configuration. Measurements load the selected date's existing record and preserve omitted saved fields. Habit input handles intermediate blank values and retains save-as-you-go persistence, including immediate reloads; quarter-litre increments retain their precision.
- Membership/nutrition/habit confirmations clear on edits; revised check-ins label prior feedback. InBody saves show confirmation and reject identical repeated records.

### Visual and smoothness repairs — implemented

- Shared palette, typography, spacing, radius, shadow and motion tokens in `tokens.css`; active palette consolidated without changing archived source. Unique component geometry still uses local values rather than converting every literal to a token.
- Complete light palette and improved dark palette, settings/device cards, resume-card styling, larger controls and mobile supporting text.
- Page/card entrances, navigation accents, dialog transitions, updated-number fades and loading skeletons use transform/opacity. Both system and app reduced-motion preferences suppress animation. Dialog entrances preserve full-size tap targets.
- Coach routes load on demand; media uses lazy decoding/loading where appropriate and intentional unavailable-file states.

### Final verification — 11 October 2026

- **8/8 unit tests pass. Production build passes. 48/48 browser tests pass** in one final run across Chrome and WebKit (4.1 minutes).
- Coverage includes fresh onboarding, stored drafts and immediate reload, correction/undo/rest/swap-adjacent logging, check-ins, plans, nutrition, habits, photos, PDFs/InBody, coach branding, PNG downloads, contextual messaging, delayed uploads, validation, recovery, keyboard interaction and both themes.
- Widths checked: 320, 375, 390, 768 and 1440px. Client/coach screens and settings inspected visually. Supporting-text contrast is approximately 7.57:1 on dark cards and 6.09:1 on light cards.
- Final bundles: main JS about 310.9 KB (97.2 KB gzip), on-demand coach JS about 36.6 KB (10.3 KB gzip), CSS about 58.5 KB (12.7 KB gzip). No new application or animation dependency.
- An intermediate test run caught immediate-reload habit persistence and sub-44px dimensions during a scale entrance; both were repaired and the final complete suite is green.
- WebKit is engine coverage, not physical iPhone certification. Physical iOS/Android testing, a measured 60fps performance trace, a comprehensive accessibility certification and a production penetration test remain outside this verification. Multi-tab edits still use last-write-wins local storage. Real integrations/native delivery remain as listed above.

### Run the app

In `/Users/compucity/Documents/New project/coachos-premium`, run `npm run dev -- --port 5173`, then open `http://127.0.0.1:5173`. Fresh installs use `pnpm install --frozen-lockfile` first. Test coach code: **00000**. Full instructions and feature navigation are in README.md.

### Version history

Commits are deferred because this repository has no configured author name/email. The user was informed; no identity or global Git settings were invented. Only this app is being edited; sibling projects and existing browser data are untouched.

## Reference design pass — 12 October 2026

See REFERENCE_DESIGN_UPDATE.md. The new water, exercise media and logger flows pass in Chrome and WebKit; build and 8 logic tests pass. All 54 browser cases have passed across a 51/54 full run plus a 4/4 focused rerun. The focused run follows a date-independent correction to the scheduling test and a timing-sensitive WebKit branding retry. Existing user records and service boundaries remain intact.

## Olive design / water optics correction

The new reference restyle and water renderer are documented in OLIVE_WATER_UPDATE.md. Water now refracts submerged lettering and reacts to touch/drag. Build and 8 logic tests pass; 28 focused browser cases pass across runs and repairs. The scoped fixes include a WebKit video-button overlap, an onboarding accessible name and truthful initial hydration rendering.


## Premium editorial redesign — 14 October 2026

Replaced the olive interface with the premium visual system and reordered home/nutrition around primary actions. Selected calendar days stay visible on resize; water paints its initial state offscreen. Build and 8 unit checks pass. 30 unique Chrome scenarios and 10 focused WebKit scenarios pass across the broad run and stable reruns. Details and review files: `PREMIUM_REDESIGN.md` and `output/premium-redesign/`.


## Requested ice-blue reference — 14 October 2026

Adopted the supplied light-blue/monochrome reference across the app, including the existing saved-session view. Added real upcoming-session previews and generated studio photography. Appearance adopts light once without replacing records; later choices persist. Final build, 8 unit checks and 24 focused Chrome/WebKit scenarios pass. Both existing preview tabs were refreshed and the personal draft and water log remained present. Details: `ICE_REFERENCE_UPDATE.md`.


## Icy glass and modern typography — 14 October 2026

Added local variable Manrope text and Space Grotesk headings, glass surfaces and a sliding mobile navigation lens. Existing personal preview reports the new font and backdrop filter, with its saved session visible. Build and 8 unit checks pass; all 14 focused Chrome/WebKit checks pass. Notes: `GLASS_REFINEMENT.md`.

## Smoked glass reference direction — 14 October 2026

Rebuilt the active visual skin around blurred photography, smoked blue, light Manrope typography, large progress numbers and brighter glass edges. Simplified home and redesigned the saved-workout sheet while preserving records and media. Build, 8 unit checks and all 32 focused Chrome/WebKit scenarios pass. Notes and captures: `SMOKED_GLASS_UPDATE.md` and `output/smoked-glass/`.

## Gym identity and detail refinement — 14 October 2026

Added visible training photography, real weekly session/volume totals, prescribed sets and muscle groups, numbered exercise photos, coach cues, resume progress and clearer active-set feedback. Build and 8 logic checks pass; 16 Chrome/WebKit scenarios pass across the broad run and one isolated timeout rerun. Existing personal workout and hydration records remain present. Notes: `GYM_REFINEMENT.md`; captures: `output/gym-refinement/`.

## Liquid navigation motion — 15 October 2026

Added a subtle stretch, trailing highlight and settling motion to the bottom glass selector. Rapid taps retarget smoothly; reduced motion remains supported. Fixed fractional Safari landing drift. Build and all 4 focused browser checks pass against the built app. Notes: `LIQUID_NAV_UPDATE.md`; animation preview: `output/liquid-nav/navigation.gif`.

The follow-up strengthens the motion with a continuous outlined liquid tail and a separate trailing spring. Build and all 4 Chrome/WebKit navigation checks pass again; reviewed recording: `output/liquid-nav-v2/navigation.gif`.
