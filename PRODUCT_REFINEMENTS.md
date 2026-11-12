# Avalen product refinements

This pass implements the approved UI/UX audit against the existing Avalen app. The black-and-white editorial identity, coach prescriptions, local records, uploads and existing role interfaces remain in place.

## Delivered

1. **Workout focus:** collapsible demonstration, clearer working values, visible adjustable rest, advisory logging during rest, duration units, smaller exercise dock and restrained save feedback. Existing set editing, undo, swaps, notes, history, autosave and completion remain. Empty workouts have an explicit discard action; browser Back pauses the draft.
2. **Daily Home:** today's session has a direct start action; a paused session takes precedence. Nutrition targets and four macro rings remain available alongside the coach's plan, upcoming sessions, habits and conversation.
3. **Faster nutrition:** diary moved above the full meal plan; the plan is expandable. Coach meals, food-library items and recent meals use portion review. Detailed values remain editable.
4. **Protected coach drafts:** nutrition and programme drafts persist separately from the assigned plan. Closing or navigating away retains the draft. Explicit save publishes it. Save/discard controls remain visible, and a changed source plan produces a conflict notice.
5. **Credible progress:** only explicitly completed diary days with saved targets contribute to nutrition adherence. Logging or correcting food reopens the day. Old logs without day records remain intact and unscored until reviewed. Stable weight is flagged only for explicit weight/fat-loss goals, with neutral wording. New clients receive a check-in grace period. Timed sets do not inflate weighted volume or estimated strength.
6. **Visual consistency:** semantic macro tokens support both themes, larger utility text, readable controls, consistent ring colours, solid review surfaces and brief confirmation feedback. Reduced-motion support remains.
7. **Coach efficiency:** a prioritised review queue includes waiting check-ins, unread messages and existing attention flags. Coaches can review, message or snooze. Client details include a next-client action; inbox conversations show unread/review counts.
8. **Food corrections:** edit the existing record and keep its photo. Logging, editing and removal provide an undo action.
9. **Predictable navigation:** hash-based destinations support browser Back, reload, client sections and selected diary/calendar days. Train's Nutrition shortcut leads to the canonical Nutrition destination. Progress naming is consistent; mobile coach messages are directly accessible with unread feedback.
10. **Accurate imagery:** strength, movement and conditioning have distinct fallbacks; lower-body strength no longer receives Pilates imagery. Uploaded coach covers continue to take precedence.

## State and compatibility

- Existing workspace key remains `avalen.workspace.v1`; existing records are not cleared or reseeded.
- `nutritionDays` is an optional collection holding client/date target snapshots and completion. Personal exports now include it. Historical targets are not fabricated for old saved records.
- Coach editing drafts use namespaced `avalen.edit.*` keys. They do not update a client's prescription until Save is selected.
- Uploaded media continues to use IndexedDB.
- Navigation uses URL hashes; no new routing or styling dependency was added.
- All runtime interactions in validation and screenshot capture used isolated browser profiles and example records.

## Deliberately deferred

AI meal recognition, cloud accounts/sync, external message delivery, payment processing and wearable connections remain unconnected. The meal-photo interface now states that recognition is coming later, before the user captures a photo.

## Validation

- Production build and 11 unit checks passed.
- The complete relevant browser run passed 48 checks across Chrome and WebKit, including the existing editorial, nutrition and workout suites and the new product-refinement suite.
- Follow-up nutrition and refinement checks passed after final token, export and timed-volume adjustments.
- Targeted browser checks additionally cover Back during a workout and explicit discard of an empty draft.
- Mobile layouts were checked at 320px and 390px; desktop at 1440px; both appearance modes were exercised.
- New screenshot walkthrough: `output/refined-ui/index.html`. The prior walkthrough is retained for comparison.

Focused browser command:

```sh
npx playwright test tests/editorial-flow.spec.js tests/nutrition-home.spec.js tests/workout-logger.spec.js tests/product-refinements.spec.js
```
