# Avalen — coach plans, nutrition and editorial photography

16 October 2026

The home screen now combines Avalen's actual coaching features with the supplied Equinox visual direction. The warm orange/blue welcome photograph and the two new campaign photographs replace the previous bodybuilding portraits. All three were generated with the built-in image generation tool; no Equinox logos or interface text are baked into them.

## What clients see

- A compact branded header, personal greeting and date.
- Four nutrition rings using today's real logged calories, protein, carbs and fat against the coach's current prescription. Missing macro values stay unknown in the food record and are called out on Home.
- Scan meal, log food, a visible meal suggestion from the coach, and a direct Nutrition navigation item.
- The coach's actual programme and scheduled session images, a saved workout resume link, steps, and access to the coach conversation.
- A Nutrition page with the coach's daily targets and all prescribed meals or suggested meals. Flexible plans label meals as suggestions; structured plans label them as prescribed meals.
- Meal portions can be reviewed before logging. Saved nutrition is a snapshot, so subsequent coach edits do not rewrite earlier food diary entries.
- The logger now separates the exercise reference, coach prescription, editable weight/reps, previous performance, completed sets, rest timer and exercise navigation. Uploaded coach photos/videos still take priority over the library reference.

## Coach editing

The nutrition editor supports the overall approach and daily calorie/macro targets, adding/removing meals, meal names, instructions and per-meal calories/macros. Changes propagate to the client view and Home targets through the existing workspace data.

## Photo flow and deferred AI

The implemented flow is photo capture/upload → review → match coach meal or food library / enter nutrition → adjust portion → confirm → save to the diary and update rings. The original photo is saved on this device with its diary entry. Selecting a different portion recalculates known values. No food records are added until the client confirms.

Automatic photo recognition is deliberately deferred at the user's request. The UI marks it as coming soon; there is no pretend image analysis, external API call, credential, or invented photo-derived calorie count. Coach-plan estimates are explicitly labeled and remain editable. No AI backend was added.

## Online design references

- [Equinox's official app page](https://www.equinoxplus.com/app): cinematic fitness photography, black typography-led screens, session imagery and activity UI.
- [Equinox+ on Google Play](https://play.google.com/store/apps/details?hl=en_US&id=com.equinoxfitness.equinox): official product screenshots and feature flow.
- [Hevy product](https://www.hevyapp.com/product/): practical strength logging and progress tracking.
- [Hevy logging feature guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727-Everything-You-Need-to-Know-About-the-Hevy-App-2025-Features-Guide): editable weights/reps, prior performance, completed sets and timers.

## Saved generated assets and prompts

Generation mode: built-in `image_gen`, photorealistic-natural. Files are optimized WebP copies of the generated originals. Previous images remain available.

### Welcome

Saved asset: `public/design/campaign-welcome-v2.webp`.

Prompt: Full-bleed portrait fitness-app onboarding photograph. Athletic adult woman in an unbranded black sports bra, arms raised above her head while stretching, close three-quarter portrait. Deep blue light on skin against a burnt-orange studio backdrop. Sculptural composition, authentic skin, cinematic hard light, calm expression. Tall portrait with a darker lower-left area for white app text. Use the supplied welcome screenshot only as the photography/composition reference. No typography, interface, logos or watermark.

### Movement

Saved asset: `public/design/campaign-movement-v2.webp`.

Prompt: Adult athletic woman in unbranded black fitted training clothes performing a side-lying Pilates leg extension on a dark mat in a minimalist outdoor rooftop studio. Cool natural daylight, pale sky and distant greenery. Diagonal raised leg and extended arm, full body, realistic anatomy and textures. Wide 3:2 photograph with a central subject suitable for a portrait crop. Use the supplied Pilates screenshot's photography as a composition/lighting reference. No text, branding, UI or watermark.

### Strength

Saved asset: `public/design/campaign-strength-v2.webp`.

Prompt: High-end editorial fitness campaign photograph of an athletic adult woman in unbranded black training clothes performing a dumbbell row, free hand braced on a matte-black bench. Side angle, controlled exercise posture, warm amber natural sidelight, uncluttered modern studio with cream plaster and deep shadows. Real skin and human proportions, vertical 4:5 framing from the knees up. No text, logos, watermark, app interface or bodybuilding pose.

## Implementation and review

The principal additions are `src/avalen/nutrition-home.jsx` and `src/avalen/meal-photo.jsx`; they use the existing local workspace and media storage. Home and session layouts live in `src/avalen/editorial.jsx` and the active skin is `src/avalen/editorial.css`. No new dependencies were added.

Review images are in `output/coach-nutrition/`: welcome, home, nutrition, meal-photo, meal-review, session, logger and desktop. Browser checks use isolated test profiles and do not reset the user's saved workspace.

Validation: production build and 8 unit checks passed. All 30 distinct browser scenarios passed across Chrome and WebKit, including 320/390/768/1440px layouts, coach-to-client nutrition changes, reviewed photo logging and saved workouts. Two legacy logger selectors were updated to match the compact resume control; all 6 logger scenarios then passed in the focused rerun.
