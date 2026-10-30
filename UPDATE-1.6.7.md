# VSS 1.6.7 — Responsive Turnstile layout

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
