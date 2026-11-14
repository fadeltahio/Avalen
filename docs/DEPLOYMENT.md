# Deploying Avalen: staging, backups and recovery

This covers running the server on Render with PostgreSQL and Cloudflare R2, the daily
off-site backup, how to restore, and the checklist that staging must pass before
production. Nothing here has been run on a real host yet: every step marked
**Verify in staging** is unproven until someone does it.

## What production requires

With `NODE_ENV=production` (the Dockerfile sets it) the server checks its configuration
before opening the database and refuses to start if anything is missing or invalid. It
prints the names of the problem settings, never their values, and exits with code 1.
It never falls back to SQLite or to the local media folder in production.

| Setting | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://user:password@host:port/database`. On Render, the database's internal URL (private network, no TLS needed). |
| `AVALEN_SECRETS_KEY` | yes | 32 random bytes, base64. Encrypts stored Paymob and wearable tokens. Keep a copy outside Render. |
| `AVALEN_R2_BUCKET`, `AVALEN_R2_ENDPOINT`, `AVALEN_R2_ACCESS_KEY_ID`, `AVALEN_R2_SECRET_ACCESS_KEY` | yes | The private media bucket. The endpoint must be `https://`. |
| `AVALEN_PUBLIC_URL` | yes | The service's public `https://` origin, no path. |
| `AVALEN_SETUP_TOKEN` | yes | At least 32 characters. Used once to create the owner account. |
| `AVALEN_CLIENT_IP_HEADER` or `AVALEN_TRUST_PROXY=true` | yes | How the server learns each person's address behind the host's proxy, for sign-in limits. On Render: `cf-connecting-ip`. |
| `AVALEN_SECURE_COOKIE` | no | Cookies are HTTPS-only in production by default. Setting it to `false` is refused. |
| `AVALEN_DB_POOL_MAX` | no | Connections per instance (default 10). Keep instances × this below the plan's limit. |
| `AVALEN_LOG_REQUESTS` | no | Request logs are on in production; `false` turns them off. |

## Render staging

`render.yaml` is a Blueprint for staging: one web service (Docker, Frankfurt, one
instance, health check on `/api/health`), a PostgreSQL 17 database reachable only from
Render's private network, and a daily backup cron job.

1. **Cloudflare R2.** Create two private buckets, e.g. `avalen-staging-media` and
   `avalen-staging-backups`. Create one API token per bucket with Object Read & Write
   on that bucket only. On the backups bucket, add a lifecycle rule that deletes objects
   after 30 days (or longer: this is the backup retention).
2. **Render.** New → Blueprint, pick this repository. Render asks for each `sync: false`
   value: the media bucket settings for the web service, the backup bucket settings for
   the cron job, and `AVALEN_PUBLIC_URL` (the `onrender.com` address, or a custom domain).
3. **Secrets.** Render generates `AVALEN_SECRETS_KEY` and `AVALEN_SETUP_TOKEN`. Copy the
   secrets key into your password manager. Without it, a restored database can't read
   stored payment or wearable tokens.
4. **Deploy** (auto-deploy is off: deploy manually). The first start runs the database
   migrations. If the configuration is incomplete the deploy fails and the log lists
   what's missing.
5. **Owner account.** Use the setup token once from the app's first-run screen.
6. Run the **staging checklist** below.

Production is the same setup with its own database, buckets, tokens and secrets key.
Never point staging at production data.

## Health and logs

- `GET /api/health` answers 200 when the database responds within 2 s, otherwise 503.
  Render uses it to decide whether a new deploy may take traffic and whether to restart
  an instance. It doesn't check file storage, so an R2 outage doesn't trigger restarts.
- `GET /api/health?deep=1` also checks the media bucket (a signed lookup). Point an
  external uptime monitor at this address with an alert on anything but 200.
- The response says which database and storage are in use (`"database": "postgres"`,
  `"storage": "r2"`) and the deployed commit. Nothing personal or secret is in it.
- Logs are one JSON object per line: `level`, `msg`, and for requests `method`, `path`
  (no query string), `status`, `ms` and `requestId` (also returned as `X-Request-Id`).
  No email addresses, IP addresses or request bodies are logged. Useful alerts:
  `level` = `error`; `msg` = `database unavailable`; `msg` = `uncaught exception, exiting`.
- When the database drops connections (maintenance, failover), the server logs
  `database connection closed while idle` or `… during a request` and keeps running.
  The affected request gets a 503 saying nothing was saved. The app keeps the input, and
  retrying with the same request key is answered once. `tests/database-recovery.test.js`
  covers this.

## Backups

Two layers, both needed:

1. **Render's own backups** of the database. What's included depends on the plan
   (check the database's Recovery tab). They protect against mistakes and corruption,
   but they live with the same provider.
2. **Daily off-site copy** (`avalen-staging-backup` cron, `Dockerfile.backup`,
   `tools/backup-database.mjs`). It takes a consistent `pg_dump` and uploads it, with a
   manifest, to the backup bucket at
   `<prefix>/<date>/avalen-<timestamp>.dump` and `….dump.manifest.json`. The manifest
   records the row count of every table, taken in the same database snapshot as the dump,
   plus the schema version and a SHA-256 of the file. A failed run exits non-zero, so
   Render marks it failed; enable failure notifications on the cron job.

Media files in R2 are not part of the database dump. For the pilot, R2's own durability
is the protection. Deleted uploads are removed on purpose (account deletion, retention).

## Restoring

`tools/restore-backup.mjs` restores into an **empty** database and proves the result is
complete. It checks the dump's SHA-256 against the manifest, refuses a target that has
any tables or equals `DATABASE_URL`, restores in a single transaction, then compares
every table's row count and the schema version with the manifest. Exit code 0 means
everything matched. `tests/backup-restore.test.js` runs this end to end.

### Restore drill (do this once before the pilot, then monthly)

1. In Render, create a temporary PostgreSQL 17 database (`avalen-restore-drill`).
2. From a machine with PostgreSQL 17 client tools and this repository:

   ```bash
   export AVALEN_BACKUP_R2_BUCKET=… AVALEN_BACKUP_R2_ENDPOINT=… AVALEN_BACKUP_R2_ACCESS_KEY_ID=… AVALEN_BACKUP_R2_SECRET_ACCESS_KEY=…
   export TARGET_DATABASE_URL='<the drill database external URL>?sslmode=require'
   node tools/restore-backup.mjs avalen-staging/2026-11-20/avalen-<timestamp>.dump
   ```

3. Expect `"complete": true` and the table and row totals. Write down the date, the
   backup used, the totals and how long it took.
4. Optionally run the server locally against the drill database (`DATABASE_URL`) and sign
   in with a staging account.
5. Delete the drill database.

### Recovering production from a backup

1. Stop writes: suspend the web service in Render.
2. Create a new, empty PostgreSQL database. Restore the chosen backup into it with
   `tools/restore-backup.mjs` (or Render's point-in-time recovery, which creates a new
   database for you). Only continue on `"complete": true`.
3. Point the web service's `DATABASE_URL` at the new database. Keep the same
   `AVALEN_SECRETS_KEY`.
4. Resume and deploy. Check `/api/health?deep=1` and sign in.
5. Keep the old database until the new one is confirmed, then delete it.

Everything written after the backup was taken is lost. With daily dumps that is up to 24
hours, unless Render's point-in-time recovery covers the period.

### Schema changes

Migrations only go forward. Before deploying a release with a new migration, run the
backup cron manually and confirm it succeeded. Rolling back means the recovery steps
above with that backup, plus redeploying the previous release.

## Staging verification checklist

Do these on staging, in order, and record the result of each. Nothing on this list has
been run yet.

**Configuration**
- [ ] A deploy with one required variable removed fails, and the log names it without
      showing any value. Put it back.
- [ ] `GET /api/health?deep=1` returns 200 with `"database": "postgres"` and `"storage": "r2"`.

**HTTPS and security**
- [ ] `http://` redirects to `https://`.
- [ ] Responses carry `Strict-Transport-Security: max-age=31536000`.
- [ ] The sign-in cookie has `Secure; HttpOnly; SameSite=Strict`.

**Proxy**
- [ ] 16 wrong passwords from a phone on mobile data get a 429. A correct sign-in from a
      laptop on another network still works, which proves limits are per person, not
      shared through the proxy.

**Authentication**
- [ ] Owner setup with the setup token. Coach sign-up, sign-in, sign-out.
- [ ] Client joins by coach code and by invitation. The invitation can't be reused.
- [ ] Wrong password is refused.

**Persistence**
- [ ] Coach edits a programme and nutrition target. Client logs a workout, a meal and a
      check-in. Coach reviews the check-in.
- [ ] Redeploy, then confirm all of it is still there for both accounts.

**Uploads**
- [ ] Upload a progress photo, a voice note and a video from the iPhone app. They play
      back for the client and the coach.
- [ ] The files are in the R2 media bucket and the bucket has no public access.
- [ ] A second coach account can't open the first coach's client's photo by its address.

**Restart behaviour**
- [ ] Restart the web service from the dashboard while the app is open. The app recovers
      and nothing is lost.
- [ ] Restart the database (or wait for maintenance). Logs show
      `database connection closed…`, the service stays up, and `/api/health` returns to 200.
- [ ] Save something while the database is restarting. The app shows the error, keeps the
      input, and the retry saves it once.

**Backups**
- [ ] Run the backup cron manually. The dump and manifest appear in the backup bucket.
- [ ] Complete the restore drill above against that backup.

**App**
- [ ] A TestFlight build pointed at staging signs in, syncs and uploads over mobile data.
