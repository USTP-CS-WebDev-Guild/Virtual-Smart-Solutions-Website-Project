# VSS 1.6.9 — Display the authenticator enrollment QR

## Why setup stopped after a successful request

After PR #15 deployed as staging commit `ba845cd`, the owner reached the MFA gate. The browser showed HTTP 200 for user lookup, pending-factor cleanup and enrollment, but the setup area stayed hidden and the Verify button stayed disabled.

The frontend rejected any SVG data URI longer than 150,000 characters. Supabase's Auth server uses goqrsvg, which writes one rectangle per QR module, including white modules. A normal 57x57 synthetic image in that wire format is about 248,000 characters before compression. Sending that response through the real Supabase JavaScript client reproduced the same closed setup screen against 1.6.8.

The guard now permits up to 1,000,000 characters and still accepts only SVG image data URIs. The existing untrusted-URL test and a new excessive-size test keep the screen closed for rejected images. This changes the display-size bound, not the MFA authorization decision: a valid authenticator code must still be accepted by Supabase and the API before the private workspace opens.

The user's real enrollment response/secret was not inspected. The reproduced image-size bug matches the screenshot; actual hosted QR display, enrollment and subsequent sign-in remain acceptance steps.

## Apply from the published staging branch

Save `vss-mfa-qr-1.6.9.patch` beside `package.json`. These commands preserve the previous feature branch and create a new branch from the merged 1.6.8 release. Stop and inspect any error rather than resetting local work.

```powershell
git fetch origin
git switch --no-track -c fix/mfa-qr-1.6.9 origin/staging
git apply --check .\vss-mfa-qr-1.6.9.patch
git apply .\vss-mfa-qr-1.6.9.patch
npm run verify
npm run test:browser -- --reporter=line
```

Dependency versions are unchanged. An existing 1.6.8 installation does not need another install; a clean checkout uses `npm ci`.

After the checks pass:

```powershell
git add -- frontend/scripts/owner/mfa.ts tests/frontend/mfa-flow.test.ts package.json package-lock.json shared/release.ts CHANGELOG.md UPDATE-1.6.9.md docs/VERIFICATION.md SOURCE-CHECKSUMS.sha256
npm run security:check
npm run security:audit
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
git commit -m "Allow provider-sized MFA enrollment QR images"
git push -u origin fix/mfa-qr-1.6.9
```

Open a new PR with base **staging** and compare **fix/mfa-qr-1.6.9**. Require Ubuntu and Windows checks before merging. Keep client-production promotion separate.

## Hosted acceptance

Keep `enforceMfa:true`, TOTP Enabled and the working Turnstile configuration. No SQL update, factor reset, new key or hosting variable is needed for this display fix.

1. Wait for the new staging deployment to be Published and confirm release 1.6.9.
2. Sign out of the old MFA screen, close all Incognito windows, open a fresh one and sign in again. The workspace must remain closed before authenticator verification.
3. The QR and manual setup key should now appear. Scan the QR privately in the owner's authenticator app, enter its six-digit code and select Verify and continue. Never post the QR, setup key, codes, passwords or bearer tokens in chat/screenshots/logs.
4. Confirm that the workspace opens and private live updates connect. If an error remains, report only the visible error text or a sanitized diagnostic; do not share the successful enrollment response.
5. Sign out and sign in again. The existing factor should request its current code without enrolling again. An incorrect code must not open the workspace. Repeat with the separate test staff account and retain role restrictions.

See UPDATE-1.6.8.md for the remaining server/session/recovery acceptance. Provider enrollment and private data remain subject to those controls.

## Primary implementation sources

- https://github.com/supabase/auth/blob/master/internal/api/mfa.go
- https://github.com/aaronarduino/goqrsvg/blob/master/goqrsvg.go
- https://supabase.com/docs/reference/javascript/auth-mfa-enroll
