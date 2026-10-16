# Team maintenance and handover

Fill in the actual names/URLs in a **restricted team operations record**. Do not add passwords or keys to this repository.

| Responsibility | Primary | Deputy | Evidence |
| --- | --- | --- | --- |
| Release approval and technical review | Student tech lead | Another student lead | Accepted PR + release record |
| Hosting, DNS, deployments, usage alerts | DevOps lead | DevOps deputy | Access and recovery drill |
| Database migrations and privacy fixes | Backend lead | Backend deputy | Reviewed migration + restore proof |
| Phone, keyboard, design acceptance | UI/UX + frontend leads | QA student | Test device/width record |
| Client scope, content and launch approval | PM | PM deputy | Client approval record |
| Domain renewal and business data decisions | Client's named owner | Client's deputy | Registrar/recovery and policy ownership |

The instructor can review the first release and then leave. Students use individual GitHub accounts, provider memberships where supported, MFA for provider administrators and an operational password manager. A shared mailbox is a recovery/contact address, not a reason to share one password across every student. Review plan/membership limits before inviting extra paid seats.

## The first handover session

1. Students clone/start the source on a second computer without instructor credentials.
2. Frontend publishes a small change through a PR into staging; backend explains its API/data flow.
3. DevOps deploys and verifies it; UI/UX checks a phone, keyboard, reduced motion and errors.
4. DevOps rolls back the code deploy and then restores the accepted version. Explain why this does not reverse a SQL migration.
5. Backend + DevOps restore an encrypted **synthetic staging backup** into an empty test project. Recreate Auth users as needed, verify the active staff allowlist/RLS and rehearse deletion replay.
6. PM fills the release record. Tech lead and deputy each explain what to do if the public form, sign-in or live feed fails.

When they can perform these steps, the mentor is no longer a release gate. Agree an escalation contact and response window explicitly; do not assume indefinite on-call support.

## Routine schedule

| When | Maintainer action |
| --- | --- |
| Every release | Clean install, `npm run verify`, browser/phone checks, reviewed compatible migrations, backup, deploy verifier and owner live-delivery check |
| Weekly while live | Check readiness and notification health, outbox failures, provider usage, staff access, enquiry follow-up; create an encrypted backup |
| Monthly | Review dependency/security updates on a branch; inspect `npm audit`; verify domain/certificate/recovery contacts; complete a restore drill into staging |
| Quarterly / when roles change | Review least privilege, staff offboarding, privacy/retention decisions and client content; rotate credentials anyone leaving could access |

Use external uptime checks on `/api/health/ready` and `/api/health/notifications` if an approved free monitor is available. Name who receives alerts. The footer status is a visitor check, not an independent monitoring/alerting service. Free quotas/inactivity pauses need human attention; checking a URL does not create an uptime SLA.

## Backup and restore

A local hosted export requires Supabase CLI plus Docker (the CLI runs pg_dump in a container), a private `SUPABASE_DB_URL`, and `BACKUP_ENCRYPTION_KEY` of at least 24 characters. Restore requires the PostgreSQL `psql` client. Ordinary students do not need these tools. Consult OPERATIONS.md for the full procedure.

- Run `npm run db:backup -- vss-YYYY-MM-DD.sql.enc` after setting those values in the terminal environment through your password manager. The optional weekly GitHub backup workflow stays disabled in the student source repo; enable it only in a restricted team/client operations repo and verify its first run. Manual weekly exports remain the baseline until automation is proven.
- Store the encrypted artifact outside the database provider, with separate access to its encryption passphrase. Keep the agreed retention (starting proposal: four weekly and three month-end copies, subject to the business policy). Do not commit or email raw SQL.
- Restore only into an empty isolated Supabase test project using `RESTORE_DATABASE_URL` and `npm run db:restore -- vss-YYYY-MM-DD.sql.enc`. Its confirmation phrase is deliberate; verify the destination first.
- The application export includes schema/data/RLS/functions, **not managed Auth identities, provider keys, DNS or a working mailbox**. Recreate accounts/relink identities as required. Confirm email-based staff allowlisting and test current RLS after recovery.
- Replay completed deletion requests before restored records return to live service. Keep the separate authorized deletion ledger needed to do this; document who controls it and its retention. Never reopen erased records just because a backup predates deletion.
- Record export/restore time, backup age, counts and verification result. Agree a recovery objective with the client; this repository does not claim a guaranteed RPO/RTO.

## Quick diagnosis

| Symptom | First checks |
| --- | --- |
| Public site asks for Netlify login | Live site's visitor access and whether this is the production URL |
| Public form fails | Owner Check contact form; exact APP_ORIGIN; API logs by X-Request-ID; database readiness; no fake success message |
| Owner cannot sign in | Correct environment's Auth user/password and active `staff_users` row; public signup is intentionally disabled |
| Save works but another tab is stale | Connection indicator; Verify live delivery; Realtime publication/RLS/migrations; reconnect after returning online |
| Inquiry exists but email does not arrive | Capture mode versus send mode; outbox accepted/delivered/bounced state; verified sender and signed webhook; provider quota |
| Changed repository text does not appear | Published owner content takes precedence; use Website editor or coordinate a reviewed content update |
| Production incident after a code release | Publish previous compatible deploy, revert faulty commit via PR, then investigate; do not erase the database |
| Suspected secret exposure | Revoke/rotate the key in its provider; replace only the correct server environment; redeploy; inspect access, preserve evidence and involve tech lead/client |

Logs must not contain passwords, tokens, raw request bodies or customer messages. Report request IDs and setting **names**, never values. Security reports go privately to the tech lead/client, not a public GitHub issue with records.

## Offboarding / final client handoff

Disable the person's staff row, revoke app/Auth sessions where supported, remove their GitHub/provider memberships and operational-password-manager access, and rotate any shared secret they could read. Review recent audit events. Verify a remaining owner and deputy can still sign in before removing the last maintainer.

Transfer/confirm repository, Netlify, Supabase, registrar, email sender and recovery ownership with the client. Deliver the accepted commit/tag, setup/release/rollback guides, privacy process, backup location/restore evidence, quota notes and agreed support scope. Remove mentor access after the student lead demonstrates recovery. Do not remove a client's working account or copy customer data to student devices during handover.
