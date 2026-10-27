# Apply the 1.6.3 in-flight navigation browser-test fix

Your latest Windows run passed **238 tests in 48 files**, types/build, and the targeted navigation/service/FAQ scenario. Its full browser run passed **24 scenarios**, failed one delayed-navigation check, and did not run six later classroom scenarios. All ten hosted-workflow browser scenarios passed.

## Why that check failed

The test deliberately holds the real `/portfolio/` document request to inspect the mobile menu before the next page arrives. Playwright locator assertions perform navigation pre-checks. Calling `expect(menu).toBeVisible()` at that point waits for navigation to finish, while the test releases navigation only after that assertion: a circular wait.

The correction keeps the real link and real click. It confirms the document request is held, inspects the current document directly over three paint frames, checks menu visibility/inert state, expanded state and stable menu/page geometry, then always releases the request. Normal locator assertions resume after the destination arrives. Closing the menu too soon or shifting the page still fails the test.

The earlier heading/service-image/localhost fixture fixes remain included. All 31 scenarios remain enabled. There is no forced click, arbitrary sleep, longer timeout or production navigation change. The six blocked scenarios were reviewed; that review is not a native pass.

## Apply to your existing project

1. Keep the development server stopped. Extract the ZIP and copy its `vss-website` contents into the existing project folder. Preserve `.git`, `.env`, `.local`, installed dependencies and unrelated student edits. Review the diff if students have changed these same files.
2. In that project's VS Code terminal, confirm the version:

```powershell
node -p "require('./package.json').version"
```

It must print **1.6.3**. Dependencies are unchanged from 1.6.2, so an existing installed project does not need another `npm ci`. A fresh extracted folder still needs `npm ci`.

3. Run the corrected scenario and the six previously blocked scenarios together:

```powershell
npm run test:browser -- --grep "compact mobile navigation|service choices|monochrome mobile drawer|hostile stored inquiry"
```

This selects **seven** scenarios. It preserves their assertions and gives feedback on all of the remaining classroom coverage.

4. Then run the complete browser suite:

```powershell
npm run test:browser
```

Require **31 passed** before hosted rollout. Keep the first complete error and its trace if something still fails. The type/Node/database/build release gate remains `npm run verify`; your supplied 1.6.2 run already passed it, and this package's verification evidence is recorded in `docs/VERIFICATION.md`.

## Data and hosted setup

This patch adds no database migration. Preserve existing records/accounts and never rerun `INSTALL-FRESH.sql` on an existing hosted project for a browser-test patch.

A hosted project still on 1.5.x still needs the security activation in `SECURITY-UPGRADE-1.6.0.md`, including its additive identity/session migration, provider CAPTCHA, owner MFA and explicit production policy. This source patch does not modify hosted accounts, settings or data.
