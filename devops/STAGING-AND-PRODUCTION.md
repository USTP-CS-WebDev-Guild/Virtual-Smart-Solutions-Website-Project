# Staging and production without a permanent instructor lead

Use one **team-owned repository**, two fixed Netlify sites, and two isolated Supabase projects. The instructor helps the tech lead with the first setup, watches one successful release/rollback drill, then leaves operational ownership with the team.

| Environment | Git branch | Netlify address | Supabase data | Email | Access |
| --- | --- | --- | --- | --- | --- |
| Each student's local | Feature branch | 127.0.0.1:4321 | Their own `.local` PostgreSQL | Captured | Their generated local logins |
| Shared staging | `staging` | Stable team test `.netlify.app` origin | Test project, synthetic records only | `capture` | Staging Auth users + staff allowlist |
| Client production | `main` | Client's approved domain | Separate live project | Approved sender or owner checks inbox | Real owner/staff accounts |

## Set it up once

DevOps creates `staging` from the reviewed `main` and imports the repository as the staging site, using `staging` as that site's production branch. A staging **site's production deploy** is still the team's test environment; set `APP_ENV=staging`, `PUBLIC_TEST_ENVIRONMENT=true` and `TEST_EMAIL_MODE=capture`. This allows its scheduled Function to run on that fixed address. Client production uses `APP_ENV=production` and the mandatory activation/provider/MFA steps in `../SECURITY-UPGRADE-1.6.0.md`.

When the client approves, configure the second site from `main` with the live project's keys and domain. Until then keep the shared test site public with synthetic data. Never point staging at the live database, share their secrets, or copy the test inbox into production.

Set each site's exact `PUBLIC_SITE_URL`, `APP_ORIGIN`, Supabase URL/keys, Auth Site URL and a distinct rate-limit secret. Leave `PUBLIC_CLASSROOM_MODE` unset in both. Disable extra automatic branch deploys/Deploy Previews initially: a third changing URL adds origin, Auth and secret configuration beginners do not need. Add them later only with isolated test data and an approved exact-origin setup.

Use Free plans where their account/repository rules permit. Check free-project/usage limits and source confidentiality before setup; two environments can consume the whole allowed free-project allocation. A domain is a client expense. Do not enable paid spending automatically.

## Repeatable release

1. PM records client-approved scope and acceptance criteria. Student creates feature branch and PR into `staging`.
2. Backend lead adds a **new** migration if needed. Tech lead reviews security/SQL; CI must pass. No keys are required for CI.
3. DevOps backs up staging, applies only its missing migrations, then merges/deploys the reviewed source. Use backward-compatible DB changes that the previous app can tolerate.
4. UI/UX and QA complete the phone/keyboard/full-system walkthrough on staging. PM records screenshots/commit and obtains the client's approval.
5. For a live release, DevOps takes a live backup, applies reviewed compatible migrations to the live project, merges the same accepted change into `main`, and verifies the live deployment. No instructor action is needed.
6. Owner checks a synthetic inquiry/reference, notes/conversion as appropriate, live publication, private route rejection and notification health. PM closes the release record.

**Git promotes source, not database rows or CMS edits.** Approved content must be published deliberately in the correct environment's owner editor. Changing defaults does not overwrite a published database revision. Migrations do not copy Auth users; create/allowlist each environment's staff independently.

## When a release fails

DevOps restores/publishes the previous successful Netlify deploy while the tech lead investigates. A compatible schema change should allow that older app to run. Revert the faulty source commit through a PR before the next build so it does not return automatically. A CMS mistake uses Website editor revision history and a new publication.

A database restore is a separate incident procedure, not the ordinary code rollback button. Test recovery into an empty isolated project first; verify counts, staff identities, RLS and deletion replay before any live cutover. Record the incident and who approved the recovery. See MAINTENANCE-HANDOVER.md and OPERATIONS.md.

## Ownership

Tech lead owns the release decision; DevOps owns deployment/backups/alerts; backend owns schema/API; frontend and UI/UX own page behavior/accessibility; PM owns client scope and approval evidence. Name a deputy for tech lead and DevOps. Use individual memberships where provider plans allow, MFA for provider administrators and a shared operational password manager for recovery. The mentor does not need to retain everyone's passwords to oversee a release.
