# Apply the 1.6.2 service-image browser assertion patch

Your latest Windows log passed **238 tests in 48 files**, types and the build. Native Chromium passed **23 scenarios**, failed one service-image assertion, and did not run seven later scenarios. The earlier heading and live-check fixture fixes are now exercised successfully up to the next assertion; the whole hosted-workflow browser file passed.

## Cause and correction

The homepage intentionally retains all five service panels/images in the DOM. This reserves layout space and avoids a twitch when changing services. Inactive panels have `aria-hidden=true` and `inert`; one panel has `data-active=true`.

The test still selected every `.vss-explorer-image` and expected one image. Playwright correctly reported five matches. The updated assertion checks:

- Data Entry's control is pressed.
- Exactly one panel is active and it belongs to Data Entry.
- That panel is accessible/visible.
- That selected panel has one image with the expected data-entry source.

No `.first()`, forced click, skipped scenario or longer timeout hides the failure. Production source, visual design, database migrations, security rules and dependencies are unchanged. The seven blocked scenarios and remaining explorer locators were reviewed against the retained-panel DOM contract; native execution is still required.

## Apply and get fast feedback

1. Keep the development server stopped. Extract the new ZIP and copy its `vss-website` **contents into your existing project folder**. Preserve your Git history, `.env`, `.local`, installed dependencies and unrelated student edits; review the diff if your team has made other changes.
2. In the existing VS Code project terminal, confirm the version and run the previously failing scenario first:

```powershell
node -p "require('./package.json').version"
npm run test:browser -- --grep "redesigned navigation"
```

The version must be **1.6.2**. This targeted command runs one scenario and gives fast feedback about the correction.

3. If it passes, run the complete browser suite:

```powershell
npm run test:browser
```

Require **31 passed** before hosted rollout. Seven scenarios were unrun in the supplied log; do not count them as passing. Retain the first complete error and trace if any failure remains.

Your existing 1.6.1 dependencies are the same versions, so they can be reused in the existing project. If opening a fresh extracted folder instead, run `npm ci` first. Chromium is already installed on the workstation that produced the attached log. `npm run verify` remains the full type/Node/database/build check when preparing a commit/release.

## Data and hosted setup

There is no additional migration for 1.6.0/1.6.1 → 1.6.2. Preserve the existing local database/accounts. Never rerun `INSTALL-FRESH.sql` on an existing hosted database for a browser-test patch.

For a hosted project still on 1.5.x, the actual security activation still follows `SECURITY-UPGRADE-1.6.0.md`: its additive identity/session migration, explicit production policy, provider CAPTCHA, owner MFA and client-owned settings. This source patch does not change hosted accounts or data. See `docs/VERIFICATION.md` for current evidence and remaining acceptance.
