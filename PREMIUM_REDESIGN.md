# Avalen premium redesign — 14 October 2026

Direction: refined editorial coaching. The purpose is to make the next training action obvious, with daily tracking and a coach conversation close at hand. The anchor is large Newsreader display type paired with a restrained photographic workout card. Design feasibility score: 15 (impact 4, fit 5, feasibility 4, performance 4, consistency risk 2).

## Interface

- Deep ink, warm ivory and sage; the alternate light theme uses warm paper surfaces.
- Newsreader for page headings, Space Grotesk for controls and body text. Fonts are served locally. Newsreader comes from the Google Fonts repository under the included SIL Open Font License (`src/assets/newsreader-OFL.txt`). The subset WOFF2 retains variable weight and optical size axes.
- One current workout card, a seven-day calendar viewport, compact activity and food summaries, interactive water, and the coach's latest actual message.
- All five mobile destinations have persistent labels, equal tap targets, and a stable dock. Desktop uses a sidebar.
- Nutrition puts the food diary before photo capture and recommendations. Other client and coach screens inherit the same typography, surfaces, tabs and controls.
- Reduced motion follows system and app preferences. Page transitions stay short; water preserves its refraction, touch ripples and fallback renderer. The home water log shows the latest drink; the full tracker under Habits shows recent entries.

## Corrections

The calendar now recenters its selected day when its container resizes. The water renderer paints once after a resize/font load even if its scene is outside the visible viewport, while ongoing frames remain paused offscreen. Saved records, uploaded media and workout drafts retain their existing storage schema.

## Review files

Screenshots and the source backup before redesign are in `output/premium-redesign/`. The previous olive stylesheet is retained for historical reference and no longer imported. The active visual stylesheet is `src/avalen/premium-design.css`, with shared values in `src/avalen/tokens.css`.

## Validation

- Production build succeeds; all 8 unit checks pass.
- 30 unique Chrome scenarios pass across the broad run (26) and focused rerun (4). This includes onboarding, coach branding and uploaded covers, nutrition, habits, check-ins, exercise video playback/fallback, workout corrections, rest persistence, water touch/refraction, both themes, and layouts from 320 to 1440 pixels.
- The initial broad run was made during development; it included a stale calendar test selector and timeouts during live reload and screenshot capture. The corrected calendar scenario also checks that the selected day stays within the visible calendar after resizing 768 → 320 → 390. All four focused reruns pass on the finished source.
- Display-font loading is verified in the final screenshot capture.

- All 10 focused Safari/WebKit checks pass on the finished source: persistent water logging, touch/drag, underwater text, reduced motion, coach video playback/fallback, both-theme 375px layout, calendar resizing and scheduled-day preview, meal-photo form, workout corrections, duplicate-tap handling, rest persistence and small-phone logger layout. Together, 40 unique browser scenarios are verified across Chrome and Safari/WebKit. This is still the existing local workspace; its backend/account capabilities have not changed.
