# Upgrade an existing VSS project to 1.2.0

This is the complete source project, not a patch-only archive. It retains the uploaded 1.0.0 system and adds design interactions, accessible motion, API hardening, SQL permission/bounds checks, and team handover guides. It also includes the requested footer/student setup improvements. No hosted service has been changed by producing this ZIP.

## Keep your working copy and data

1. Commit or back up your existing **team Git clone** before changing source. Keep its `.git` directory, remote, `.env` and ignored `.local` database. Stop dev with Ctrl+C.
2. Extract this ZIP into a separate folder. Copy its source files/folders into that existing clone, overwriting matching source. Do not overwrite/delete `.git`, `.env`, `.local` or backups. The ZIP contains no account keys, records, dependencies, or Git history. Do not initialize a new repository inside a clone.
3. In the actual clone run `git status`, `git remote -v`, `npm ci`, then `npm run verify`. Start `npm run dev`; classroom startup applies only the new migration automatically. Confirm your prior local inquiry and owner-published copy remain.
4. Review `git diff --stat` and `git diff`. Ensure no private files are staged. Open a PR into `staging`; the student tech lead reviews it.

If the extracted folder has no `.git`, it is a source copy, not your clone. Open your clone in VS Code to commit/push. Do not delete the only copy of local data to fix a Git error.

## Existing hosted database: new migration only

Back up and test in staging first. If all three previous migrations are already installed, apply only:

`backend/database/migrations/20261015215617_harden_application_boundaries.sql`

Run the whole file in the correct Supabase project's SQL Editor once. Record its filename/date/commit in the release record; the dashboard SQL runner does not automatically maintain this project's migration ledger. If an earlier migration is missing, apply the missing canonical files in order first.

**Never run `INSTALL-FRESH.sql` on an existing project. Never rerun an already applied migration.** Keep earlier migration files unchanged. Fresh empty projects use the regenerated installer, which includes all four migrations.

The new checks are `NOT VALID`: old rows are preserved; new/updated rows must respect the bounds. Have the backend lead review any old rows that violate `inquiries_field_bounds`, `clients_field_bounds`, `privacy_field_bounds`, `staff_email_bounds`, `webhook_field_bounds` or `outbox_field_bounds` before explicitly validating a constraint. Do not delete business records merely to clear a check. The migration transaction fails atomically if any statement fails.

Server-only public RPCs now run with invoker permissions, backed by explicit service-role grants. The small private RLS/signal helpers keep their narrowly scoped definer privileges. Browser business-table access remains denied. Expired eighth-attempt notification leases now become dead letters; the owner can review and explicitly retry.

## Content and hosting

Published copy is retained. For the requested footer, use Website editor to publish:

- Footer tagline: `Philippines-based virtual assistants helping businesses worldwide grow smarter, faster, and leaner — 100% remote.`
- Location: `Philippines · Remote Worldwide`

Confirm the five service IDs before testing footer anchors. The site builds footer service links from the current published catalog after content loads. Client approval of the 48-hour/onboarding, NDA and quality promises is still a launch requirement.

Deploy the reviewed commit through the existing Netlify Git integration. Check the build includes API and scheduled-jobs Functions; use `npm run verify:deployment -- https://YOUR-SITE.netlify.app`, then complete the owner/live-delivery and phone checks in the release checklist. Local account passwords do not become hosted passwords.

No new runtime hosting service or paid animation package is required. `happy-dom` is a development-only DOM test dependency. Read `docs/VERIFICATION.md` for the actual execution evidence and remaining hosted/browser checks.
