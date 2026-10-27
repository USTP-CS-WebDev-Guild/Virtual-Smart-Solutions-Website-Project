# Apply the 1.6.1 browser-test patch

Your supplied Windows log passed all 234 Node/DOM/PostgreSQL tests, type checks and the build. The manual checks also showed anonymous/fake-token denial, foreign-origin rejection, literal submitted HTML and the restricted staff menu. Browser acceptance reported **13 passed, 2 failed and 16 not run**. Unrun scenarios are still pending.

## What this patch fixes

1. The classroom navigation/motion test used a global `h1` locator. Playwright also sees headings inside Astro's development toolbar shadow DOM, so the locator matched five elements. It now selects the actual application hero inside `#main` and requires exactly one heading. The motion assertion remains enabled.
2. The synthetic hosted-browser adapter served localhost **HTTP** while setting `CONTEXT=production`. The strengthened origin helper correctly rejected that combination, including a legitimate owner live-check request. The test adapter now uses its intended local development origin context; its fake provider settings are isolated and restored on cleanup.

Production HTTPS, allowed origins, CSRF markers, MFA, session checks, database permissions and business routes are unchanged. There is no new database migration and no dependency upgrade. No test is skipped, force-clicked or given a longer timeout to hide these failures.

The new HTTP/PostgreSQL regression uses the same adapter and verifies: legitimate owner probe → 200; foreign-origin mutation → 403; missing dashboard marker → 403; anonymous inquiry read → 401. It also checks environment cleanup. It skips the frontend build only for this API-only regression; the browser suite still builds and uses the actual UI.

## Apply it to your existing project

1. Stop `npm run dev` with **Ctrl+C**. Keep browser tests stopped too.
2. Extract the new ZIP. Copy the **contents** of its `vss-website` folder into your existing `C:\Users\im\Desktop\Client_website\vss-website` folder. Preserve your existing Git history, `.env`, `.local` and unrelated student work; review differences if the team has made other edits. Do not delete the whole current project folder.
3. Open that same project folder in VS Code. From its terminal, run individually:

```powershell
node -p "require('./package.json').version"
npm ci
npm run verify
npm run test:browser
```

The version must be **1.6.1**. If Chromium is not installed, run `npx playwright install chromium` before `test:browser`.

Run the **whole browser suite**, since the serial failure prevented sixteen later scenarios from executing. The target is all 31 scenarios passing. If it fails, retain the first complete error and trace; a passing `verify` alone does not replace native browser acceptance. The original local accounts and saved business records remain separate from the synthetic test database.

Core patch files are `tests/e2e/classroom.spec.ts`, `tests/e2e/server.ts` and the new `tests/devops/browser-fixture.test.ts`. The complete archive also updates release metadata, checksums and guides. It contains no account credentials, local records, dependencies or generated builds.

## Hosted rollout

This patch does not change any provider or live database. For 1.5.x → current security release, continue to follow `SECURITY-UPGRADE-1.6.0.md` and apply its 1.6.0 additive migration once. For an already migrated 1.6.0 database, do **not** rerun that migration or `INSTALL-FRESH.sql` for this patch. Hosted MFA/CAPTCHA, provider access controls and real backup restore still require their documented acceptance checks.

See `docs/VERIFICATION.md` for what was executed here and which native checks still need the team's Windows/CI run.
