# Avalen audit and polish plan

1. Read the active React/Vite entry, local state/media storage, every client and coach module, UI primitives and CSS; inventory archived prototype, assets, tools, documentation and tests. Run the unmodified baseline build and tests. Record concrete findings in AUDIT.md before implementation.
2. Establish a scoped Git baseline for this app only. Preserve all existing records, media, assets and archived source.
3. Functional pass: address reproducible defects, persistence and validation weaknesses, misleading unfinished controls, loading/error feedback and accessibility primitives; add regression coverage. Keep integrations explicitly unavailable until real services exist.
4. Smoothness pass: reduce unnecessary work and startup loading, robust navigation and async media handling, motion/reduced-motion and responsive/keyboard verification.
5. Visual pass: retain the Avalen charcoal/emerald identity and navigation, centralize design tokens, implement coherent light mode and intentional empty/loading/error states.
6. Re-run unit/browser/build checks, inspect representative phone/desktop screens, commit each logical pass, and update AUDIT.md and run instructions with honest remaining production dependencies.

Specialist review may be parallelized per the app-builder skill. No specialist changes before the baseline audit is recorded; file ownership must be explicit. No new service deployment, credentials, cloud data migration or removal of functionality is implied.

## Completed reference design update — 12 October 2026

Reviewed three supplied recordings and four UI references. Implemented liquid hydration, expanding navigation, a saved-state morph, exercise imagery/coach media and a photo-backed rep logger. Preserved prescription/history/rest/edit/undo flows; verified upload, playback, media failure, water persistence, responsive layouts and reduced motion. Details and final checks: REFERENCE_DESIGN_UPDATE.md.
