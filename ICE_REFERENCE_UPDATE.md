# Ice-blue fitness reference — 14 October 2026

The supplied reference replaces the earlier editorial ink/ivory direction. The current app uses pale ice-blue surfaces, clean Space Grotesk sans-serif typography, rounded date capsules, monochrome blue-tinted workout photos, soft white pill controls, and a floating navigation dock. The dark option uses the same design in deeper blue.

Home shows the actual scheduled workout, previews of upcoming programme days, programme information, activity, daily fuel, interactive water, and coach messages. Preview cards select their real scheduled date; future workouts retain the existing lock. The in-progress workout card adopts the same photo treatment and preserves its saved sets and resume action. Programme, diary, progress and coach screens share the same theme.

Light becomes the default once when adopting this design. The migration changes only appearance settings and records its version; subsequent light/dark choices persist. Workspace records, client branding, coach media, water logs and workout drafts remain intact. No sign-in, syncing, or AI-analysis capability is added.

The water shader and Canvas fallback now use the reference's softer blue palette. Waves, touch ripples, underwater type refraction, reduced motion, and logging/undo remain functional.

## Studio asset

Generated with the built-in image-generation tool, copied into the project, and encoded as WebP:
- `public/design/studio-ice-v1.webp` — app asset
- `output/ice-reference/studio-original.png` — original

Final prompt: Create a photographic fitness campaign asset for an icy blue monochrome mobile fitness app. Portrait 2:3 composition. An airy minimalist pilates studio with pale ice-blue daylight through enormous frosted windows, black reformer equipment and two adult female athletes in modest black workout clothing, silhouetted by backlight. One seated upright side-on on a reformer in the lower-left-middle; another standing beside a reformer on the lower right. Anatomically natural professional editorial fitness photography. Keep the top 45 percent as quiet blue-gray wall/windows for a UI headline and the equipment and athletes in the bottom 50 percent. Cool desaturated slate-blue, pale blue-white and black; authentic texture and soft bloom. Plain photograph only, with no text, branding, phone, frame or UI; no warm colors or dramatic dark gym lighting.

## Review and validation

Before-change source backup and phone/desktop screenshots are in `output/ice-reference/`. The active stylesheet is `src/avalen/ice-design.css`; shared theme values remain in `src/avalen/tokens.css`.

The final build and all 8 unit checks pass. All 24 focused browser scenarios pass across Chrome and Safari/WebKit. Checks cover the default light theme, real scheduled-day previews, preserving saved sets during theme adoption, later appearance-choice persistence, water logging/undo/touch/refraction, coach video playback and missing-media fallback, reduced motion, both themes and both workspaces at 375/768/1440 pixels, calendar resizing, meal-photo entry, rest persistence and the small-phone workout logger. Both existing in-app preview tabs were refreshed; the saved personal draft and water records remain visible.
