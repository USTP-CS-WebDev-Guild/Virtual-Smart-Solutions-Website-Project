# VSS 1.6.10 — Homepage spacing and authenticator instructions

## Result

The homepage's left inset used `max(48px, (100vw - 1248px) / 2)`. On the native 1920px preview, the heading began about 329px from the left edge. It is now about 76px, with a maximum 88px inset at wider desktop sizes. The homepage header and hero footer align with that edge. Other pages retain their existing content container; phone/tablet breakpoints remain intact.

The 1.6.8/1.6.9 MFA patches did not edit the public styles or header. The reported large inset came from this existing wide-screen rule. This release adjusts that presentation explicitly.

The QR code links one account to an authenticator during setup. Entering a valid code and completing verification saves the factor. Later sign-ins use the code currently shown in that app, without scanning a new QR. The numbers refresh automatically, normally about every 30 seconds; they are not a PIN to memorize. A permanent shared code would weaken the second factor. This release clarifies the setup/returning-user headings, labels and help text while retaining the existing authentication behavior and security policy.

## Apply from published staging

Save `vss-home-spacing-mfa-copy-1.6.10.patch` beside `package.json`. This patch targets staging commit `1eace44`, the merge of PR #16. Preserve unrelated local files; stop and inspect an error rather than resetting or forcing a switch.

```powershell
git fetch origin
git switch --no-track -c fix/home-spacing-mfa-copy-1.6.10 origin/staging
git apply --check .\vss-home-spacing-mfa-copy-1.6.10.patch
git apply .\vss-home-spacing-mfa-copy-1.6.10.patch
npm run verify
npm run test:browser -- --reporter=line
```

The browser suite now contains **38 scenarios**, including the new wide-homepage check. Dependency versions are unchanged; an existing 1.6.9 installation does not need another install. A clean checkout uses `npm ci`.

After verification passes:

```powershell
git add -- frontend/styles/vss.css frontend/components/Header.astro frontend/pages/admin/index.astro frontend/scripts/owner/mfa.ts tests/frontend/mfa-flow.test.ts tests/e2e/classroom.spec.ts package.json package-lock.json shared/release.ts CHANGELOG.md UPDATE-1.6.10.md docs/VERIFICATION.md SOURCE-CHECKSUMS.sha256
npm run security:check
npm run security:audit
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
git commit -m "Tighten homepage spacing and clarify authenticator sign-in"
git push -u origin fix/home-spacing-mfa-copy-1.6.10
```

Open a new PR with base **staging**. Require Ubuntu and Windows checks, merge and wait for its Netlify staging deployment to show Published. Keep client-production promotion separate.

## Hosted acceptance

1. At 1920px/2560px desktop sizes, confirm the homepage heading and logo share a modest left inset. At 320px/390px, check navigation, readable text and no horizontal overflow. Services and other inner pages keep their existing container widths.
2. For an account not yet enrolled, scan the setup QR privately, enter the app's current code and select Verify and continue. Merely scanning the QR does not finish verification.
3. Sign out, then sign in again. The verified account should show Enter your sign-in code, with no new QR setup. Use the current code from its authenticator app. An incorrect code must keep the workspace closed.
4. Confirm private live updates connect and owner/staff access remains separated. Never share QR images, setup secrets, passwords, verification codes or bearer tokens.

Keep `enforceMfa:true`, TOTP Enabled, session limits and the working Turnstile configuration. No SQL update, factor reset, key rotation or hosting-variable change is needed.

## References

- https://supabase.com/docs/guides/auth/auth-mfa/totp
- https://www.rfc-editor.org/rfc/rfc6238

Executed checks and remaining acceptance are recorded in docs/VERIFICATION.md.
