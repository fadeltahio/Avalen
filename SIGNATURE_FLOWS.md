# Avalen — daily flow and motion refinement

21 October 2026. This pass builds on the premium audit; it preserves the current identity, features, service, authentication, records and coach authority.

## Changes

- **Workout continuity:** a direct, accessible exercise strip shows the current exercise and actual set progress. Completed work and handled/skipped work remain distinct. Moving between exercises retains unlogged values and logged history. The existing full exercise picker remains available.
- **Keyboard entry:** Enter in weight moves to reps; Enter in reps submits the valid set. Input and navigation are guarded while saving. This avoids accidentally logging the prescription when the user only meant to continue entering values.
- **An informed finish:** the review shows actual completed sets, volume, per-exercise completion and skipped work, plus direct return actions. Users can continue or save a partial session deliberately. Buttons remain reachable in the scrolling dialog. No save or result animation is claimed before acknowledgement.
- **Quieter notes:** session notes use a small recoverable local draft instead of rewriting the whole workspace for each character. They join the acknowledged workout write on log, exercise switch, pause or finish. Refresh restores unpublished notes; a saved session receives the actual note.
- **Recoverable food search:** review has a Back to foods action, preserving query and source tab without logging. The photo entry can also return. Empty search offers a direct manual path with the typed name already filled; empty favourites explain how to populate them.
- **Your training week:** seven days from the real prescription and session records. Each day opens the correct date in Training, with normal browser Back restoration. It does not invent an activity or readiness score.
- **The coach’s next task:** the first real review has a clear visual priority. Filtering uses the existing keyed-list motion. Next review opens the pending task; messages open the correct client’s conversation rather than a generic overview. Switching clients clears unrelated plan-tool selection.
- **Responsive defect fixed:** inherited mobile margins made the Home resume card wider than the screen and left an oversized gap. Its scoped layout now matches the surrounding content in both themes.

## Motion decisions

Retain the existing 240ms route continuity, shared session imagery, tab indicator, modal semantics, real rest timer and earned workout completion. Add a short input-ready transition and acknowledged set confirmation, using transforms/opacity and a finite SVG stroke reveal. Exercise progress updates without moving the logging action. Controls do not wait for animation completion to accept ordinary input. System and app reduced-motion preferences remain supported.

No new runtime package or backend endpoint was added. The final production main bundle remains below Vite’s 500kB advisory threshold.

## Verification

- Production build passes: main JavaScript 494.86kB / 154.68kB gzip; shared CSS 177.93kB / 34.23kB gzip. No new runtime dependency.
- All 51 unit checks pass.
- 58 distinct browser cases passed across targeted Chrome/WebKit runs. This includes all 18 new daily-flow cases, 6 existing workout logger cases, 14 authenticated coaching/slow-save cases, 10 navigation/reduced-motion/dialog/audio cases, 6 nutrition/date/duration cases and 4 coach tool-navigation cases.
- The first responsive run found the inherited resume-card overflow. All four 320/390px dark/light browser cases passed after its scoped fix.
- Held a real connected workspace save to verify that Finish, Keep going, Close and per-exercise return actions remain disabled until acknowledgement, then checked that exactly one session exists. The initial delay fixture intercepted the wrong HTTP method; corrected it to PATCH. WebKit then exposed a temporary-server cleanup wait, fixed by closing that test page after its assertions. Both final slow-save cases pass.
- Failed-finish retry passes in both engines after adding the finish lock. Unlogged input, existing undo/corrections, timed sets, rest, schedule approval, private media/reviews, check-in voice and immutable history remain covered.
- The review gallery contains ten actual screens and a 42-second MP4 recording. Checked playback metadata, mobile fit and absence of browser errors. Tests and captures use isolated browser profiles and temporary connected accounts.
- Final production-frame sampling used Chrome at 390×844 with 4× CPU throttling, after test browsers were closed. The 4.5-second logging/rest sample recorded 251 frame intervals: median 16.7ms, p95 16.8ms and maximum 133.4ms. This remains a short desktop synthetic sample, with occasional long frames, rather than a physical-phone frame-rate guarantee. The first isolated sample exposed repeated week-strip date formatting; caching week labels reduced that sample’s peak interval from 249.9ms to 133.4ms on a subsequent run. Typical-frame p95 stayed 16.8ms. Raw final metrics are saved in `output/signature-flows/profile.json`.
- A focused week-navigation, keyboard-logging and reduced-motion rerun covers the date-label optimization. No visual or data semantics changed.

## Review

`output/signature-flows/index.html` contains actual client and coach screen captures and a recording of the complete interaction flow. Captures and test mutations use isolated demonstration workspaces and temporary connected-service accounts. User browser data is not used for mutations.

Physical-phone keyboard, camera and touch-response validation remains a separate practical check. Desktop browser automation and CPU-throttled frame sampling do not establish App Store readiness or physical-device frame rates.
