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
