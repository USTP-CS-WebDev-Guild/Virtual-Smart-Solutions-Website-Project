# Tests by role

| Folder       | Command                  | Purpose                                                                           |
| ------------ | ------------------------ | --------------------------------------------------------------------------------- |
| `frontend/`  | `npm run test:frontend`  | Content contract, receipts, login errors, live updates/reconnect, motion and DOM interactions                  |
| `backend/`   | `npm run test:backend`   | Routes, permission gates, validation, outbox, real inquiry workflow               |
| `database/`  | `npm run test:database`  | Actual migrations, transactions, grants, RLS, privacy cleanup                     |
| `devops/`    | `npm run test:devops`    | Safe setup, backup schema+data, public deployment gate                            |
| `classroom/` | `npm run test:classroom` | Real persistent runtime, login, role/RLS boundaries, HTTP, push delivery, restart |
| `e2e/`       | `npm run test:browser`   | Real rendered app/API/SQL in Chromium; isolated provider transport                |

`npm run verify` runs type checks, unit/integration tests, and a production build. No cloud credentials, Docker, or installed database server are needed. PGlite runs the actual PostgreSQL migration chain locally.

## Browser checks

One-time browser installation:

```powershell
npm ci
npx playwright install chromium
npm run test:browser
```

There are two browser suites. `classroom.spec.ts` uses real local password login, persistent PostgreSQL and native SSE, for the core application flows; a navigation regression deliberately delays one document request. It checks all eight routes (including owner sign-in) and owner views at 320/390/768/1440px.

`project.spec.ts` builds the production pages, starts the actual API with an embedded database on loopback, and uses the real Supabase client with simulated Auth/PostgREST/WebSocket transport. It applies RLS to metadata reads/events using the authenticated fixture identity. Synthetic test users and keys live only in the test harness. It never connects to the client's project or sends real email.

Tests cover phone submission into an already-open inbox, live notes and draft preservation, conversion/client persistence, live public publishing, reconnect catch-up, privacy deletion, signed-out visibility, and all owner views at 320/390/768/1440px. The Ubuntu CI job installs Chromium and runs browser checks. A separate Windows matrix job runs installation, types, unit/integration tests and the production build. Generated builds, screenshots, and traces are ignored by Git.

These scenarios verify application behavior and browser layout. They do not certify hosted Supabase replication, Netlify visibility/settings, actual password setup, outbound mail, real-device Safari, or a hosted backup restore. Verify the deployed account separately:

```powershell
npm run verify:deployment -- https://your-site.netlify.app
```

Then use the owner **Verify live delivery** button and [full walkthrough](../devops/TEST-THE-SYSTEM.md). An optional `--write-test` flag creates one real synthetic inquiry on marked test sites only. No private key is needed for this public deployment verifier.

`happy-dom` tests exercise DOM events/state without rendering pixels. Every production build also inspects emitted HTML/assets and secure no-JavaScript form fallbacks. Actual execution evidence and remaining browser checks are recorded in `../docs/VERIFICATION.md`.

## Workstation resource limits

The default test configuration runs at most two files concurrently, with isolation retained. Several suites open real PostgreSQL instances; starting too many processes together can cause disk/CPU contention on Windows laptops. The dependency audit performs bounded asynchronous reads and retains its version/range assertions. Its deadline is 30 seconds; ordinary unit tests keep Vitest's normal deadline. The startup integration uses a free loopback port and a 90-second cold-start deadline, then checks real HTTP/database readiness and shuts the child down.

The summary may still report 35 isolated workers spawned over the whole run. That total is not the number running simultaneously. No tests are skipped and no automatic retry hides failures. Stop development before full verification to reduce contention. Browser tests still need ports 4321 and 8787 free.

If a check fails, use the error and captured test-backend stderr. Do not delete `.local`, reinstall the database, run `npm audit fix --force`, or disable a security check to fix a timeout. A different assertion failure needs investigation as a real failure.
