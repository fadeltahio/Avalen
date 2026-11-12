# Avalen reference design update — 12 October 2026

Implemented from the user's three screen recordings and four UI images. The recordings are visual references; their original animation code, materials and device-motion physics were not provided. The implementation closely recreates the visible motion patterns, rather than claiming frame-identical reproduction.

## What changed

- Photo-backed workout logger with pill-shaped weight/reps controls, circular log/undo controls, a bottom exercise dock and an image that changes with the selected exercise. Rest, effort, validation, correction, skipping, swaps, pause/resume and finishing are retained.
- Eleven bundled exercise photographs in `public/exercises`, mapped by exercise name so existing stored programmes also receive images. Coach photos override the library image; custom exercises show a labelled group cover until the coach attaches media. Exercise lists now include thumbnails.
- Coach programme editing supports exercise photo upload/removal as well as demonstration video upload/removal. Uploads resolve by stable day/exercise IDs and remain subject to the existing pending-upload guards.
- A coach video plays inline, muted and looping in the live logger, with pause/play and mute controls. Playback failure or missing browser media storage retains the exercise photo. Matching media changes on the client's current programme also reach an already-started workout without changing its set prescription.
- Water tracker on Today, Habits and Nutrition → Daily updates → Water: layered liquid waves, pointer-driven slosh, animated rising level and percentage, 100/250 ml additions, custom amounts and removable drink entries. All views share the existing daily habit record and preserve earlier manually logged totals.
- Glass bottom navigation expands the selected destination into a pill. Labels remain in the accessible button names; desktop navigation is retained.
- A real set save triggers four glowing cells that converge into a drawn checkmark. A second click in a rapid double-click cannot immediately undo the newly logged set.
- Nutrition daily updates use coach-set protein, water and step targets, with meal summaries and the water tracker. No untracked fiber or movement-duration figures are invented.
- The welcome screen uses a cooler photographic palette, smaller brand typography and a pill-shaped journey button, following the onboarding reference.
- Both app and operating-system Reduce Motion settings suppress the decorative transitions; the liquid renders a static level. Off-screen/background liquid drawing is skipped, and all animation observers/frames clean up on unmount.

## Assets and implementation

No animation dependency added. Active entry remains `src/avalen/main.jsx`. New components are `ExerciseMedia.jsx` and `ReferenceMotion.jsx`; design styles are appended through `reference-design.css`. Existing browser records are not reset or migrated.

Exercise photographs are bundled locally from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), which publishes its dataset under the Unlicense. `exercise-images.json` records the original paths; `public/exercises/SOURCES.md` records provenance. Walking lunge uses the dumbbell lunge reference photograph. These library photographs are defaults; coaches can supply their own art direction through exercise photos/video.

The `output/reference-review` folder contains extracted reference frames, preview screenshots and a compressed source backup from before this update. It is not required by the app. The test video in `tests/fixtures/coach-video.mp4` is a small generated color clip used only to verify real playback.

## Try it

Run `npm run dev -- --port 5173`, open `http://127.0.0.1:5173`, and select Explore demo. Start Workout for the new logger. Log a set to see the saved-state morph. Use Today or Plan → Habits to add water. Plan → Nutrition contains Daily updates. A coach can open Clients → client → Plan → Edit programme, expand an exercise and attach its photo/video.

## Validation

- Final production build: pass. Unit tests: 8/8 pass.
- Full browser run: 51/54 passed across Chrome and WebKit. All six new reference-design cases passed, as did all workout-logger, theme, viewport and reduced-motion cases.
- The two future-locking failures came from an older test assuming today + 2 was a training day. That date is a Wednesday rest day on 12 October. The test now selects an actual upcoming scheduled workout from the active client record.
- One WebKit branding check timed out waiting for the logo after fresh onboarding in the full concurrent run. It passed on the isolated rerun without an application-code change; this remains a potential timing-sensitive check under load.
- Focused final rerun: 4/4 pass (branding and photos/documents/future locking in both engines). All 54 browser cases have therefore passed across the full run plus focused rerun, not in one uninterrupted green run.
- Visual inspection: phone workout logger, water/nutrition screens, dark desktop Today, and light coach/settings. Browser layouts cover 320–1440 px.

The app remains a local workspace preview. Coach/client media changes share within the same browser workspace; remote device synchronization is not implemented. Physical iPhone/Android performance and device-tilt parity with the original liquid simulation have not been verified.
