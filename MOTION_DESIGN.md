# Avalen motion refinement

The existing React 19 app, hash routes, native dialogs, Lucide icons, editorial identity and data model are retained. No new runtime dependency or animation library was added.

## Audit and priorities

1. **Workout logging:** previously a saved set barely registered, rest was a text countdown and exercise changes were abrupt. Prioritize press → persisted set → current row → rest → next exercise. Corrections remain immediate and editable.
2. **Navigation continuity:** existing screen-wide fade-up and nested card entrances replayed on navigation. Remove blanket staging; use one short directional screen transition and a moving navigation/tab indicator. Remember scroll positions on Back.
3. **Real metric updates:** nutrition rings jumped directly to new values. Interpolate visual totals and arcs together between actual values. Keep accessible values exact and remember the last target per person/date/metric; never count up from zero on every visit.
4. **Modal ownership:** existing native dialog preserved focus but disappeared instantly. Add brief entrance/dismissal and an optional touch gesture confined to the header. Keep Escape, focus restoration, backdrop and scroll lock.
5. **Nutrition speed:** retain the existing photo/manual/coach plan/recent/portion flows and undo. Animate portion impact and diary insertion/removal/reordering. Await save acknowledgement before success feedback.
6. **Data exploration:** keep real chart data and keyboard/pointer scrubbing, reveal a trend once, use a brief transition on dataset changes, and remove keyed readout remount effects.
7. **Coach productivity:** keyed client filtering and insight lists retain position continuity. New/removing items receive short transitions; calm expandable evidence retains native disclosure semantics.
8. **Voice check-ins:** add a microphone-derived spectrum and measured amplitude, actual MediaRecorder pause/resume, elapsed active recording time, processing and completed states. Silence stays silent.
9. **Technique review:** add timestamp markers and selected note states outside the video surface. Keep the annotation stage and all normalized coordinates entirely unanimated.
10. **Coaching decisions:** expandable Memory comparisons and a timeline structure; directional original-to-proposed date comparisons with pending/preview labels. No animation writes data or approves a schedule.

## Shared system

`src/avalen/motion.jsx` contains a single reduced-motion subscription, bounded per-context metric caches, Web Animations helpers, moving indicators, keyed list continuity, native disclosures and progressive View Transitions. `motion.css` holds tokens and interaction states.

- Press 110 ms; small state 180 ms; panels 280 ms; screens 320 ms; earned workout completion 640 ms.
- Default easing cubic-bezier(.2,.8,.2,1); restrained settling cubic-bezier(.16,1.08,.32,1).
- Transforms/opacity are preferred. Disclosures animate bounded height on direct interaction; lists measure only when their membership/order changes. Charts do not animate their underlying records. Metric frames stay inside leaf components.
- Browser and application reduced-motion preferences both disable movement. Switching the preference cancels interpolation/active component animations. Existing hydration stops its decorative render loop in reduced motion.
- Animation cancellation/unmount releases frames, observers and Web Animation effects. Audio contexts and microphone tracks are released. Detached list exits are inert, inaccessible and removed after their short exit.
- Native View Transitions enhance supported browsers. Routes retain a direct, usable fallback. Controls are not blocked by snapshots. Rapid transitions supersede older snapshots.

## Authoritative state

Rest uses persisted wall-clock deadlines. Existing drafts without the new duration field derive their ring duration from the existing prescription. Pause stores exact remaining milliseconds; resume creates a new deadline. Rendering never counts time by frames. Set, workout and meal-add/edit/remove success follow confirmed saves; failed writes retain a useful error and editable context. A thin weekly training indicator follows actual completed sessions and the current planned count. Newly saved workout statistics count up once in the earned sequence. Workout completion and personal records use the existing finishSession result; ordinary historical results do not replay the earned sequence. Nutrition values remain editable and undo remains available. Rescheduling still requires the existing explicit approval commands.

## Intentional boundaries

No marketing parallax, confetti, continuous alert glow, fake waveform, invented records or repeated metric count-up. Standard selects, audio players and uploads retain their browser behavior. Shared workout image transitions are limited to the selected editorial workout image and supported browser snapshots. Native annotation geometry is kept stable. Provider-dependent AI/transcription remains optional and unconfigured.

## Verification

Results are recorded in the completion notes after mobile/desktop, reduced-motion, navigation, recording and connected-workflow checks finish. Hardware microphone permission behavior and mid-range physical phone performance still require device testing; automated audio checks use a real Web Audio stream with a controlled signal and silence.

## QA findings addressed during implementation

- Removed scale from dialog entrance so small-phone touch targets retain their physical size throughout the entrance.
- Guarded exercise motion against the intentionally removed draft after workout completion.
- Handled native View Transition `ready` rejection on rapid superseding navigation; expected interruption is not an application error.
- Keyboard dismissal checks deliberately open dialogs with the keyboard. Search fields retain their browser-native Escape-to-clear behavior.
- The WebKit audio test installs an explicit input override after page setup: WebKit reinstated its native getUserMedia method after the early initialization script. Production recording still uses the genuine browser microphone API.

- Scroll restoration now belongs to each history entry, captures its destination before deferred browser events, and cancels superseded restore requests. The final rapid-Back test passes in both engines.
- A visual pass removed a duplicate tab underline and preserved fractional macro values during interpolation. The initial active navigation indicator is measured on mount rather than waiting for the first tab change.

## Review artifact

`output/motion/index.html` contains a recording of the real client flow plus six current screenshots. `tools/capture-motion.mjs` creates the capture using a fresh browser context and demonstration records. The optional MP4 conversion uses the existing ffmpeg installation; WebM remains the fallback. Existing user records are untouched.

- Meal removal retains its dialog and an inline error until the server acknowledges the write. Its state is scoped to Nutrition; an initially misplaced state declaration was caught by the diary regression check and corrected before completion.
- Dialog entrance/backdrop effects release their fill after entry, allowing direct touch-drag transforms and dismissal backdrop fading to remain effective.

## Final verification

- Production build passes. Main JavaScript: 154.88 kB gzip; coach chunk: 14.11 kB; stylesheet: 28.39 kB. No runtime dependencies were added.
- `npm test`: **41 passed**, including deadline timing, pause/reload/resume, legacy rest drafts, privacy, permissions, immutable history and existing coaching rules.
- The full **90-scenario** browser run covered check-ins, the connected ecosystem, editorial flow, nutrition, product refinements, workout logging and motion across Chrome and WebKit. **88 passed on that run**. Two WebKit cases failed: the complete two-account video-review flow reached the suite's 60-second deadline, and the controlled audio source produced no analyser activity.
- The analyser now creates/unlocks its AudioContext within the originating recording gesture, before async permission and React effects. Both Safari cases subsequently **passed in a focused serial run** with a 120-second integration-test allowance. No FormLab business logic was changed to bypass the timeout.
- Final shared-motion regression: **14/14 passed** across Chrome and WebKit, after the audio and touch-dismissal refinements. Every one of the 90 distinct scenarios passed across the final verification runs; the full run itself was not a single clean 90/90 result.
- Production touch probe: a 40px finger movement produces the intended 22px resisted dialog movement; a cancelled gesture settles to its origin; a larger gesture dismisses. Drag release continues from the current transform rather than snapping back first.
- Mobile layouts were exercised at 320px and 390px, with 768px/1440px coverage and both themes. Keyboard dialogs, Back/scroll restoration, reduced motion, corrections, removal/undo, draft reload and actual signal/silence were checked.

### Performance findings and limits

`tools/profile-motion.mjs` samples the production logger under 4× CPU throttling, with paced in-page button handlers so protocol/actionability polling does not dominate the sample. Latest 4.5-second sample: **16.7ms median, 33.4ms p95, 183.3ms worst frame**, with the CPU profile predominantly idle. An earlier controlled sample measured 16.8ms p95 and a 233.4ms worst frame. These are short diagnostic samples, not a guarantee of sustained physical-phone performance.

Pointer-driven automation produced much worse frame timings; those raw diagnostic results remain in `output/motion/quality.json` and `quality-concurrent.json`. Measurement method materially affects the results, so those numbers are not silently presented as an app-only benchmark. The touch assertions in that probe pass independently of frame timing. The controlled sample and its method are recorded in `output/motion/profile.json`.

The profile identifies the existing whole-workspace structured clone and synchronous local-storage serialization as occasional update stalls. This motion task preserves that persistence model to avoid risking saved records. A future persistence optimization should measure those writes separately and retain safe, acknowledged saves. Physical-device performance, actual microphone permission behavior and camera capture still need a device pass. Automated audio tests use a real Web Audio stream with controlled signal/silence rather than a hardware microphone.
