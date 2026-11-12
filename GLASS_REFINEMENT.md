# Icy glass refinement — 14 October 2026

The current ice-blue design uses locally hosted variable Manrope for text and controls, paired with Space Grotesk for headings. Both fonts are small WOFF2 assets. Manrope's SIL Open Font License is included at `src/assets/manrope-OFL.txt`; its original source was downloaded from the Google Fonts Manrope directory.

Cards, date capsules, tabs, header controls, dialogs, buttons and the desktop sidebar now use translucent blue surfaces, soft backdrop blur, brighter rim highlights and diffuse shadows. Photographic workout cards retain their image contrast. The workout exercise dock also receives a translucent finish.

The mobile bottom navigation is a single glass capsule. A separate noninteractive glass lens slides to the selected destination; icons and labels stay above it. Five equal columns preserve stable tap targets and the active lens follows both client and coach navigation. Labels are larger than in the preceding ice theme. The motion stops for system or app Reduce Motion. When blur is unavailable or reduced transparency/higher contrast is requested, surfaces use a solid fallback.

The finish uses CSS blur, saturation, highlights and gradients to create the liquid-glass appearance. No new animation library or continuous decorative animation is added. The existing water simulation retains its refraction and touch interactions, and uses the new font once it loads.

Review captures and the source backup are in `output/glass-refinement/`. The main implementation is in `src/avalen/ice-design.css`, shared material and font values in `src/avalen/tokens.css`, and the selection lens in `src/avalen/main.jsx`.

The fonts are confirmed loaded in both an isolated review capture and the existing personal preview. The live preview reports a 26px blurred/saturated glass dock and the moving lens. The build and all 8 unit checks pass. All 14 focused Chrome and Safari/WebKit scenarios pass, covering both themes and both workspaces at 375/768/1440 pixels, 320px reduced-motion navigation, named/active navigation controls, water persistence/undo, coach video playback/fallback, exercise imagery, and system reduced motion. Review screenshots also show the selection lens beneath Today and Plan.
