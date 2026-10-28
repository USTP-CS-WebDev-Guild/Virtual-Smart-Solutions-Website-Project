# Apply the 1.6.4 navigation-test correction

Your supplied Windows run passes all **238 tests in 48 files**, Astro/TypeScript, the build and its emitted-output checks. The targeted browser run fails at the old document's animation-frame sampler and skips six later scenarios. The 1.6.3 browser approach did not work on your Chromium; this update replaces that mechanism.

## What changed

The acceptance check installs a read-only observer before clicking the real mobile link. It records actual menu/page state after the application's click handlers and at native `beforeunload`, and sends those records to the test runner. The actual destination document request still passes through a gate. The gate is released before waiting for lifecycle records or inspecting them. There is no JavaScript evaluation, animation-frame wait or locator query against the stalled page, and no assumption about when Chromium dispatches `beforeunload` relative to its network request.

The menu must still be visible/non-inert, expanded and geometrically stable; native link handling must not be canceled. The request is always released in `finally`, after which the destination URL, hidden destination menu, selected link and Escape/focus checks run normally. The observer does not alter production DOM or event handling.

Two DOM regressions validate the observer's serialization/lifecycle behavior and prove that an intentionally early closure is reported as a failure. Their test-only geometry values are not claimed as native layout evidence.

Classroom scenarios use **default ordered mode** with one worker. Each scenario creates the records it needs and can run on a fresh database. If one fails, Playwright restarts the worker/runtime and attempts later scenarios. This retains the failure instead of skipping the rest of a serial group. All 31 native browser scenarios remain enabled; no timeout was increased and no forced click was added.

## Apply once, then run the complete browser suite

1. Stop development. Copy the ZIP's `vss-website` contents into your existing project, preserving `.git`, `.env`, `.local`, installed dependencies and unrelated student changes. Review the diff if students have edited the same files.
2. In that project's VS Code terminal:

```powershell
node -p "require('./package.json').version"
npm run test:browser
```

The version must be **1.6.4**. Require **31 passed** before hosted rollout. The full run now attempts the remaining classroom checks even if one fails; retain the complete output and first error/trace if anything fails.

Dependencies are unchanged from 1.6.3. An existing installed folder needs no repeat `npm ci`; a fresh folder still needs installation. Chromium is already installed on the workstation that produced your log. The full Node/type/build gate is still `npm run verify`; this package's executed results are recorded in `docs/VERIFICATION.md`.

Optional shorter selection (seven scenarios, also without serial skipping):

```powershell
npm run test:browser -- --grep "compact mobile navigation|service choices|monochrome mobile drawer|hostile stored inquiry"
```

## Preserve data and hosted controls

This patch adds no database migration. Preserve existing records/accounts and do not rerun `INSTALL-FRESH.sql` on an existing hosted database.

A hosted 1.5.x project still requires the actual security activation in `SECURITY-UPGRADE-1.6.0.md`: its additive identity/session migration, provider CAPTCHA, owner MFA and explicit production policy. No hosted setting/account change is made by extracting this source update.
