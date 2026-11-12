# Avalen connected coaching

The existing device preview remains at `http://127.0.0.1:5173/`. It keeps the existing browser workspace and files. The connected app uses the same interface and domain models with authenticated server persistence. Choose **More → Connect a private coaching workspace**, or open `http://127.0.0.1:5173/?connected=1`.

## Run

Requires Node 24+, ffprobe and ffmpeg on PATH (or the explicit paths in `.env`). No cloud service is required for the deterministic coaching features.

```sh
npm install
cp .env.example .env
npm run dev:connected
```

If Vite is already running, start only `npm run server`. First setup requires the owner token configured in `.env` or printed by the service. Create your own coach password and initial client; the app does not ship usable account credentials. Invite clients from **Account**; invitations expire after 48 hours and can be used once. The old role selector never grants server access.

For a built application, run `npm run build`, then `npm start`; open `http://127.0.0.1:5180/`. Use HTTPS and `AVALEN_SECURE_COOKIE=true` before exposing a deployment outside localhost. The default binding is loopback. Use persistent private disk storage, a supervised process and service monitoring. This work adds the server; it does not provision public hosting, an HTTPS certificate, push delivery or an app-store build.

## Existing records and files

After owner setup, **Account → Bring your device workspace** explicitly imports browser records before live client activity. It archives the newly created server workspace first. File bytes are copied from IndexedDB to restricted storage with their original IDs; imported shared exercise/brand assets receive explicit access grants. Existing browser originals remain untouched. Interrupted file transfer can be retried without duplicating files. Missing or unsupported original files are listed; they are never represented as successfully migrated. Import is blocked after live activity or a client account exists.

Back up the SQLite database and its WAL consistently with SQLite's backup API or while the service is stopped. Back up the media directory alongside it. Keep the entire data directory outside a public static directory. File permissions default to owner-only. Recovery archives contain private information and need the same protection. The service stores one coach's workspace per owner setup; client accounts are related to that workspace. It is not an open public multi-coach signup service.

## Features and shared records

- Coaching Memory extends `timeline`. Programme and nutrition revisions store immutable before/after states. Private reasons and client-visible explanations have separate projections. Follow-up comparisons use relevant exercises and state their limits.
- Existing check-ins retain their configured metrics and 1–365 day cadence. They add voice/text, optional corrected transcripts, structured summaries, follow-up queues and in-app reminders. Fixed weekday scheduling is optional for a weekly cadence. Other cadences keep advancing from submission.
- Smart Rescheduling changes the existing `client.schedule`. Completed dates, workout logs and prescriptions are protected. Coach rules govern order, availability, spacing, frequency, time windows and priorities. A preview must be confirmed; exceptions need an explicit coach reason.
- FormLab attaches private recordings to existing exercises and optional workout/set context. Coach reviews preserve timestamped notes, normalized drawings and published review versions. Clients replay feedback and mark it viewed. Video upload is limited to 120 seconds / 100 MB; short voice feedback to 60 seconds. Existing programme/message media have separate limits. Deletion and expiry block authenticated downloads immediately; the worker removes the bytes. A dated decision record remains.
- Intelligence computes evidence-supported observations from the same records. Partial or missing nutrition data is not scored as nonadherence. Snooze, dismissal, rejection, review and approval decisions persist with evidence snapshots. Plan changes require a fresh before/after review and notify the client. Recent interventions provide context and suppress premature progression suggestions.

## Optional transcription

Set `AVALEN_TRANSCRIPTION_URL` to an HTTPS JSON adapter (localhost is allowed for integration tests). Set `AVALEN_TRANSCRIPTION_TOKEN` if required. The adapter receives:

```json
{"audio":"base64 bytes","mimeType":"audio/webm","language":null}
```

It must return `{"text":"actual transcription"}`. The application requests explicit consent before sending audio. A durable job retries temporary failures up to three times; stale/deleted recordings cannot receive results. The original recording remains playable, and the client can correct a transcript before submission. If unavailable, the UI offers direct audio review and never invents text. A configured provider adapter is a deployment dependency; no provider or billing account is silently selected.

## Optional Intelligence explanation

Set `AVALEN_AI_URL` and optionally `AVALEN_AI_TOKEN` for an HTTPS JSON adapter. The request contains the displayed evidence, recent decision context and an instruction to return a structured explanation. The response contract is:

```json
{"summary":"interpretation based on supplied records","considerations":["limitation"],"evidenceIds":["a supplied record ID"]}
```

The client must first opt in from More → Your AI sharing choice (off by default), and the coach must explicitly approve each request. A coach cannot grant this preference on the client’s behalf. Unknown evidence references and malformed responses are rejected. Output is labelled as AI interpretation; it cannot change a plan. Approval still rechecks stored evidence and the current prescription. Without a provider, deterministic observations and every review action continue to work.

## Reliability

SQLite migrations are additive. Authenticated roles and client relationships are checked on operations and media downloads; browser role fields are not trusted. Cookies are HttpOnly/SameSite, mutations require same-origin and CSRF headers, passwords use scrypt, and login/setup attempts are limited. Workspace writes require an optimistic revision and retry key. Completed sessions and recorded history cannot be rewritten through generic updates.

Interrupted workspace saves retain a retry payload under the signed-in account's device storage key, with a visible retry/recovery control. Other edits are blocked until that ambiguous save is resolved. Retrying a save that reached the server does not apply it twice. A revision conflict refreshes authoritative data and requires review rather than overwriting another change. Editors retain unpublished drafts when a save fails.

The worker runs with the service. In-app check-in reminders deduplicate by client and due period, use the configured local timezone/time, and resolve after submission. No email or push notification is claimed without a configured delivery transport. Pending processing restarts safely after a worker restart. Media retention runs every 30 seconds; downloads reject expired media even before physical cleanup.

## Verification

`npm test` covers domain rules, authenticated access, immutable records, media streaming/deletion, idempotency and concurrency. `npm run build` checks production bundling. `tests/ecosystem.spec.js` exercises real coach/client accounts and browser flows. The existing editorial, nutrition, workout, refinement and check-in suites cover regressions in the device preview. Browser tests use isolated profiles and temporary databases; they do not replace your workspace.
