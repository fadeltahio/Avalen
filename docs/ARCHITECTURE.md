# How Avalen is organized

This is a map of the codebase's structure and the reasoning behind it, written after
a pass that split up the server and the biggest screen files. Read this before
making a large structural change; it should also make day-to-day bug fixes faster,
since it says where things live and why.

## Server (`server/`)

`server/app.js` is now a thin dispatcher: it builds the shared context, runs each
request through the right group of route handlers in order, and serves the built
web app for anything that isn't `/api/*`. All the actual route logic lives in
`server/routes/*.js`, one file per topic:

- `accounts.js` — sign up, sign in, coach codes, account deletion
- `workspace.js` — reading/saving the workspace, the `commands` dispatch, invitations, import
- `media.js` — uploading and serving private photos/videos/voice notes/PDFs
- `payments.js` — Paymob: the coach's connection, a client paying, Paymob's own callbacks
- `wearables.js` — WHOOP/Google Health connections and synced readings
- `coaching.js` — AI insight explanations, transcription requests, background job status

`server/context.js` builds the storage layer, the payment and wearable services,
and the handful of primitives every route needs (reading the signed-in user,
committing a workspace change, finding a media file) into one object, passed into
each route module. `server/http-utils.js` and `server/crypto-utils.js` hold
low-level helpers (reading a request body, serving a static file, hashing a
password) with no route logic in them.

### Storage (`server/store/`, `server/db/`, `server/migrations/`)

Routes and services never write SQL. They call named, async functions such as
`store.users.byEmail()`, `store.workspaces.save()` or `store.media.grant()`, grouped
by area in `server/store/*.js`. This is the seam for the PostgreSQL migration: the
database (Phase 1) and the shape of the data (Phase 2) change inside this folder,
not in the routes.

- Two drivers with one interface (`all`, `get`, `run`, `exec`, `transaction`, all
  async, `$1, $2 …` placeholders): `server/db/postgres.js` when `DATABASE_URL` is
  set, otherwise `server/db/sqlite.js` with a file in the data folder. Code inside a
  transaction keeps calling the store normally; the driver routes it into the open
  transaction.
- **Workouts and coaching relationships live in their own tables (Phase 2).**
  `workout_sessions` holds each workout, owned by the client (`client_id`) and tied
  to the `coaching_relationships` row it was logged under; `workout_sets` holds each
  set as a queryable row. `store.workspaces.get()` puts the workouts back into the
  workspace object and `save()` moves them out again (and keeps relationships in step
  with the client list), so routes and the app see exactly the same workspace as
  before. Each workout's original JSON is kept in `workout_sessions.data` because the
  app compares workouts by exact JSON. Workspaces written before Phase 2 are moved at
  startup by `moveInlineWorkouts()`, one at a time, and kept unchanged unless the
  rebuilt workspace is byte-for-byte identical. Removing a client from a coach's list
  ends the relationship but keeps the workouts; deleting the client's account removes
  them. Profiles, programmes, nutrition, check-ins and messages still live in the
  workspace document until Phase 3.
- **Every client-related list has its own table (Phase 3).** `server/store/records.js`
  lists the 20 areas (client profiles, food logs, habits, measurements, check-ins,
  messages, payments, history and so on). Each row keeps the record verbatim, its
  position in the list, its client and relationship, and a few queryable columns
  (calories, weights, payment status). The same rebuild-and-verify move covers them.
- **Saves send only what changed.** `src/avalen/ecosystem/changes.js` (shared by the
  app and the server) describes an edit record by record; the server applies it to
  the latest workspace and refuses it only if one of those same records changed
  meanwhile, then writes only the lists that changed (`changedAreas`). The earlier
  format that sent the whole workspace has been retired and is refused with a request
  to update the app.
- **Not done yet: paged history.** The app still receives a coach's full history when
  it opens. Screens such as personal bests, exercise stats and 90-day charts assume
  the whole history is present, so paging needs those screens reworked; it matters
  for coaches with many clients and long histories, not at pilot scale.
- **Clients don't depend on a coach.** A client login can have no workspace. If the
  client ends coaching (`/api/account/leave-coach`) or the coach deletes their
  account, the relationship ends and the client keeps their login and their own
  records (areas marked `owner: "client"`, plus workouts). Those rows stay where they
  are but are hidden from the former coach (`relationships.departed()`), who keeps
  payments, messages, documents and their own notes. A coach's deleted workspace stays
  as an empty marker (`workspaces.deleted_at`) while former clients own records in it.
  A client between coaches sees a coachless screen, can download everything
  (`/api/account/export`) and join a new coach (`/api/account/join-coach`), who starts
  fresh.
- PostgreSQL runs requests truly in parallel, so anything that reads a workspace and
  writes it back does so in a transaction with `store.workspaces.getForUpdate()` (a
  row lock). A second save to the same workspace waits rather than overwriting.
  `tests/storage.test.js` proves this fails without the lock.
- `server/migrations/<dialect>/NNN_name.sql` holds the schema. Each file runs once,
  in order, and is recorded in `schema_migrations`. Never edit a released file; add
  a new one. `001_base.sql` is the schema as it was, so older databases pass through
  unchanged.
- Code shared with the app (`command()` in `actions.js`, `validateMediaChanges`)
  can't wait on the database, so `commit()` loads the workspace's file records first
  and hands it a lookup that answers immediately, with the same permission rule as
  `permittedMedia`.
- `pnpm test` runs the unit tests on SQLite; `pnpm test:postgres` runs the same tests
  on a throwaway PostgreSQL 17 server, one empty database per test, deleted
  afterwards (`node tools/with-postgres.mjs <command>` does the same for any command).
  Install PostgreSQL with `brew install postgresql@17`. Run both before merging a
  storage change.
- `node tools/sqlite-to-postgres.mjs <avalen.sqlite>` copies a SQLite data file into
  an empty PostgreSQL database (`DATABASE_URL`) and compares every table afterwards;
  if anything differs, nothing is kept.

### Running in production (`server/config.js`, `server/health.js`, `server/log.js`)

With `NODE_ENV=production`, `server/index.js` checks the configuration first and exits
with a list of missing settings (names only), and the store and file layers refuse to
fall back to SQLite or local files. The PostgreSQL driver keeps running when the
database closes connections: the pool and each checked-out connection have error
listeners, a broken connection is discarded, and the request using it fails with a 503
(`server/db/errors.js` decides what counts as "unavailable") while nothing is committed.
Connections time out after 5 s, statements after 15 s (migrations are exempt).
`/api/health` checks the database (`?deep=1` adds file storage). Logs are JSON lines
without personal data. A coach's save may only add or change records for clients on
their own list, and not a departed client's own records. Deployment, backups and
recovery are in `docs/DEPLOYMENT.md`.

### Files (`server/files/`)

The bytes of uploads live behind `files.put / read / stream / remove`: the data
folder's `media` directory by default, or a private Cloudflare R2 bucket when
`AVALEN_R2_*` is set. Uploads are validated in a private temporary folder (ffprobe
and ffmpeg need a real file) before being stored. Files are only ever read through
the server after its permission check; R2 requests are signed, including a hash of
the uploaded bytes.

**Adding a query:** add a named function to the right file in `server/store/`, using
`$n` placeholders and SQL that both SQLite and PostgreSQL accept (for example
`INSERT … ON CONFLICT DO NOTHING`, not `INSERT OR IGNORE`). **Changing the schema:**
add a new numbered migration file.

**Adding an endpoint:** add it to the route module for its topic (or create a new
one for a genuinely new topic), and register its handler in the matching array in
`app.js` (`publicRoutes` for anything reached before a session is known,
`protectedRoutes` for everything else). Nothing else needs to change.

## Client screens (`src/avalen/`)

The two biggest screen files have been split one-screen-per-file, each named after
the screen it holds:

- `src/avalen/coach/*.jsx` — Dashboard, Clients, ClientDetail, ClientPlan,
  ProgramEditor, Programs, NutritionEditor, ScheduleEditor, TravelPlan, Inbox,
  Business, BillingEditor, Documents
- `src/avalen/client/*.jsx` — Today (unused, see below), Plan, Nutrition, Habits, Progress
- `src/avalen/more/*.jsx` — Welcome, FirstClient, CoachMore, You

`src/avalen/coach.jsx` and `src/avalen/client.jsx` are now thin files that just
re-export from those folders, so every existing `import … from "./coach.jsx"` (and
the lazy-loaded coach bundle `main.jsx` builds with `React.lazy`) keeps working
unchanged. Prefer importing directly from the specific screen file in new code —
the barrels exist for backward compatibility, not as the primary way in.

**Adding a screen:** add a new file next to the others in the right folder, export
it, and re-export it from the barrel (`coach.jsx` / `client.jsx`) if something
outside that folder needs it directly.

**`src/avalen/client/Today.jsx`:** this screen is not rendered anywhere — the
`today` route renders `EditorialHome` (in `editorial.jsx`) instead. It looks like
an earlier design that was replaced. It was kept as-is (moved, not deleted) since
removing code is a different kind of change from reorganizing it; it's a
reasonable candidate to delete if nothing turns out to depend on it.

**`src/main.jsx`** (at the project root, not `src/avalen/main.jsx`) is an old,
disconnected prototype — nothing in the app loads it (confirm with `grep -r
"src/main.jsx" index.html src/avalen`). It's not part of the active app; see
`CLAUDE.md` before touching it.

## Reusable domain actions

Two patterns exist for changing the workspace, both reaching the same `update()` /
`commit()` machinery underneath:

1. **`command(data, user, { action, payload })`** in
   `src/avalen/ecosystem/actions.js` — a single, named, tested function covering
   check-ins, schedule proposals, form reviews, AI consent, coaching-memory notes
   and notifications. The **same function runs on both the client (for the local
   preview) and the server** (via `POST /api/commands`), so the rule for e.g. "what
   happens when a check-in is submitted" exists in exactly one place.
2. **Inline `update(d => { …mutate…; decision(d, …); })`** — written at the call
   site, used for everything not yet covered by a named action. This is harder to
   find, reuse or test than a named function, and the earlier version of this
   codebase had this pattern duplicated verbatim in a few places (see
   `dismissFlag` below for one that was fixed).

**`dismissFlag(d, clientId, key, { days, title, detail })`**, in
`src/avalen/coach-review.js`, replaced three copies of the same "snooze this
review flag" logic (Dashboard's review queue, a client's attention-flag list, and
the progression-suggestion "keep current load" button). It's a plain function, not
routed through `command()`, since nothing about it needs replaying on the server —
the server already re-validates every change through `mergeEdit` regardless of how
the client produced it.

### What's left

Most one-off mutations (editing a programme, a schedule, a nutrition plan, a
membership record, etc.) are still written inline at their call site. Converting
all of them to named functions in one pass would be a much larger, logic-touching
change; the remaining ones, roughly in order of value:

1. **Nutrition** (`coach/NutritionEditor.jsx`, `client/Nutrition.jsx`) — saving a
   plan, logging/removing a food entry, completing a day.
2. **Schedule & travel** (`coach/ScheduleEditor.jsx`, `coach/TravelPlan.jsx`) —
   moving a session, starting/ending travel mode.
3. **Programme editing** (`coach/ProgramEditor.jsx`, `coach/Programs.jsx`) —
   saving a programme, assigning a template.
4. **Billing & documents** (`coach/BillingEditor.jsx`, `coach/Documents.jsx`,
   `coach/ClientDetail.jsx` pause/resume).
5. Smaller, lower-traffic ones: `WorkoutLogger.jsx`, `communication.jsx`,
   `editorial.jsx`, `meal-photo.jsx`, `payments.jsx`, `ReferenceMotion.jsx`,
   `more/You.jsx` (profile edit, data export, reset).

Each of these should get the same treatment `dismissFlag` did: find the actual
shape of the mutation, give it a name in a plain module near the data it touches
(not necessarily through `command()` — that's for actions that need identical
replay client- and server-side), add a unit test for it, then update the call
site(s), verified against the existing test suite before and after.
