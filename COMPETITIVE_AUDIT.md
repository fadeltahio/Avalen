# Avalen competitive audit — 10 November 2026

How Avalen compares with the apps coaches and clients already know, what this pass changed, and what is still between Avalen and top tier.

## Method

- Walked every main screen as client and coach on a 390 × 844 phone viewport, recording each page switch frame by frame.
- Measured per screen: console errors, sideways overflow, layout shift, tap targets under 40 px and text under 11 px.
- Compared against the leaders in each job Avalen does: workout logging (Hevy, Strong), coaching platforms (Everfit, ABC Trainerize, TrueCoach), food logging (MacroFactor, MyFitnessPal) and premium feel (WHOOP).
- Competitor facts come from public reviews and comparisons read on 10 November 2026. Most comparisons online are written by vendors, so treat competitor details as directional.

## Where Avalen stands

| Area | Leaders do | Avalen today | Verdict |
|---|---|---|---|
| Visual identity | Everfit is praised for UI; most coaching apps look like dashboards | Black-and-white editorial design with photography; nothing in the coaching category looks like it | **Ahead** |
| Workout logging | Hevy: previous values beside each set, rest timer, RPE, warm-up/drop sets, plate calculator, exercise notes | Previous values, rest timer with a clear Next set, effort, edit/undo, drafts that survive a reload, coach cues and demo | **On par for coached training**; missing warm-up/drop set types, supersets, plate calculator |
| Exercise history | Hevy/Strong: charts and records per exercise | Volume chart you can scrub, personal records, full set history, coach view of the same page | **On par** |
| Coach workflow | Everfit: automation and AI workout builder; Trainerize: integrations at studio scale; TrueCoach: simple 1:1 | Review queue that says who needs you and why, check-ins, technique review, programmes, records-based insights | **On par for 1:1 coaching**; behind on automation, exercise library size (11 movements) and integrations |
| Food logging | MacroFactor wins on fewest taps; MyFitnessPal on database size | Recents, coach meal plan in one tap, 49 library foods with Arabic names, barcode lookup, manual entry | **Behind on database size**; fast for coached plans |
| Recovery | WHOOP: recovery from wearable data | Muscle recovery map from logged training, no wearable needed | **Different and useful**; no wearable data yet |
| Motion and feel | Native apps: page pushes, instant tabs, haptics, lock-screen activity | After this pass: each kind of move has its own motion; no haptics or lock-screen presence until the native build | **On par in the browser**; native features pending |
| Payments, notifications, wearables | All three coaching platforms have them | Not connected (by design until real integrations exist) | **Behind** |

## What this pass changed

### Page switches

Before, every navigation used the same small slide-and-fade, and the old and new pages were visible on top of each other mid-switch. Now each move looks like what it is:

| Move | Motion |
|---|---|
| Bottom tabs | Fade through, nudged in the direction the tab bar travels. The old page leaves before the new one arrives, so text never double-exposes. |
| Opening a deeper page (exercise details, a client) | The page slides in from the right as a solid sheet over the dimmed page beneath. Back pulls it away. Header and tab bar step out of the way. |
| Opening a session | The session photo grows into the page header; the rest fades through. |
| Sub-tabs, picking a day, client sections | The heading, tab row and calendar stay exactly still. Only the content beneath settles in. |

The rules live in one place (`routeMotion` in `route-model.js`) with unit tests. Reduced motion still turns all of it off.

### Fixes found by the walk

- **Buttons stayed dimmed after a tap on phones.** A hover style stuck after touch. It now applies only where a pointer can hover.
- **The Avalen assistant button covered content** (calorie values, coach actions). It now steps aside while you scroll down and returns when you scroll up, and it no longer replays its entrance after every Back.
- **"COACH'S CUEKeep your feet planted"**: the cue label ran into the cue text in the Train exercise sheet. Fixed.
- **Two exercise surfaces that didn't connect.** The Train exercise sheet now has a Progress & history button to the full exercise page.
- **Milestones** read mark, name, status from left to right instead of floating right.
- **Scrolling tab rows** fade at the edge instead of cutting a word in half.
- **Coach queue buttons and insight toggles** were 34–38 px tall; all are now at least 44 px.
- **Smallest text** (9–10 px in calendars, macro rings, meal plan and stats) raised to 10.5 px.

### Tried and removed

Searching packaged products by name. The public food database answers barcode lookups from a phone browser but refuses name searches. A button that fails is worse than none, so it is not shipped. It needs to go through Avalen's own server once that is hosted.

## Measurements after this pass

- Console errors across all ten main screens: 0.
- Sideways overflow: 0 px on every screen.
- Layout shift on tab switches: 0.000–0.001.
- Tap targets under 40 px tall in the coach queue: 0 (was 9).

## What still separates Avalen from top tier

Ranked by how much each one matters to a real coach or client.

1. **A hosted server and real accounts.** Until coach and client share data, nothing else matters. Includes password reset and in-app account deletion.
2. **Native apps.** Haptics, camera barcode scanning on iPhone, rest alerts and a lock-screen workout card all need the iPhone and Android shells.
3. **Push notifications.** Check-in due, coach replied, rest over. Every competitor has them.
4. **A real exercise library.** 11 movements is a demo. Coaches expect several hundred with demos, or a fast way to add their own videos.
5. **Food database through the server.** Name search over packaged products, proxied by Avalen's server.
6. **Set types and supersets** in the logger: warm-up, drop set, to failure, supersets.
7. **Payments and wearables.** Stripe or a local processor, Apple Health and Health Connect.

## Not verified in this pass

- A physical iPhone or Android phone, and Safari/WebKit. Page transitions use the View Transitions API, which Safari supports from version 18; older Safari falls back to a single quiet fade.
- Finger-driven back-swipe. In the browser it is the browser's own gesture; the native shell will need its own.
