# VSS 1.4.2 — Windows verification timeout correction

Your `npm ci` succeeded. The reported run passed 151 of 153 tests but stopped at two deadlines: the dependency-manifest scan exceeded five seconds, and the child-process database/API startup exceeded 25 seconds. Because `verify` uses `&&`, its production build did not run after those failures. The log does not report a dependency version mismatch or failed database assertion.

## Apply this update

1. Stop `npm run dev` with **Ctrl+C** in any open development terminal.
2. Keep a private backup of the existing project. Preserve `.git`, `.env`, and `.local` — these hold history, configuration and local records/accounts.
3. Extract this ZIP elsewhere. Merge the **contents** of its `vss-website` directory into the existing project root, replacing the source files. Do not create a nested `vss-website/vss-website` directory. The archive does not include your private/runtime files.
4. Open the existing project root in VS Code and run:

```powershell
npm run verify
```

Your existing dependency installation can stay: the dependency versions and ranges are unchanged. If you opened a fresh folder without `node_modules`, run `npm ci` once before verification.

After verification completes successfully:

```powershell
npm run dev
```

Open **http://127.0.0.1:4321/**. Local records and credentials remain when `.local` is preserved. Use `npm run accounts` to display them. No database reset, new provider account, secret, schema migration or dependency upgrade is needed.

## What changed

| Failure/risk | Correction |
| --- | --- |
| Several database suites starting under an uncapped test worker pool | At most two simultaneous Vitest workers; file isolation remains enabled |
| Hundreds of synchronous package-file reads under a five-second default deadline | Asynchronous reads in batches of eight, one read instead of an existence check plus a read, and a targeted 30-second deadline |
| Dependency metadata integrity | All installed version/range assertions remain. Missing optional platform packages may be omitted; a missing ordinary package is an error |
| 25-second cold PostgreSQL startup test | Shared 90-second readiness budget and a 120-second integration-test deadline, with bounded health requests and shutdown |
| Test colliding with the workstation development port | Integration test requests a free loopback port; regular development still requires 8787 |
| Backend exits before the wait listener is installed | Fail immediately using its exit status rather than waiting for the deadline |
| Future Windows regressions | CI matrix for Ubuntu and Windows; browser suite remains in the Ubuntu job |

The test runner may still print a total such as “35 workers spawned.” Those are isolated workers created over the run; no more than two test files run together with this configuration. Ordinary test deadlines, database checks, role/security checks and actual readiness assertions remain. No blanket timeout disable, skipped tests or automatic retries are introduced.

The new 90-second startup allowance does not force a 90-second wait. Startup proceeds immediately when the backend confirms it has finished initialization and is listening. A crashed, invalid-port or stalled backend still fails and never opens the frontend.

The black/white/charcoal/blue design, navigation fixes and live content behavior from 1.4.1 are retained. All four SQL migrations and the fresh installer are unchanged. Do not rerun the fresh installer or reset local records to apply this patch.

## Verification and deployment

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for commands actually executed. The patch was checked on Linux; native Windows execution must be confirmed by your run or the new Windows Actions job. Adding a workflow does not mean its remote jobs have run.

Push the reviewed source through the existing team repository/PR process. Netlify deployment and Supabase configuration remain the same. No hosting change is required to verify the source locally. The npm install-script warnings in the supplied log were not a reported installation failure; do not force dependency upgrades to address these two test timeouts.

If a new run fails, keep the failing test name and error. A genuine version mismatch, migration, authorization or HTTP failure must still stop verification.
