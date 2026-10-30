# VSS 1.6.7 — Responsive Turnstile layout

## CSS/CSP follow-up after the first CI patch

The first test correction preserved the real layout checks and exposed a second problem: all three forms still overflowed after resizing from desktop back to 320px. Astro's default automatic CSS inlining put the small CAPTCHA and brand styles in HTML `<style>` blocks. The deployment's existing `style-src 'self'` policy blocked those blocks, including CAPTCHA inline-size containment. An already flexible 300px-minimum widget could then stretch its parent and prevent the resize observer from choosing compact mode.

The fix sets Astro's `build.inlineStylesheets` to `never`, emitting the same component rules as self-hosted CSS files permitted by the current policy. A security-build regression rejects inline stylesheet blocks. The provider settings, security policy, application verification logic, dependency versions and release number stay unchanged. Failed browser checks now also print their last numeric layout snapshot without tokens or draft contents.

**Already applied `vss-turnstile-layout-ci-1.6.7.patch`? Keep those changes.** Save the additional `vss-turnstile-csp-css-1.6.7.patch` beside `package.json` and apply it on top, on the same feature branch:

```powershell
git apply --check .\vss-turnstile-csp-css-1.6.7.patch
git apply .\vss-turnstile-csp-css-1.6.7.patch
npm run verify
npm run test:browser -- --reporter=line
```

The final command runs all 37 browser scenarios. If the pinned Playwright browser is missing, run `npx playwright install chromium` and repeat it. Preserve local changes if the patch check fails; do not reset or reapply the earlier patch.

Once those checks pass, stage the combined follow-up changes with the explicit list below:

```powershell
git add -- astro.config.mjs devops/scripts/security-build.mjs tests/devops/security-build.test.ts tests/e2e/captcha-layout.ts tests/e2e/turnstile.spec.ts tests/frontend/captcha-layout.test.ts CHANGELOG.md UPDATE-1.6.7.md docs/VERIFICATION.md SOURCE-CHECKSUMS.sha256
npm run security:check
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
git commit -m "Keep Turnstile styles compatible with the deployment CSP"
git push
```

This updates PR #14, whose base must be **staging**. Require successful Ubuntu and Windows checks before merging and testing the staging deployment. There is no database migration or key change.

## CI follow-up for the existing feature branch

The first PR #14 CI run passed 34 of 37 browser scenarios on Ubuntu and Windows. Only the three new responsive CAPTCHA scenarios failed. They collected container, iframe, status and button rectangles with separate asynchronous calls while the viewport, resize observer, font layout or entrance motion could still change between those calls.

`vss-turnstile-layout-ci-1.6.7.patch` targets feature commit `e98951b` and applies on the existing `fix/turnstile-layout-1.6.7` branch. It collects a single synchronous DOM snapshot and uses Playwright's normal bounded assertion polling until the requested viewport, current container-derived size, verification status and geometry agree. The layout cases also wait for the initially loaded fonts. Overflow, overlap, widget count/dimensions, retained drafts and no-page-overflow checks remain active; motion is not disabled, tolerances are not widened and no scenario is skipped. The application, keys and release number stay unchanged by this follow-up.

Save the follow-up patch beside `package.json`, then use the same Windows Git checkout:

```powershell
git switch fix/turnstile-layout-1.6.7
git apply --check .\vss-turnstile-layout-ci-1.6.7.patch
git apply .\vss-turnstile-layout-ci-1.6.7.patch
npm run verify
npm run test:browser -- tests/e2e/turnstile.spec.ts --reporter=line
```

If the local Playwright browser is missing, run `npx playwright install chromium` once and rerun the browser command. This installs the browser for the pinned test runner; it does not change npm dependency versions.

After validation, stage only the follow-up files:

```powershell
git add -- tests/e2e/captcha-layout.ts tests/e2e/turnstile.spec.ts tests/frontend/captcha-layout.test.ts CHANGELOG.md UPDATE-1.6.7.md docs/VERIFICATION.md SOURCE-CHECKSUMS.sha256
npm run security:check
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
git commit -m "Measure CAPTCHA resize geometry in one browser snapshot"
git push
```

This updates the existing PR #14. Set its base to **staging** and require both Ubuntu and Windows checks, including the complete 37-scenario browser suite, before merging. The branch was originally opened against main; correcting the base is separate from correcting the browser tests. No force push, replacement feature branch or new PR is required.

## What changes

The sign-in, contact and privacy forms forced Turnstile's compact 150 × 140px layout even when ample space was available. The widget was complete, but its tall, narrow appearance looked cropped beside the wide form fields.

The shared component now uses Cloudflare's flexible horizontal layout when the actual CAPTCHA container is at least 300 CSS pixels wide. Narrower containers retain the complete compact widget. Inline size containment prevents an existing horizontal widget from stretching its parent and concealing the need to switch to compact mode. The provider's iframe, branding and links are not scaled or clipped.

A resize observer replaces the widget only when the available width crosses that boundary. The old verification is invalidated and callbacks from removed widgets are ignored; visitor input remains intact. Hidden login forms do not start new challenges. The 1.6.6 asynchronous loader fix and all server verification rules remain in place.

No database migration, key rotation, Supabase setting change, new dependency or paid service is needed. Keep the working replacement widget and its matching Netlify/Supabase keys.

## Apply in the Windows Git checkout

This incremental patch targets staging commit `7b0e718`, the merge of PR #13, version 1.6.6. Save `vss-turnstile-layout-1.6.7.patch` beside `package.json` in the existing Git checkout. Preserve local changes. If a branch switch or patch check fails, inspect the error instead of resetting or forcing it.

```powershell
Set-Location "C:\Users\im\Desktop\Client_website\vss-website\vss-guild-repo"
git fetch origin
git switch --no-track -c fix/turnstile-layout-1.6.7 origin/staging
git apply --check .\vss-turnstile-layout-1.6.7.patch
git apply .\vss-turnstile-layout-1.6.7.patch
npm run verify
```

The dependency versions are unchanged. If dependencies are missing, run `npm ci` first.

Stage only these source files, keeping downloaded patches, `.env`, local records and `supabase/` CLI files out of Git:

```powershell
git add -- frontend/components/Captcha.astro frontend/lib/captcha.ts tests/frontend/captcha.test.ts tests/e2e/turnstile.spec.ts package.json package-lock.json shared/release.ts CHANGELOG.md UPDATE-1.6.7.md docs/VERIFICATION.md SOURCE-CHECKSUMS.sha256
npm run security:check
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
```

After reviewing that diff:

```powershell
git commit -m "Make Turnstile layout responsive to form width"
git push -u origin fix/turnstile-layout-1.6.7
```

Open a PR with base **staging**. Require the Ubuntu and Windows checks, including the browser suite, and review before merging. Netlify's staging project publishes that staging merge automatically. Its published branch uses the Netlify **Production** deployment context even though this is the staging website. No environment-variable edit is required for this patch.

## Verify the staging deployment

1. Confirm Netlify published the new staging merge, then run `npm run verify:deployment -- https://vss-guild-batch1-staging.netlify.app`. Require release 1.6.7.
2. Check `/admin/`, `/contact/` and `/privacy/` on phone and desktop. Expect a horizontal widget with at least 300px available inside the form, and the compact widget below that. The threshold concerns the form's inner width, not the browser's overall width.
3. Complete verification, type a synthetic draft, and resize/orient the page. Crossing the size boundary starts a fresh check without clearing the draft. Ordinary resizing within the same layout does not reset verification.
4. Confirm the complete widget, status and submit button remain visible without horizontal scrolling. Use fresh verification for an owner sign-in and a synthetic staging inquiry/privacy submission to confirm the hosted paths still work.

Keep production promotion and retirement of the original staging widget separate from this layout change. Delete the original widget only after confirming that the replacement remains in use and the staging checks pass.

## Verification scope

See `docs/VERIFICATION.md` for actual local results and remaining hosted/CI checks. Local browser QA uses Cloudflare's official public test site key in an isolated preview, never the user's private keys or production data. Its test-only banner does not appear with the user's real staging key. The committed application contains no testing-key default.

References:

- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
