# VSS 1.6.8 — Honor database MFA in the Functions runtime

## Why the QR setup did not appear

The staging database reported `enforceMfa: true`, but a password-only owner still entered the workspace and private Realtime reported a setup problem. The API read the database policy only when `process.env.NETLIFY === 'true'`. Netlify documents `NETLIFY` and `CONTEXT` as build metadata, not automatically supplied Functions runtime variables. Without that flag, the API skipped both mandatory MFA and active-session registration; private-signal RLS continued enforcing the armed database policy.

This patch reads the database policy in every non-production runtime. Explicit production mode continues requiring MFA and verified live sessions. The server now returns the existing enrollment/challenge response before exposing business records, and a valid MFA login registers the session needed for private Realtime access. Policy lookup errors or malformed values close private access. The classroom adapter calls the same real PostgreSQL policy function; its isolated database keeps the default optional policy.

The SQL setting alone did not prove API enforcement. This release requires actual password-only rejection and successful authenticator enrollment/challenge after deployment.

## Apply on the existing repository

The patch targets staging commit `2fb531b`, the merge of PR #14. Save `vss-mfa-policy-1.6.8.patch` beside `package.json`. Preserve unrelated local work; stop and inspect an error rather than resetting or forcing a branch switch.

```powershell
git fetch origin
git switch --no-track -c security/mfa-policy-1.6.8 origin/staging
git apply --check .\vss-mfa-policy-1.6.8.patch
git apply .\vss-mfa-policy-1.6.8.patch
npm run verify
npm run test:browser -- --reporter=line
```

Dependency versions remain unchanged, so an already installed 1.6.7 checkout does not need an additional install. A clean checkout uses `npm ci`. Keep the complete browser suite and Ubuntu/Windows CI; no scenario is removed, skipped or given a longer timeout.

## Review and push

After local verification passes:

```powershell
git add -- backend/lib/auth.ts backend/API.md devops/local/postgres.ts tests/helpers/postgres.ts tests/backend/auth.test.ts tests/backend/production-auth.test.ts tests/backend/route-guards.test.ts tests/backend/mfa-workflow.test.ts package.json package-lock.json shared/release.ts CHANGELOG.md UPDATE-1.6.8.md docs/VERIFICATION.md SOURCE-CHECKSUMS.sha256
npm run security:check
npm run security:audit
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
git commit -m "Honor database MFA policy without Netlify build metadata"
git push -u origin security/mfa-policy-1.6.8
```

Open a new PR with base **staging**. Require the Ubuntu and Windows checks before merging. Netlify's staging site publishes that merge automatically. Keep client-production promotion separate.

## Hosted MFA acceptance

No new migration, installer, key rotation or hosting-variable workaround is required. Keep `APP_ENV=staging`, the replacement Turnstile widget and matching provider keys. Do not try to create a `NETLIFY=true` runtime variable; the code must honor the database policy without it.

The user has already confirmed both active staging accounts are linked to matching verified Auth users, TOTP is Enabled, and the policy is armed. Keep that policy enabled. A fresh database installation must follow the existing account-binding, TOTP and activation prerequisites before an operator arms it. Client production uses the activation and recovery runbooks in SECURITY-UPGRADE-1.6.0.md and devops/SECURITY-OPERATIONS.md.

After the reviewed deployment is Published:

1. Run `npm run verify:deployment -- https://vss-guild-batch1-staging.netlify.app` and require release **1.6.8**. The anonymous verifier does not prove MFA.
2. In a fresh Incognito window, sign in with the approved owner and complete Turnstile. Before authenticator verification, the workspace must remain closed and `/api/auth/session` must report `authenticated:false`, `eligible:true`, `mfaRequired:true`. Private APIs must reject the password-only session with 403 `mfa_required`.
3. Scan the first-enrollment QR privately using the owner's authenticator app, enter its code and verify that the workspace opens. Never post the QR, manual enrollment secret, authenticator codes, bearer tokens or passwords in screenshots/logs/chat.
4. Confirm private Realtime connects. The patch fixes the missing session registration caused by the skipped policy; unrelated provider/publication problems still need their own investigation.
5. Sign out and sign in again. The existing factor should request its current six-digit code without creating a new enrollment. Do not give private access to an incorrect code.
6. Repeat enrollment/sign-in with the separate test staff account. Inquiries/clients remain available to that role; privacy and publishing tools remain owner-only. Test approved session revocation/offboarding using the runbook, without disabling MFA as a shortcut.
7. Record the deployed commit and actual results. The database policy also enforces the existing eight-hour absolute lifetime and fifteen-minute idle limit. Protect authenticator recovery material and use the documented verified-operator recovery process.

## Verification and sources

See docs/VERIFICATION.md for executed checks and pending hosted acceptance. The regression workflow uses real PostgreSQL, migrations, API routes and RLS with a synthetic provider token-validation boundary. It is not a claim of real hosted authenticator enrollment or a penetration test.

- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/build/configure-builds/environment-variables/
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/guides/auth/auth-mfa/totp
