# VSS 1.6.5 — Cloudflare Turnstile migration

This update replaces hCaptcha in the public forms, staff login and server checks. Keep Astro, Netlify Functions and Supabase Database/Auth/Realtime. No database migration, new npm package, domain transfer or paid CAPTCHA subscription is required.

The patch was prepared against staging commit `05cb0019c278d05f97babc154b0f9be9e19e2d7c`. It preserves both subsequent security migrations already present there: the pinned audit-trigger search path and restricted future-function defaults. Do not run INSTALL-FRESH.sql again on an installed database.

## What changes

- Contact and privacy forms send Turnstile tokens to the existing API. The server uses the widget secret and Cloudflare Siteverify, with a five-second network deadline, redirects rejected and a 2048-character token limit.
- An accepted public token must match the configured APP_ORIGIN hostname and the expected `inquiry` or `privacy_request` action. Missing, failed, expired, replayed or wrong-context tokens cannot save a business record.
- Owner login passes a separate `owner_login` token directly to Supabase Auth through the existing Supabase client. Enable the matching Turnstile provider in that Supabase project. Do not pre-redeem login tokens through the public-form API.
- Compact widgets reserve their space on narrow screens. Token expiry/error/reset cannot leave a stale token accepted by the form controller. A failed submission retains the visitor draft and idempotency key.
- CSP allows the exact Cloudflare script/frame origin. Existing no-store, staff/session, TOTP, role, origin, payload, query, outbox and database protections remain enabled.
- Production builds reject missing/testing/old-provider site keys. Partially configured server verification fails closed. Local classroom mode still starts without cloud keys.
- Privacy text identifies the active verification provider. The business owner must approve the final notice.

## 1. Apply to a feature branch

In the existing Git checkout, leave untracked `supabase/`, ignored `.env`, local data and credentials alone. Fetch the team repository, then create a feature branch from `origin/staging`:

```powershell
git fetch origin
git switch --no-track -c security/turnstile-integration origin/staging
```

Save `vss-turnstile-1.6.5.patch` in this checkout's root. Check it before applying:

```powershell
git apply --check .\vss-turnstile-1.6.5.patch
```

If that prints an error, stop and inspect the changed file; do not force/reset/copy an older ZIP over student work. With a clean check:

```powershell
git apply .\vss-turnstile-1.6.5.patch
npm ci
npm run verify
```

For Chromium acceptance (stop any existing development server first):

```powershell
npx playwright install chromium
npm run test:browser
```

Review the source diff and stage only update files. Keep the downloaded patch and `supabase/` out of the commit. Open a pull request with **base staging**, let project checks finish, and review it before merging. Keep production on its current version until staging acceptance is complete.

## 2. Configure staging with fresh private credentials

Create a dedicated **Managed** Turnstile widget restricted to your staging hostname. Use `vss-guild-batch1-staging.netlify.app` for the current team site; enter only the hostname. Leave pre-clearance off. Store the secret in the team's password manager. A secret shared in a screenshot should be replaced before integration. If rotation is temporarily unavailable, create a fresh widget and retire the unused exposed widget after confirming it has no consumers. Keep new credentials out of screenshots, chats and Git.

In Netlify's **staging project**, replace the old variables:

| Remove | Add | Availability |
|---|---|---|
| PUBLIC_HCAPTCHA_SITE_KEY | PUBLIC_TURNSTILE_SITE_KEY | Builds and Functions |
| HCAPTCHA_SECRET_KEY | TURNSTILE_SECRET_KEY | Functions; mark secret |

If the Free plan offers only All scopes, use that and mark the private key secret. Only variables prefixed PUBLIC_ are intentionally used in the browser; never put the secret in a PUBLIC_ variable. The Functions runtime also needs the public site-key variable to check its configuration. Redeploy after variable changes.

Keep existing staging settings: `APP_ENV=staging`, `PUBLIC_TEST_ENVIRONMENT=true`, `TEST_EMAIL_MODE=capture`, exact staging `APP_ORIGIN`, and **staging** Supabase URLs/keys. Leave PUBLIC_CLASSROOM_MODE unset on Netlify. A site key from another provider cannot substitute for a Turnstile key.

Coordinate the variables with deployment of this release. The build deliberately stops if legacy hCaptcha variables are still present. Create no new subscriptions and enter no payment details for this migration.

## 3. Configure the same provider in staging Supabase Auth

After the compatible staging UI has deployed, open the **staging** Supabase project. In Authentication's Bot and Abuse Protection / CAPTCHA settings, select **Turnstile**, enter that staging widget's secret, enable protection and save. Keep public signups and anonymous sign-in disabled. Keep MFA and staff-role/session restrictions in place.

The provider secret must match the site key embedded by that staging build. Match services by widget credentials, not by the email used to manage Cloudflare, Netlify or Supabase. Keep Auth's Site URL and redirect allowlist restricted to the staging site.

## 4. Verify staging

```powershell
npm run verify:deployment -- https://vss-guild-batch1-staging.netlify.app
```

Require release **1.6.5**. The public smoke check does not complete a real CAPTCHA or authenticated login. Also perform this walkthrough with synthetic data:

1. Open contact/privacy/admin on a phone and an incognito browser. Verification loads and completes without horizontal overflow.
2. Submit one contact inquiry; it reaches the already-open owner inbox once. Save a note and check the existing client conversion workflow.
3. Submit a separate privacy request; it reaches its own queue.
4. Leave a form open past five minutes and submit after verification refreshes. An expired verification must be refreshed; a failed attempt must keep the visitor draft.
5. Attempt a public API POST with a valid form body but no token: expect 403 `verification_required`, with no business row/outbox entry saved. Unauthenticated staff APIs must still return 401.
6. Sign in using the hosted staging owner. Check that Supabase Auth has the Turnstile provider enabled, not just a visible widget. Use the owner's live-delivery test and captured notification job.
7. Review Turnstile analytics for successful token validations. A widget view alone does not prove server-side verification.

Provider test keys are for isolated integration experiments, not production. The application deliberately requires dashboard keys for configured hosted verification. Automated tests use synthetic provider responses; they do not attest to a live provider account, deliver real email or replace a staging walkthrough.

## 5. Promote only after staging passes

Review a staging → main pull request. Create a **separate production widget** restricted to the actual production hostname and configure its separate keys in the production Netlify project and production Supabase Auth. Remove the two old hCaptcha variables there. Keep `APP_ENV=production`, `PUBLIC_TEST_ENVIRONMENT=false`, the production database policy and actual owner TOTP enrollment. Never connect student previews to production credentials.

The initial production Netlify setup can remain pending until the compatible main commit and production settings are ready. Verify the actual assigned site hostname before registering it. Adding the approved client domain later requires hostname allowlists, APP_ORIGIN/PUBLIC_SITE_URL, Auth URLs and redeployment as described in DOMAIN-LAUNCH.md; it does not require rewriting the application.

Confirm the exact reachable interim owner email before launch, including its spelling. Add the client's own owner identity through the documented provisioning process when supplied. Do not share a developer login as the client's permanent account.

For rollback, coordinate the application version, hosting variable names and Supabase CAPTCHA provider; restoring only one of them can break sign-in. Do not reset the database. Keep production launch, real email delivery, backup restoration and client content approval on the existing release checklist.

## Reference documentation checked for this update

- Cloudflare migration: https://developers.cloudflare.com/turnstile/migration/hcaptcha/
- Mandatory token validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Widget lifecycle and sizing: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/
- CSP: https://developers.cloudflare.com/turnstile/reference/content-security-policy/
- Supabase Auth CAPTCHA: https://supabase.com/docs/guides/auth/auth-captcha
- Current Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
