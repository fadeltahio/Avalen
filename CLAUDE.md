# Avalen project instructions

Read `START_HERE_CLAUDE.md`, `HANDOFF_VALIDATION.md` and `FUNCTIONAL_REVIEW.md` first. This is the current source snapshot, including the October functional repairs.

- The active entry is `src/avalen/main.jsx`; do not switch back to the archived `src/main.jsx` prototype.
- Preserve the current black-and-white editorial design, photography, readable phone layouts, light theme, reduced motion and existing functionality.
- Keep real records intact. Device-preview storage and connected-account storage are different systems. Do not wipe, reseed or migrate a user's workspace as a routine fix.
- Successful UI feedback must follow persistence acknowledgement. On failure, retain input and allow recovery. Guard repeated/pending mutations.
- Preserve authorization, private media access, optimistic revisions, retry idempotency, immutable history and client-controlled consent.
- Treat payments, wearables, external notifications and optional AI as unconfigured unless a real integration is present. Do not invent results or imply a connection from a saved preference.
- Use isolated browser profiles and temporary databases/accounts for verification. Do not test against the user's actual `.avalen-data` or saved browser workspace.
- Prefer the checked-in pnpm lockfile. Run checks appropriate to the change and report their actual result; the previous final browser regression run was interrupted.
- Existing historical design documents and old visual-reference tests do not override the active source or the user's current instructions.
- Continue the priorities in `FUNCTIONAL_REVIEW.md` within the user's requested scope. Do not perform a broad redesign, drop features or introduce paid integrations by default.
