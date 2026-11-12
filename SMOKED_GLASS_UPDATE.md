# Smoked-glass direction — 14 October 2026

The latest three supplied references replace the earlier pale blue dashboard direction. The new design uses a full-screen photographic atmosphere, white lightweight Manrope type, larger progress numbers, transparent numbered session choices, and more defined optical rims on glass controls. The active stylesheet is now `src/avalen/atmosphere.css`; earlier skins are retained as historical source and no longer loaded.

The canvas is made from existing fitness photography, blurred and tinted in CSS. Session photographs become softened layers within glass sheets; exercise photos and coach videos stay sharp in their exercise detail and workout logger. No medical copy or measurements from the supplied inspiration are used.

## Layout and controls

- Larger greeting with a quieter supporting line.
- A compact date strip and a single current-session sheet.
- Two real upcoming sessions shown as numbered glass choices; all other training stays accessible through the programme and calendar.
- Programme information becomes a concise row. Activity and nutrition use large real numbers and simpler separators.
- The resume sheet now leads with the session title, logged sets and session progress, then its resume action. Its image comes from the current exercise or uploaded exercise photo. The compact resume dock remains available on other screens.
- Capsule and circular controls use transparent fills, bright edge highlights and inset shadows. The mobile dock retains its separate sliding glass lens.

## Records and settings

The requested smoked-blue appearance is adopted once using `settings.designVersion = atmosphere-v1`; it changes only appearance settings. Later theme choices persist. The light variant remains available. Existing session drafts, sets, client records, media and habit logs retain their schema.

The personal preview was inspected after adoption and its existing saved workout and water records remained intact. A new hidden preview tab was prepared after the earlier tabs were no longer available.

The same reduced-motion and reduced-transparency fallbacks remain in place. There is no new animation library, no new backend, and no new image generation in this pass.

## Review files

`output/smoked-glass/` contains the before-change source backup and phone/desktop review captures. The build, all 8 unit checks and all 32 focused Chrome/WebKit browser scenarios pass. Browser checks cover saved workouts, onboarding, both roles and themes, small screens, coach media, water interaction and persistence, and workout logging/rest recovery.
