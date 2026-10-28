# DevOps — run, check, deploy, recover

**Your first task:** start a fresh copy with `npm ci` and `npm run dev`, then explain the two terminal services and the ignored `.local` database. Run `npm run doctor`.

| Work                                      | File / guide                                    |
| ----------------------------------------- | ----------------------------------------------- |
| Start both local services                 | `scripts/start.mjs`                             |
| Local database, sessions, event transport | `local/` — infrastructure, not feature code     |
| Environment setup                         | `scripts/setup.mjs`, `../.env.example`          |
| Pre-PR checks                             | `../.github/workflows/ci.yml`, `npm run verify` |
| New student GitHub repo                   | [REPOSITORY-SETUP.md](REPOSITORY-SETUP.md)      |
| Full independent public deployment        | [DEPLOYMENT.md](DEPLOYMENT.md)                  |
| Test walkthrough                          | [TEST-THE-SYSTEM.md](TEST-THE-SYSTEM.md)        |
| Recovery, mail, offboarding               | [OPERATIONS.md](OPERATIONS.md)                  |
| Capacity / cost limits                    | [COSTS.md](COSTS.md)                            |

Local classroom mode persists real PostgreSQL records under `.local/database/`. Its accounts are random per installation, passwords are checked on the server with scrypt hashes, and its sessions expire/revoke. Events carry only revision metadata; private scope reads use the real SQL RLS policy. SSE is used locally; hosted production uses Supabase Realtime WebSockets. API routes, validations, SQL business functions, and role checks are shared.

Classroom auth is loopback-only, refuses hosted/production startup, and is not imported by Netlify Functions. Production frontend builds use Supabase even if someone attempts to request a local API. Do not expose ports with a tunnel or change the bind address to share it. Deploy the hosted system for public links.

`npm run accounts` prints local logins. To start over, stop dev and run `npm run reset:local -- --confirm-local-data`; it archives rather than deletes. Backups are ignored by Git and can contain test data/passwords. Do not upload them.

You do not need to learn the local adapter to deploy the hosted app. The deployment guide uses the provider dashboards; the standard build is `npm run build` and output is `dist`. A website URL is never a Netlify base directory.

Release ownership: student tech lead + DevOps lead. Read [STAGING-AND-PRODUCTION.md](STAGING-AND-PRODUCTION.md), [DOMAIN-LAUNCH.md](DOMAIN-LAUNCH.md), and [MAINTENANCE-HANDOVER.md](MAINTENANCE-HANDOVER.md).

Every production build runs `scripts/build-preflight.mjs`, Astro full rebuild, then `scripts/verify-build.mjs`. The last step inspects emitted HTML/assets and disabled POST form fallbacks without executing browser scripts. Clear the Netlify build cache and retry if an old artifact is detected; do not bypass a failed verification to publish.

Startup order: `scripts/start.mjs` opens the API and awaits `scripts/wait-for-api.mjs` before starting Astro. Both backend entrypoints send `api-ready` only after listening; the classroom API initializes PostgreSQL/migrations first. Unit and real child-process tests cover the handshake.

Verification uses at most two concurrent Vitest workers (`vitest.config.ts`), retaining file isolation and ordinary test deadlines. The installed-dependency audit reads manifests asynchronously in batches of eight and has a targeted 30-second deadline. The real child-process startup test has a 90-second readiness budget inside a 120-second test; it asks the OS for a free loopback port. Normal `npm run dev` still requires port 8787 for the frontend proxy. A stalled or crashed backend still fails; the frontend never starts just because time elapsed.

The GitHub Actions matrix runs install, source secret check, dependency audit, type checks, tests, build and Chromium acceptance on both Ubuntu and Windows. Defining that workflow is not evidence that either remote job has already passed: review the team's actual Actions results. See `../SECURITY-UPGRADE-1.6.0.md`, `SECURITY-OPERATIONS.md` and `../docs/VERIFICATION.md`.
