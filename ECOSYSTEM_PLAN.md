# Avalen coaching ecosystem

## Architecture found

React 19/Vite, hash navigation, shared AppContext, a versioned browser workspace and IndexedDB files. There is no existing server authentication, database, private object storage, job worker or AI integration. The role selector is a demo control, not authorization. Workout drafts, completed sessions, nutrition day snapshots, per-client check-in fields/cadence, measurements and the timeline already work and must remain the canonical records.

## Implementation sequence

1. Add a Node/SQLite service with authenticated coach/client membership, private media, optimistic concurrency, migrations and durable jobs. Keep the device preview operational. Extend the existing timeline into structured Coaching Memory; snapshot programme/nutrition revisions automatically on changes. Never import browser records without an explicit coach action.
2. Extend existing check-ins with concise text/voice, corrected transcripts, contextual summaries, timezone-aware reminders, late submissions and review status. Preserve coach-selected measurements and cadence.
3. Add a shared deterministic schedule engine and reviewable proposals. Reuse the existing schedule; preserve completed dates and prescriptions. Enforce client flexibility on the server.
4. Add exercise-context FormLab submissions, authenticated video streaming, normalized annotations, feedback and review history. Validate media on the server, keep retention/deletion explicit.
5. Add deterministic Intelligence backed by stored records, evidence and data-quality limits. Persist decisions and route proposed actions through review. AI/transcription are optional server integrations with explicit consent; unavailable integrations never generate pretend output.
6. Test domain rules, account separation, restricted media, concurrency, retries and full browser journeys. Recheck existing workout/nutrition/check-in flows and narrow-screen controls.

## Reuse and data ownership

Existing `clients`, `sessions`, `foodLogs`, `nutritionDays`, `measurements`, `checkins`, `messages`, `drafts` and `timeline` remain authoritative. Add programme revisions, schedule proposals, FormLab submissions, insight decisions and notification delivery records alongside them. New features write to the same memory and notifications. Existing editors gain automatic history, rather than competing editors.

## External dependencies and risks

- Node 24 includes SQLite. HTTPS/reverse proxy, persistent disk backups and a continuously running service are deployment requirements.
- Video validation needs ffprobe/ffmpeg. If unavailable, reject unsupported video processing explicitly; do not trust browser duration metadata.
- Optional transcription uses a server-configured provider and explicit user consent. No provider credentials exist today.
- Browser-only media migration must copy bytes, not just file descriptors. Preserve original browser records until migration succeeds.
- Whole-workspace concurrency needs revision checks, server-side field permissions and immutable completed history. No client-provided role or client ID establishes access.
- In-app reminders persist and deduplicate; external push/email delivery requires a configured transport and must not be advertised as active.

This document records the plan, not a claim that the features are complete.
