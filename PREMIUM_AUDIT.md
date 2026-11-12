# Avalen premium experience audit — 21 October 2026

Avalen is a coaching workspace, not a generic workout library. A client should understand today's prescription, log the work and meals, report measurements, and communicate with their coach. A coach should review the right person, interpret actual history, and deliberately publish changes. This pass retains the existing editorial black/white identity, imagery, React components, connected service and saved records.

## Inspection

Reviewed client Home, Training/Habits/FormLab, Nutrition and logging, Progress and body history, profile/preferences, coach overview/messages/check-ins; coach dashboard, roster, individual programme/nutrition/progress/check-in workspaces, inbox, programmes and business. Inspected state and persistence, private media, shared controls, native dialogs, motion/reduced-motion, responsive styles and existing regressions. Captured 26 before states in fresh browser profiles in dark and light themes. Screen captures were allowed to settle before visual review. Existing user records were not used for test mutations.

## Prioritized findings before changes

| Rank | Type | Specific finding / affected surface | User impact | Effort | Risk | Backend changes |
|---|---|---|---|---|---|---|
| 1 | UX / flow | `useWorkspace.update` returns success before its local save effect runs; Messages immediately clears the composer after starting a write. Make local transactions acknowledge actual storage and retain failed message drafts. | Very high: trust and lost input | Medium | Medium: needs save/reload regressions | No |
| 2 | Flow / hierarchy | Training places programme copy and a large scheduling card before the calendar and workout. Present the selected workout and start/resume action first; keep scheduling and programme notes accessible after the workout. | High: daily repeat task | Medium | Low | No |
| 3 | Flow / missing convenience | Check-in form prioritizes optional audio and prose over required weight. Show measurements first, explain required completion, protect unpublished input, and keep submission reachable. | High: core coach/client loop | Medium | Medium: preserve schema and submission rules | No |
| 4 | UX / missing convenience | Messaging has a one-line composer, no recoverable draft, no considerate latest-message scroll, unconditional device-only footer even in connected mode, and duplicate coach client selectors. Refine both sides of the conversation. | High | Medium | Medium: preserve acknowledged delivery | No |
| 5 | Flow / visual | Coach nutrition prescription exposes every meal field at once (2,914px page in the mobile audit). Keep daily targets visible; make each meal an intentional editable disclosure. | High | Small | Low | No |
| 6 | Visual / hierarchy | Profile/settings page repeats identity and coaching links and spans 2,767px. Compact the identity, keep appearance accessible, and disclose coaching history and device setup. | Medium-high | Small | Low | No |
| 7 | UX / interpretation | Progress overview repeats a long goal statement before useful context. Body cards read from the latest *weight* row, so a weight-only check-in can incorrectly blank an older chest/waist/body-fat value. Add a concise real-data snapshot and preserve the latest value per measurement with dates. | High | Medium | Medium: do not infer missing readings | No |
| 8 | Flow / visual | Food search sits after recent entries; food rows use a water icon, and day completion reports success before acknowledgement. Prioritize search, clarify meal/target context, and acknowledge completion. | Medium-high | Small | Low | No |
| 9 | Visual / usability | Secondary text, target labels, fields and controls inherit inconsistent sizes and light-mode colours from several earlier style layers. Dialog height ignores the visual viewport, and close gestures can run while a caller refuses dismissal. Use shared semantic styles and explicit dismissal guards. | High on phones | Medium | Medium: keyboard/dialog tests | No |
| 10 | Motion / feedback | Route movement is longer than needed for repeated tasks; selected horizontal tabs can leave the active choice off-screen; wide controls inherit overly strong scale presses. Refine continuity and finite feedback, retaining system/app reduced motion. | Medium | Small | Low | No |

## Product decisions

- Preserve human coach authority and actual recorded values. No fabricated AI output, readiness scores, online statuses or calorie estimates.
- Keep workouts fast, explicit and editable. Preserve logging, undo, pauses, rest deadlines, swaps, technique uploads and partial-session review.
- Keep optional tools reachable through purposeful disclosure. Do not add perpetual animation or extra confirmation steps to ordinary actions.
- Keep the existing service optional and separate from device preview. AI meal recognition and wearable sync remain unconfigured integrations as previously agreed.
- Do not promise physical-phone frame rates from desktop automation. Measure and test the resulting implementation, then record practical limits.

## Implementation and verification

### Implemented

1. **Dependable saves.** Local workspace changes are stored as complete snapshots before React publishes them. Failed mutations/storage preserve prior records. Messages, check-ins, food completion, new workouts, body measurements, photos, schedule changes and member posts now wait for acknowledgement where this pass found premature success/clearing. Relevant forms retain their contents and show a retryable error.
2. **Training hierarchy.** The selected day and Start/Resume lead the training screen, above exercise rows. Scheduling and programme commentary remain accessible below. Exercise rows now separate category, name, prescription and rest instead of inheriting concatenated text. The focused logger retains its editable sets, rest controls, correction, undo, pause/resume, exercise picker and technique entry.
3. **Check-ins.** Required measurements lead; written reflection and voice follow. Draft answers recover after closing/reload, optional voice uses disclosure, completion copy reflects filled required fields, and recording/upload/submission guard dismissal. Coach-defined questions and cadence remain authoritative.
4. **Conversations.** Both roles get a multiline composer, recoverable per-client drafts, date separators, actual timestamps and own-message receipts. Failed sends preserve input, repeated sends are guarded, incoming updates respect a user reading older messages, and Jump to latest restores the thread. Saved replies remain available. A single mobile client selector makes room for the composer.
5. **Nutrition.** Search precedes recent foods. Diary labels and calorie balance give more context. Coach meal editors disclose their full fields from readable summaries; daily targets and explicit publishing/draft recovery remain intact.
6. **Profile and progress.** Compact identity; appearance stays reachable; coaching updates, device setup and account connection use disclosures. Progress shortcuts use actual records. Each body metric now retains its latest supplied reading and date rather than borrowing the latest weight record.
7. **Shared finish.** More consistent typography, focus states, touch controls, field sizes, light/dark contrast and dialog layouts. Dialogs follow the visual viewport and avoid accidental dismissal from inside padding. Repeated navigation uses a shorter 240ms transition; overflowing tab selections reveal themselves; wide-button press movement is restrained. Reduced motion remains respected.
8. **Loading.** Technique review loads as a separate feature bundle. The production main JavaScript bundle is 490.39kB (153.52kB gzip), with FormLab 16.67kB (6.04kB gzip). No new runtime dependency or service endpoint was added.

### Verification

- Production build passes.
- 51 unit checks pass, including new local transaction and independent latest-measurement regressions.
- The main browser regression run passed 65 of 68 cases. Two message assertions had a macOS text-cursor issue; one duration fixture altered storage before dialog closure had finished saving. Corrected those test arrangements and reran all three successfully.
- A subsequent 52-case run passed in Chrome and WebKit: all 26 new premium-flow cases, 12 authenticated coaching integration cases, 10 navigation/motion/dialog/audio cases, 2 plain-HTTP phone-preview cases and 2 duration logging cases. Across those runs, 98 distinct browser cases passed, including 320/390/1440px layouts in both themes, nutrition, check-ins and workout corrections/resume.
- Final copy/CSS refinements received a focused check-in and workout rerun and fresh captures.
- Connected tests use isolated accounts and temporary service data. Captures use fresh demonstration browser profiles. No verification mutates the user’s saved browser workspace.
- A 15-screen before/after walkthrough and actual interaction video are saved at `output/premium-review/index.html`. Screens were allowed to settle before capture; light-theme and desktop examples are included.

### Practical limits and next priorities

- Automated WebKit and simulated visual-viewport changes do not replace trying the actual keyboard, camera/file picker and touch response on the user’s iPhone. A physical-device usability session is the next useful validation.
- AI meal estimation and live wearable sync are still deferred integrations, as agreed. The present UI does not fabricate estimates or connected data.
- Existing styling spans several legacy layers. This pass adds scoped refinements and does not risk a broad rewrite; consolidating those layers is a separate maintainability task.
- Local preview saves remain synchronous browser storage. This pass makes acknowledgement honest but does not claim to provide server conflict resolution for multiple independently editing local tabs.
- Specialist coaching screens retain useful detail. Future compression should be based on real coach task observation, rather than hiding more tools solely to shorten pages.
