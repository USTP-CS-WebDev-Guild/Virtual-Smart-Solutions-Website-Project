# Operating the test and production system

Release 1.6.0 production activation and incident procedures are in `../SECURITY-UPGRADE-1.6.0.md` and `SECURITY-OPERATIONS.md`.

## Classroom operation

Default `npm run dev` uses the local-only infrastructure in `devops/local/`. It uses the same feature routes and SQL functions; mail is forced to capture mode. A local timer runs maintenance while dev is open, or the test owner can run it on demand. API commits send metadata events over SSE. Arbitrary direct SQL edits are not a supported local event source; use the API/editor for live workflow tests. Hosted Realtime also observes database commits through its publication.

Local sessions expire on process restart; business records and accounts persist. `npm run accounts` shows local-only credentials. Stop dev before reset; the reset script archives the whole folder. Do not publish that folder or run this local runtime on a server.

## Inquiry and notification flow

The API validates the form and rate-limits each keyed IP bucket. A Postgres transaction writes the inquiry, initial audit event, and outbox record together. The database record is the source of truth; an email failure does not lose a lead.

A Netlify scheduled function checks a small batch every five minutes. Resend handles email only after the owner configures an API key and verified sender. Transient failures retry with bounded exponential backoff and jitter for up to eight attempts, then become `dead`. The owner can inspect notification state in the inquiry detail and retry a dead notice. Webhook signatures are verified and event IDs are stored once.

Test and deploy-preview environments set `TEST_EMAIL_MODE=capture`; test notices are marked captured and never sent. Keep synthetic data in test projects.

## Staff access and audit

Every private API request validates its exact bearer token with Supabase Auth, then checks an active, verified, non-anonymous Auth UUID binding in `staff_users`. Production also requires TOTP and checks the actual session, eight-hour lifetime and fifteen-minute private-API activity window. `staff` can manage the shared inquiry/client inbox; `owner` can publish content, handle privacy requests and retry notifications. Manual test jobs are staging/capture-only; production uses the scheduler. Browser roles can SELECT only permitted metadata rows in `change_signals`; business tables and mutation RPCs remain server-only. Private signal RLS checks the real UID, role and armed MFA/session policy.

To offboard someone, disable the Supabase Auth account, set `staff_users.active=false` and `disabled_at`, revoke sessions in Supabase Auth, review their recent audit history, and rotate any test secret they were allowed to use. Only the authorized tech lead/DevOps maintainers hold production service-role credentials; ordinary contributors use local/test data.

## Live updates and recovery

The browser subscribes to metadata revisions over Supabase Realtime WebSockets. It then fetches current data through the authorized API. There is no interval-based data polling. Reconnect/focus/online reconcile missed changes; failed API refreshes have bounded retries. Offline, reconnecting, and missing-setup states remain visible. A live socket alone does not prove database replication: use the test owner **Verify live delivery** button to observe an actual revision event.

After migrations/restores, use **Check contact form** and `npm run verify:deployment -- https://your-site.netlify.app`. Verify the publication contains `public.change_signals` and the signal-trigger/RLS checks pass. Never add customer tables to the stream to work around missing updates. For public-phone login problems, check Netlify Production visibility, not the owner password.

## Privacy and retention

The initial migration anonymizes unconverted inquiries and completed privacy-request details after 12 months. The realtime upgrade also scrubs linked note text/author within the same anonymization transaction. Converted client records are retained separately and need the business's legal/contractual policy. The owner must approve the published policy and its applicable regions before collecting real data. Privacy request handling requires staff to verify identity and record the action and note.

The system minimizes logs: do not log inquiry bodies, access tokens, email contents, or secrets. A restored backup may contain information that was later deleted; replay deletion requests before putting the restored database back in service.

## Backups and recovery

Check the selected provider plan's recovery facilities; do not rely on an untested provider backup alone. The optional weekly GitHub Actions workflow exports application schema/business data from `public` and `app_private`, encrypts it with AES-256-GCM, and stores the encrypted file for **14 days in a restricted private operations repository**. Define an additional client recovery copy and retention policy within approved storage limits. The SQL dump does **not** back up Supabase Auth users, live session activity, staff approvals, provider settings or project configuration. Recreate verified Auth accounts and explicitly approve their exact new UUIDs during recovery. Keep `SUPABASE_DB_URL` and `BACKUP_ENCRYPTION_KEY` as private operations repository secrets, not variables, `.env.example`, issues or student branches.

Keep the backup workflow disabled in the shared source repo. Enable it only in the selected private operations repo with `ENABLE_PRODUCTION_BACKUP=true` and `PRODUCTION_BACKUP_REPOSITORY=OWNER/REPO`. It refuses to run in a public repository. Restrict that repo to operators; repository secrets are accessible to code that those operators authorize. Check Actions minute/artifact allowances and complete a manual run before relying on the schedule.

The exporter explicitly creates BOTH a schema dump (`public,app_private`) and a data-only dump of those schemas, combines them, encrypts the result, and deletes temporary plaintext. Pause schema migrations during backup. A schema-only export does not recover inquiries. The Supabase CLI runs pg_dump in Docker; the GitHub Ubuntu runner supplies it. Only the operator needs Supabase CLI + Docker for a local export; everyday student development does not.

For a local encrypted export, install the Supabase CLI and Docker and set these PowerShell values from the owner's password manager:

```powershell
$env:SUPABASE_DB_URL = "<owner-only database connection string>"
$env:BACKUP_ENCRYPTION_KEY = "<long random backup key>"
npm run db:backup
```

The result is a local encrypted `.sql.enc` file. Store it outside the repository. Restore only to a new empty staging project first; the helper requires an explicit confirmation and a separate `RESTORE_DATABASE_URL`. Install `psql` for the restore. Confirm app data, private authorization helpers, grants, RLS, and deletion records. Re-register `public.change_signals` in `supabase_realtime` if the publication was not restored, then run the live checks; publications/provider settings are not covered by the application-only dump. Recreate and verify Supabase Auth users separately before making any production recovery decision.

Run a restore drill at least quarterly. The encrypted artifact retention is 90 days; download an artifact and store a second encrypted copy in owner-controlled storage if a longer retention period is required. That storage choice may have a cost.

## Free-tier monitoring

Use Netlify deploy status and function logs plus Supabase project health. Set a free external uptime check against `/api/health/live` if desired, but it cannot guarantee alert delivery. Review Netlify usage before the monthly credit cap; Netlify Free pauses when the cap is reached. Check Supabase periodically for inactivity warnings or a paused test/production project. Neither free plan includes an uptime SLA.
