# Verification — VSS Website 1.4.2

Input: the supplied `VSS-Website-1.4.1(1).zip` and the Windows failure log. Input SHA-256: `bed7b26509945a1a554bcb096f6f032f9676d326a31cb4123e450c568936418f`. Work performed locally on Linux, Node 24.19.0. No GitHub push, remote CI execution, provider account change, deployment or remote SQL was performed.

The supplied Windows run passed 151 of 153 tests. Its dependency inspection hit the default five-second test timeout and its actual backend startup test hit a 25-second readiness deadline. There was no reported version/range mismatch or failed SQL assertion. Since `verify` chains commands with `&&`, the build in that run was not reached. The log establishes deadline failures; it cannot prove the workstation's exact CPU, disk or antivirus bottleneck.

| Check | Actual result |
| --- | --- |
| Dependency installation | `npm ci` passed after the application version fields were finalized at 1.4.2; 320 packages installed on Linux |
| Focused regression run | The dependency-lock check, startup unit tests and real child-process startup check passed: **8 tests in 3 files**, 5.03 seconds |
| Full verification | `npm run verify` passed: **156 tests in 35 files**, type checks and production build; tests took 17.12 seconds |
| Astro diagnostics | 148 files; 0 errors, 0 warnings, 0 hints |
| Constrained CPU regression | Restricted the Node/Vitest process and its children to one available CPU. Configuration selected one worker. The same 8 focused checks passed in 8.99 seconds, including actual PostgreSQL and HTTP startup |
| Startup assertions | Real child initializes a fresh temporary database, announces a valid ephemeral loopback port, returns ready/public-content HTTP responses and exits cleanly after IPC shutdown |
| Readiness error coverage | No frontend launch before readiness; slow startup beyond the old deadline; wrong/invalid ports; stall deadline and listener cleanup; already-exited child all checked |
| Manifest audit | Installed package versions and dependency ranges are still compared with the final lockfile. Files are read asynchronously in batches of eight; missing ordinary packages fail and omitted optional platform packages remain supported |
| Worker configuration | `maxWorkers = min(2, availableParallelism())`, isolation retained. No test skips, retries or global timeout disabling added |
| Production output | 8 routes, 96 local asset references present; hidden signed-out owner workspace and fail-closed POST form fallbacks passed |
| First-paint public contract | Seven closed/inert menus with selected-page state and both font preloads; pre-rendered service regions and work filters passed |
| Footer contrast | 266 emitted-CSS text checks; minimum **13.58:1**, above 4.5:1 |
| Dependency audit | `npm audit --json`: 0 reported vulnerabilities at verification time |
| Dependency integrity | All **458 transitive lockfile records** match the supplied archive; only application version metadata changed |
| Frontend / backend feature source | Every file under `frontend/` and `backend/` is byte-for-byte identical to the supplied 1.4.1 archive. Its design, forms, APIs, Auth/RLS and live workflows are retained |
| Database | All four migrations and `INSTALL-FRESH.sql` unchanged; no database migration or reset needed |
| Windows CI | Added a Windows/Ubuntu matrix for install, types, tests and build. Browser checks remain on Ubuntu. **The remote Windows job has not run here** |
| Native Windows execution | **Not available here.** Your Windows rerun or the actual Windows Actions job must confirm that platform |
| Browser / phone painting | Not executed for this infrastructure patch. Existing browser scenarios and frontend sources are retained; source/DOM checks do not prove frame pacing or physical-phone layout |
| Hosted Auth / mail / DNS / restore | Not exercised against the team's providers in this patch |

## What changed and what still fails correctly

The test pool now runs at most two files concurrently so real embedded PostgreSQL initializations do not compete with every other suite. The installed-manifest audit avoids synchronous existence checks plus reads for hundreds of files and has a targeted 30-second deadline. Ordinary unit-test deadlines remain unchanged.

The normal API startup handshake has a 90-second upper bound. It proceeds as soon as initialization and HTTP listen complete; it never waits for the full allowance after readiness. The integration test uses a free loopback port inside a 120-second test deadline, bounded health requests and bounded process shutdown. Regular development still requires port 8787 to match the frontend proxy. Wrong ports, crashed/stalled processes, invalid package metadata and actual security/database failures still stop verification.

Vitest may report 35 isolated workers spawned over a full run. That is a total count, not concurrent execution. File isolation remains enabled to keep mocks and environment changes from leaking between tests. CI now includes Windows, but a workflow definition is not a passing Windows result.

## Apply and confirm

Read [UPDATE-1.4.2.md](../UPDATE-1.4.2.md). Stop development, merge the source into the existing project, and preserve `.git`, `.env` and `.local`. The existing `node_modules` can remain because dependency records are unchanged. A fresh folder needs `npm ci` once.

```powershell
npm run verify
npm run dev
```

Wait for all three verification stages to finish. If it fails, retain the new failing test/error and captured test-backend stderr; do not reset databases, disable assertions or force dependency upgrades. The new CI Windows job provides another platform check after the team pushes the reviewed source.

The existing frontend acceptance and client handoff checks remain: real phone/desktop review, public normal-link access, contact receipt → open owner inbox → status/note → client conversion, separate privacy queue, owner publication, reduced motion, approved business/privacy copy, mail configuration and a tested recovery. Use the team's existing staging/production and domain guides.
