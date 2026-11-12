# Avalen — olive design and water optics

Updated on 12 October 2026 from the user's new fitness UI screenshot and their clarification about realistic, interactive water.

## Design

Dark olive surfaces with a lime accent; bundled Space Grotesk typography; a photographic athlete welcome screen; coach-help control; programme cards; a segmented calorie dial; separate translucent circular navigation controls; and a photographic meal entry screen. Light mode and existing coach/client navigation are retained. Coach names and logos continue to come from the existing workspace branding.

The hero and meal photographs were generated for this app and saved under `public/design`. Their WebP versions total approximately 378 KB; PNG originals remain under `output/olive-redesign` and the original generation directory. They are not screen captures from the supplied design.

## Water

`water-renderer.js` replaces the old flat canvas waves with a WebGL optical renderer:

- A damped spring surface with reflected highlights and bounded slosh.
- Touch and drag disturbances that produce expanding ripples and change the surface.
- The percentage is rendered to a texture. Surface-aware masking keeps the dry portion sharp and magnifies/tints/refracts the submerged portion. Moving ripples displace the glyphs themselves.
- Underwater caustics, light shafts and depth-dependent color.
- Intake changes animate the level and counter; initial mounting starts from the already-saved intake. Intake above the target displays the actual percentage while the water level stays bounded.
- Decorative updates target 30 fps at a device-pixel ratio capped at 1.5. Offscreen/hidden-tab drawing is skipped. Reduce Motion uses a static level, with touch scrolling restored.
- A Canvas fallback retains the waterline, underwater lettering and tap response if WebGL is unavailable or its context is lost. This is an art-directed surface/optics simulation, not a full 3D fluid solver or a frame-identical copy of the original recording.

Both the spring renderer and the fallback clean up their animation frames, observers, events and graphics resources. Water actions still update the same daily habit record; touching the surface does not change logged intake.

## Functional continuity

The workout logger, set correction/undo, rest, pause/resume, coach exercise photos/videos, messaging, measurements, branding and existing user records are retained. The noninteractive session counter no longer intercepts the coach video's pause button in WebKit.

The new meal-photo button opens the existing photo/manual nutrition form. The coach-help control opens the existing coach conversation; the screenshot is a design reference and does not create an unimplemented AI analysis service.

## Verification

- Production build: pass. Unit tests: 8/8 pass.
- 28 browser cases have passed across Chrome and WebKit in focused runs covering responsive dark/light layouts, reduced motion, touch and drag, percentage submersion, water persistence, coach photo/video upload and playback, workout logging/correction/rest/resume, onboarding and inherited coach branding.
- The first 26-case run passed 25 cases and identified a real WebKit overlap over the video pause button. After removing pointer events from the noninteractive counter, all six reference-design cases passed again in both engines.
- All six optics/gallery/photo-entry cases passed on the final renderer, including initial-value handling and stronger submerged magnification.
- Both onboarding/branding cases passed after adding an explicit accessible name to Get Started so the decorative chevrons are ignored by assistive technology. These results combine the focused runs and necessary reruns; they are not a claim of one uninterrupted green full-suite run.
- The user's live preview was checked and switched from Light to Dark to show the requested reference direction. Existing profile, workout and drink records were preserved.

Representative frames and source backups are in `output/olive-redesign`. New tests cover touch and drag, unchanged intake after touching water, dry/partial/submerged percentage states, reduced motion and the workout-gallery/photo-entry controls.
