# Gym identity and detail refinement — 14 October 2026

The smoked-blue glass direction stays in place, with more recognisable training content and clearer workout states.

- Home shows sharper athlete photography, muscle groups, exercise counts and prescribed working sets. Upcoming sessions use visible exercise photos rather than blurred tiles.
- The weekly training strip uses actual Monday–Sunday sessions and scheduled training. Weekly lifted volume excludes skipped sets and duration exercises. Existing step totals remain visible.
- Calendar dots distinguish scheduled and completed workouts, with an accessible description of each day.
- Exercise rows show a numbered photo, muscle group, sets × reps or seconds, rest and available coach video. Programme progression and coach technique cues remain tied to the coach's own content.
- Saved workouts have a real progress bar, an exercise photo and the next exercise prescription.
- The workout logger shows prescribed sets, rest and reps in reserve above the logging controls. Active inputs, pending sets, saved feedback and rest controls have consistent icy details. The phone logger fills the screen.

No new dependency, schema migration or change to stored workout records is introduced. Exercise images, coach video playback, hydration physics and the sliding glass navigation remain available. Reduced-motion support remains in place.

Validation: final production build and all 8 logic checks pass. All 16 selected Chrome/WebKit scenarios pass across the broad run (15/16) and an isolated rerun (1/1); the broad Chrome appearance scenario exhausted its overall time budget, and passed in 41 seconds by itself. Checks cover both roles/themes at 375, 768 and 1440px, saved sets and theme choices, real scheduled day selection, set editing/validation, duplicate taps, rest/reload and 320px workout controls. Review captures and the source backup are in `output/gym-refinement/`.
