# Verification — VSS 1.6.8 — 2026-10-30

## 1.6.8 database MFA enforcement without build metadata

Input: the user's staging policy returned `enforceMfa:true`, both active owner/staff bindings passed, and TOTP was Enabled, but an Incognito password sign-in still opened the owner inbox with a private Realtime warning. Review found `backend/lib/auth.ts` only queried the policy when the build-only `NETLIFY` flag was true. Netlify's Functions documentation lists only URL/SITE_NAME/SITE_ID as the built-in runtime metadata.

- Reproduced the bypass before correcting application code: seven authentication regressions failed with missing/false metadata or unavailable/malformed policies. After correcting the synthetic record setup to satisfy the existing SQL contract, the real API/PostgreSQL workflow failed **11 of 12** scenarios: password-only access was admitted, revoked sessions remained usable, and private signal RLS stayed closed because no verified session was registered. The intentionally optional policy case already passed.
- The fix reads the real database policy in every non-production runtime, with no hosting-flag bypass. Production enforcement, identity/role checks and unavailable-policy denial remain intact. Classroom and browser adapters use the real policy RPC rather than a permissive fallback.
- `npm run verify` passed: **53 files / 311 tests**, Astro/TypeScript **189 files, zero errors/warnings/hints**, and the static/security build. The result includes real PostgreSQL API tests for the enrollment response, private read/write rejection, a valid MFA session, owner/staff signal visibility and role separation, session revocation, and policy failure. The existing classroom runtime, startup, CAPTCHA, frontend MFA and database/session suites passed too.
- Build checks passed for **8 routes / 101 local asset references**, all **266 footer contrast checks** (minimum **13.58:1**), protected workspace/POST forms and initial UI state. Self-hosted component CSS and the strict style policy from 1.6.7 remain in place.
- `npm run security:audit` passed with **0 vulnerabilities**. Lockfile comparison confirmed the dependency graph is unchanged; only the release version changes.
- All **37 browser scenarios** were discovered. **Discovery is not execution:** the revised full browser suite, Ubuntu/Windows CI, deployed release verification and real hosted authenticator enrollment/challenge remain pending. Local tests mock the provider token-validation boundary, not application authorization or database/RLS behavior. No live credentials, accounts, database configuration or repository deployment were changed by this work.

The user completed the prior 1.6.7 release checks: **292 tests**, **37 browser tests**, both CI jobs, publication of staging commit **2fb531b**, and screenshots of all three correctly displayed real widgets. The later `enforceMfa:true` SQL result proved the database setting, not API enforcement; 1.6.8 closes that separate runtime gap. See UPDATE-1.6.8.md for the patch and hosted acceptance steps. Do not claim hosted MFA is verified until those steps succeed.

## 1.6.7 CSS/CSP correction after the first CI patch

The user applied the first CI patch: **291 tests/types/build passed**, but all three responsive browser cases still failed at 320px with only `insideViewport` and `pageFits` false. The other three Turnstile cases passed. This exposed a real stylesheet delivery problem; the timing correction alone was insufficient.

- Built HTML inspection found the scoped CAPTCHA rules inside inline `<style>` blocks on contact, privacy and sign-in. The generated deployment policy was `style-src 'self'`. Earlier static preview checks did not enforce that policy and therefore did not verify deployed CSS delivery.
- Native reproduction enforced the deployment's style directive through a preview meta policy. Before the build fix, contact resized from desktop back to 320px with a **300px container and flexible widget ending at x=341**, reproducing exactly the two failing flags. The CSS rule that prevents intrinsic-width inflation was blocked.
- Astro now emits all project styles as separate, self-hosted assets. The security policy is unchanged. A new build regression first failed against the previous checker, then passed after the checker rejected blocked inline stylesheet output while accepting an external stylesheet. The actual build emits **zero inline style blocks across all eight routes**.
- `npm run verify`: **52 test files / 292 tests passed**; Astro/TypeScript checked 188 files with 0 errors/warnings/hints. Build/output/security checks passed for 8 routes and **101 local asset references**. Footer contrast remains 266 checks, minimum 13.58:1.
- The corrected build passed the same native geometry sequence with the style policy enforced: contact, privacy and sign-in at **320 → 390 → 768 → 1440 → 320px**. Contact/privacy draft retention passed. No sign-in credentials were entered or submission sent. At the final 320px contact size, its container was **223px**, its compact widget was **150px**, and its right edge was **x=191**.
- This preview uses the actual serialized snapshot observer and a synthetic provider boundary. Only the production style directive is enforced in its meta policy; it is not a substitute for the real HTTP CSP or the full Playwright run. **The user's updated 37-scenario browser suite and Ubuntu/Windows CI remain pending.** No browser assertion is removed, tolerance widened, motion disabled or timeout increased.
- Numeric geometry is now printed on a browser assertion failure because partial-object matcher output omitted those extra diagnostic fields. Tokens, draft contents and credentials are not logged.

Apply `vss-turnstile-csp-css-1.6.7.patch` on top of the first CI patch, as documented at the beginning of `../UPDATE-1.6.7.md`. The application remains release 1.6.7 on the same feature branch; no secret or database changes.

## 1.6.7 CI follow-up — atomic CAPTCHA geometry observation

Targets the user's feature commit `e98951b` in PR #14. This follow-up changes only test instrumentation, regression tests, release notes and source checksums. Frontend/backend application code, dependencies, keys and release number compare unchanged with that feature commit.

- User-supplied CI logs: **34/37 browser scenarios passed on both Ubuntu and Windows**. Failures were confined to the new contact/privacy/sign-in responsive checks, which mixed separately collected rectangles across viewport/reflow/motion updates. The logged failures are retained as evidence; no full CI pass is inferred from local Node/DOM tests.
- The corrected observer is read-only and closure-free. It collects all rectangles, the current viewport/size, verification status and draft in one page task. Playwright polls that whole snapshot with its normal assertion deadline. Initial fonts are awaited. No global timeout increase, disabled motion, weakened geometric tolerance, skipped scenario or new dependency.
- `npm run verify`: **52 test files / 291 tests passed**, including seven observer regressions and the existing 18 CAPTCHA lifecycle cases. Astro/TypeScript checked 188 files with 0 errors/warnings/hints. All eight built routes and the existing output, header, contrast and initial-state checks passed.
- Native browser QA used the supported managed preview, the unchanged built 1.6.7 UI, the same synthetic provider dimensions/removal behavior and the actual serialized snapshot helper. Geometry passed for all three forms through **320 → 390 → 768 → 1440 → 320px**. Contact/privacy drafts were preserved. No sign-in credentials were entered or form submitted in this preview.
- Native negative checks: an intentionally overflowing 500px fixture iframe failed the width/container/viewport checks; an intentionally translated status failed the overlap check. Restoring the ordinary fixture restored passing snapshots. The DOM regressions additionally reject obsolete viewport/size state, duplicate widgets and lost drafts, and run the helper without its module closure.
- **The updated Playwright suite itself and the corrected Ubuntu/Windows CI runs remain pending.** Native preview checks are separate from executing those 37 scenarios. Apply the small follow-up on the same feature branch and rerun its six Turnstile cases plus the full CI suite before merging into staging.

Apply instructions are at the beginning of `../UPDATE-1.6.7.md`.

## 1.6.7 responsive Turnstile layout

Prepared against published staging commit `7b0e718`, the merge of PR #13. No hosted account, key, database, GitHub branch or deployment was changed by this work.

- `npm run verify`: **51 test files / 284 tests passed**; Astro/TypeScript 186 files, 0 errors/warnings/hints; all eight routes and the built output/header/contrast checks passed.
- CAPTCHA lifecycle coverage: **18 cases passed**, including the 299/300px boundary, replacement only across the size boundary, draft retention, rejection of stale callbacks/tokens, hidden/detached forms and provider replacement failure.
- Native browser QA used the supported managed preview and the real Cloudflare script with its official always-pass public test site key. Contact, privacy and sign-in were checked at **320, 390, 768 and 1440px**, then returned to 320px. Each settled layout completed verification and had no horizontal document overflow. A filled privacy draft survived resizing. Actual inner container widths determine the mode; padding and scrollbars can leave a 390px page with less than 300px for its widget.
- Native QA exposed and corrected a minimum-content sizing problem: an already horizontal widget could otherwise stretch the 320px contact form and prevent compact selection. Inline size containment fixes that feedback. The narrow and wide layouts were visually inspected with the provider's full branding visible.
- The Playwright provider fixture now models flexible/compact dimensions and removal. Three new responsive cases exercise all three forms across four widths and back to phone size; the existing contact receipt, privacy retry and Supabase login-token cases remain. **Browser-suite execution on Ubuntu/Windows CI and live 1.6.7 staging acceptance remain pending.** Local preview checks do not count as executing that suite or validating the user's real provider keys.
- No new npm dependency, CSP relaxation, backend change or database migration. The committed application has no synthetic-key fallback. The isolated preview and its testing banner are excluded from the patch.
- Source credential check passed for **308 tracked files**; staged whitespace check passed. All **six Turnstile browser scenarios** were discovered; discovery is not execution.

Apply and hosted acceptance instructions: `../UPDATE-1.6.7.md`. Earlier verification records follow.

# Verification — VSS 1.6.6 — 2026-10-30

## 1.6.6 asynchronous Turnstile loader correction

Prepared against the user's published staging commit `3511d63`, after PR #12. No hosted account, secret, database or deployment was changed by this local verification.

- Confirmed in the actual Cloudflare api.js fetched on 2026-10-30 that `ready()` rejects scripts loaded with async/defer (error 3857). The previous loader combined both mechanisms and caught the failure as a connection error.
- Two new readiness regressions failed against 1.6.5 before the fix and passed afterward. The existing token expiry/reset, loading deadline and retry checks remain active: **12 CAPTCHA lifecycle cases passed**.
- `npm run verify`: **51 test files / 278 tests passed**; Astro/TypeScript 186 files, 0 errors/warnings/hints; all eight routes and the emitted-output/header/contrast/UI checks passed.
- Targeted Chromium integration: **3 / 3 passed**, covering contact submission under the generated CSP at 320px, privacy retry/draft/idempotency behavior and the real Supabase client forwarding the owner login token. The fixture now enforces Cloudflare's actual async/defer `ready()` restriction.
- A separate Chromium before/after diagnostic ran the downloaded, unmodified Cloudflare api.js with the official public testing site key. Version 1.6.5 reproduced the same connection message, provider warning and no widget. The correction created a widget container without that warning. Challenge iframe transport was isolated, so this proves provider-script initialization rather than live challenge issuance.
- Browser execution used Chromium Headless Shell **141.0.7390.37** via the repository's existing `TEST_CHROMIUM` setting; project Playwright remains pinned at 1.62.1. The default Chromium download was unavailable in this environment. Normal Ubuntu/Windows CI and a live staging phone/incognito acceptance remain required.
- `npm audit`: **0 reported vulnerabilities**. Dependency versions, SQL migrations/installers, server authentication, required token verification and CSP permissions are unchanged. Only application release metadata advances to 1.6.6.

The complete browser suite was not rerun locally for this focused correction. No live hosted owner login, real email delivery, external penetration test or guarantee of complete security is claimed. Complete UPDATE-1.6.6.md before production promotion.


## 1.6.5 Turnstile migration — checked 2026-10-29

Prepared against staging commit 05cb0019c278d05f97babc154b0f9be9e19e2d7c. No hosted account/database setting, GitHub branch or deployment was changed by this local verification.

- `npm run verify`: Astro/TypeScript 0 errors, 0 warnings, 0 hints; **51 test files / 276 tests passed**; all 8 public/admin routes built; asset, footer contrast and initial UI state checks passed.
- A separate synthetic production-profile build passed with all three Turnstile actions (`inquiry`, `privacy_request`, `owner_login`), exact provider script/frame CSP, no hCaptcha domains and no verification secret in public assets.
- `npm run test:browser`: **34 / 34 passed** using Chromium Headless Shell **141.0.7390.37**, selected through the existing TEST_CHROMIUM option. This includes the prior navigation/drawer/320–1440px checks and three new Turnstile provider-boundary cases (contact token submission under generated CSP, privacy retry preserving its draft/receipt key, and the real Supabase client forwarding the owner login token).
- The project's pinned Playwright 1.62.1 and application dependencies are unchanged. Its default Chromium download returned an unavailable HTML response in this environment, so local browser acceptance used the explicitly identified alternate executable. Run the repository's normal checks on Ubuntu and Windows CI before merging.
- Database migrations/installers and the existing audit search-path/default-privilege fixes are unchanged. The new PostgreSQL workflow tests reject invalid/missing/wrong-context verification before saving business records.

Cloudflare issuance and Supabase Auth transport are simulated in automated tests. A real staging widget/provider setup and phone/incognito walkthrough are still required by UPDATE-1.6.5.md. This is not a live-provider attestation, external penetration test or guarantee of complete security.

Input: attached `VSS-Website-Security-1.6.3(1).zip` and the user's complete Windows 1.6.3 output pasted in this conversation. This is a local acceptance-test update. No repository push, deployment, remote account/database mutation or secret rotation was performed.

## Supplied Windows evidence

- 1.6.3 installation: 0 reported vulnerabilities. Astro: 180 files, 0 errors/warnings/hints; TypeScript passed.
- All **238 Node/DOM/PostgreSQL tests in 48 files** passed, followed by the build and emitted-output checks.
- The seven-scenario selection failed one case at `page.evaluate` waiting for animation frames during a held navigation; six subsequent cases were skipped. No native pass for that patch is claimed.
- Prior complete 1.6.2 evidence was 24 native passes, one delayed-navigation failure and six unrun cases. All ten synthetic hosted-workflow scenarios passed in that supplied Windows log; they are not real provider acceptance.

## Correction and preserved contracts

A pre-installed observer records actual state after application click handlers and at native `beforeunload`. The real document request passes through a gate, which is released before the test waits for or asserts the captured Node-side data. There are no page queries, animation-frame waits or lifecycle-record waits in the held interval; no beforeunload/network ordering is assumed. Menu visibility, inert/expanded state, native default handling and geometry assertions remain; `finally` releases navigation before destination, selected-link and Escape/focus checks.

Classroom cases now use default ordered mode with one worker and restartable fresh runtime setup after failures. They create the data they require and can run independently. A failed case no longer skips the later classroom cases as a serial group. All 31 scenarios remain enabled; no forced click or longer timeout.

Production backend/frontend, all five migrations and dependency records compare unchanged against the input. The accepted design and production origin/CSRF/MFA/session/role/RLS/data controls are retained.

## Package checks

| Check | Executed result |
| --- | --- |
| Clean installation | `npm ci` passed with final release metadata; dependency versions/ranges unchanged. |
| Focused regressions | All seven tests passed: five existing navigation regressions and two observer regressions covering serialization, native default handling/lifecycle recording, and deliberately early closure detection. |
| Full verification | `npm run verify` passed: **240 tests in 49 files**, Astro/TypeScript, build and emitted-output checks. |
| Types | 182 Astro/analyzed source files; 0 errors/warnings/hints. TypeScript passed. |
| Dependency audit | `npm run security:audit`: **0 reported vulnerabilities** at verification time. |
| Source scan | `npm run security:check` passed for 298 source files. This supplements provider scanning/review. |
| Built output | 8 routes, 90 local asset references, protected signed-out workspace, fail-closed forms and generated headers. Footer: 266 checks, minimum contrast 13.58:1; no public technical test banner. |
| Browser discovery | All **31 scenarios** discovered. No scenario removed or marked skipped; the classroom file uses default ordered mode with one configured worker. Discovery is not execution. |
| Production preservation | All 128 backend/frontend source files, all five SQL migrations and all dependency records compare byte-identical to the supplied 1.6.3 release. |
| Archive | All source paths preserved; regenerated source checksums and ZIP CRC validated. Secrets, Git history, local records, dependencies, builds and reports are excluded. |

DOM test geometry is synthetic and is not native layout evidence. The observer serialization test executes the self-contained function without its import closure. No native browser pass is inferred from it.

Native Chromium execution for 1.6.4 remains unverified in this managed environment. Supported preview infrastructure was unavailable in previous attempts; no infrastructure repair or browser bypass was performed. Run all 31 scenarios on the user's workstation/CI and retain the actual results. Listing tests or reviewing code is not browser execution.

## Hosted acceptance

The synthetic hosted browser harness uses real embedded PostgreSQL with a mocked Supabase network transport. Its passes do not prove real provider MFA/CAPTCHA configuration, live Advisors, real mail delivery, domain cutover or remote backup restoration. Complete `../SECURITY-UPGRADE-1.6.0.md` and `../devops/RELEASE_CHECKLIST.md` before client production handoff.

No migration is added for an already migrated 1.6.x project. Preserve local/hosted records and accounts; do not rerun the fresh installer. Apply instructions: `../UPDATE-1.6.4.md`. Security model: `SECURITY-THREAT-MODEL-1.6.0.md`. Maintenance: `../devops/SECURITY-OPERATIONS.md`.
