# VSS 1.6.6 — Fix Turnstile widget initialization

## Problem and correction

Version 1.6.5 loaded Cloudflare's script with `async` and `defer`, then called `turnstile.ready()`. The actual Cloudflare script rejects that combination with error 3857. Our catch handler incorrectly suggested that the visitor's connection was at fault. This happens before the form submits to Supabase, so entering a server secret cannot fix that browser initialization error.

The loader now renders after the script's native load event. If the provider API is already present, it reuses that API. The initialization deadline, duplicate-widget guard, expired-token checks, retry handling and required verification remain enabled. Security policy is unchanged: no wildcard, inline script or eval permission is added.

No database migration, account reset, new dependency or paid service is needed. Dependency versions stay pinned, including Vite 6.4.5. The app release is 1.6.6.

## Apply in the existing Git checkout

This incremental patch targets staging commit `3511d63` after PR #12. It is not the earlier complete 1.6.5 patch.

Save `vss-turnstile-loader-1.6.6.patch` beside `package.json`. Preserve local student changes; if a branch switch or patch check fails, inspect the error instead of forcing a reset.

```powershell
git fetch origin
git switch --no-track -c fix/turnstile-loader-1.6.6 origin/staging
git apply --check .\vss-turnstile-loader-1.6.6.patch
git apply .\vss-turnstile-loader-1.6.6.patch
npm ci
npm run verify
```

Stage these source files only, keeping downloaded patches, `supabase/`, `.env`, local data and credentials out of the commit:

```powershell
git add -- frontend/lib/captcha.ts tests/frontend/captcha.test.ts tests/e2e/turnstile.spec.ts package.json package-lock.json shared/release.ts CHANGELOG.md UPDATE-1.6.6.md docs/VERIFICATION.md SOURCE-CHECKSUMS.sha256
npm run security:check
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
```

Review, commit and push the feature branch. Open a PR with **base staging**, require the project checks and review, then merge for the staging deployment. Keep production promotion pending live staging acceptance.

## Provider configuration and exposed secrets

The widget site key is public. The widget secret belongs only in Netlify's `TURNSTILE_SECRET_KEY` and that staging Supabase project's Auth CAPTCHA setting.

A secret shown in a chat or screenshot must be replaced. Update both consumers to the same replacement secret. Cloudflare restricts repeated rotations during its grace period; if rotation is temporarily unavailable, create a fresh **Managed staging widget** restricted to `vss-guild-batch1-staging.netlify.app`, with pre-clearance off. Use its public site key in Netlify's `PUBLIC_TURNSTILE_SITE_KEY`, and its secret in Netlify and Supabase Auth. Save secrets privately, redeploy after Netlify variable changes, and test before removing the old widget. Keep new secret values out of screenshots, Git and chat.

Changing the widget secret does not change the application loader. Installing this code correction is still required.

## Live staging acceptance

1. Verify that Netlify published the corrected staging commit, then run `npm run verify:deployment -- https://vss-guild-batch1-staging.netlify.app`. Require release 1.6.6.
2. In a new incognito window, open `/admin/`. The widget must appear without the ready()/3857 exception. Complete the challenge and sign in with the hosted staging owner.
3. Keep that owner's inbox open. Submit one synthetic contact inquiry from a phone, then confirm exactly one receipt and one live inbox record.
4. Submit a separate synthetic privacy request and confirm its separate queue.
5. Confirm that anonymous staff APIs still return 401 and a valid public-form body without a verification token is rejected without saving a record.

Automated provider responses exercise integration behavior; they do not prove live challenge issuance or the correctness of account keys. Keep the phone/incognito walkthrough and existing release checklist before production promotion.

## Provider references

- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/reference/content-security-policy/
- https://developers.cloudflare.com/turnstile/troubleshooting/rotate-secret-key/
- https://supabase.com/docs/guides/auth/auth-captcha
