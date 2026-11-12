# Liquid navigation motion — 15 October 2026

## Stronger connected trail

The user's follow-up found the original highlight too faint. The current implementation replaces the highlight with a connected SVG liquid surface, a brighter outlined rim and two damped springs: the selector leads and the rear drop follows, narrowing as it catches up. The shape remains visibly connected on adjacent tabs and longer jumps. A capped rear distance keeps the trail inside the navigation area.

The isolated component now draws with requestAnimationFrame rather than Web Animations; it updates only the selector transform and SVG paths, with no per-frame React state. Rapid reversals preserve current positions and velocities. Reduced motion, resize alignment and both workspace roles remain supported. The production build and all 4 Chrome/WebKit navigation checks pass. The reviewed recording and GIF are in `output/liquid-nav-v2/`.

## Original pass

The bottom glass selector now stretches gently toward the selected tab, with a faint lagging highlight that merges back into the lens. The 640 ms movement settles with a small compression rather than stopping abruptly. Both directions and longer jumps use the same restrained effect.

Motion lives in an isolated component and uses native Web Animations, with no dependency or per-frame React updates. Rapid taps retarget from the current visible position. The effect stays behind the tab controls, and system/in-app reduced-motion preferences switch directly to the selected position. Resize updates the landing position. Pixel translations avoid a narrow-screen Safari rounding drift found during testing.

Validation: production build passes, plus all 4 focused Chrome/WebKit scenarios for rapid reversals, distant tabs, 320px layout and both reduced-motion settings. The development server's first test run exhausted load/action timeouts; final checks ran against the built app on a temporary local preview server. The normal live app remains at port 5173 and its navigation was also checked there. Review media: `output/liquid-nav/navigation.gif`, `navigation.webm` and `preview.png`.
