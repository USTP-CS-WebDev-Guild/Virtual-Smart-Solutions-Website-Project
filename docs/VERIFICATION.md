# Verification — VSS Website 1.5.0

The supplied VSS 1.4.2 ZIP was the input. Changes were made in an isolated source folder. No GitHub push, deployment, account change, secret change, or remote database mutation was performed for this release. The hosted site remains on its current version until the team pushes and Netlify publishes this update.

| Check | Actual result |
| --- | --- |
| Dependency install | `npm ci` passed. No package dependency versions were upgraded. |
| Full verification | `npm run verify` passed: **172 tests in 37 files**, type checking, and production build. |
| Astro / TypeScript | 159 files checked; 0 errors, 0 warnings, 0 hints. TypeScript passed. Rechecked after readable source formatting. |
| New workflow regressions | 16 added tests: PostgreSQL stored-record search and DOM interactions for navigation, role restrictions, note drafts, conversion cancellation, publishing conflicts, and session cleanup. |
| Actual database tests | Real embedded PostgreSQL, existing migrations, feature routes, authorization, cursor pagination, literal search punctuation, case-insensitive search, and status filtering. Existing transactional inquiry/client/privacy and permission suites still pass. |
| Supabase query compatibility | Read-only probes against the staging project's public signal row confirmed quoted `imatch` filters, literal punctuation, and AND behavior for repeated OR filters. No business records, private keys, or database changes were used. |
| Emitted HTML | 8 routes, 90 local asset references, hidden signed-out workspace, secure POST form fallbacks, no public test banner. Search forms have no named fields; the native confirmation form never submits a network request. |
| Owner stylesheet isolation | Emitted owner CSS resolves charcoal sidebar (#17181b), dark body text (#191b20), white panels/controls, and readable button/headline colors. The owner route imports no public global stylesheet. |
| Responsive stylesheet rules | Fresh DOM windows at 320, 390, 768, 1440px selected the expected mobile/desktop menu rules. Phone search controls computed to 16px at 320/390px. These are stylesheet checks, not painted-layout measurements. |
| Existing public footer contrast | 266 emitted-CSS checks; minimum 13.58:1. |
| Dependency audit | `npm audit --json`: 0 reported vulnerabilities at verification time. |
| Dependency lock integrity | Transitive dependency records match the input archive; application version fields are 1.5.0. |
| Database compatibility | All four migrations and INSTALL-FRESH.sql are unchanged. No migration or reset is needed from 1.4.2. |
| Browser acceptance definitions | `playwright test --list` discovered 30 tests in two files, including the updated phone drawer / draft-preservation scenario. Test discovery is not browser execution. |
| Native browser / physical-phone painting | Not executed here. The managed preview environment has no supported browser-control capability. Browser tests are included for the team's workstation and existing CI. No claim of zero visual bugs or verified frame timing is made. |
| Native Windows / remote CI | Not executed in this Linux environment. The existing Windows/Ubuntu workflow remains available; this is not evidence of a passing remote job. |
| Hosted owner login / real mail / DNS / backup restore | Not re-exercised for this source update. Complete the staging walkthrough and release checklist before handoff. Capture-mode mail remains captured. |

## Useful regression coverage

- New searches find records beyond the first page, combine cursor and status correctly, and reject oversized/control-character queries. Search input cannot supply arbitrary columns or expressions. PostgreSQL parameters protect the classroom query path.
- Privacy searches remain owner-only, and anonymous inquiries still require staff authentication.
- Unsaved inquiry notes survive switching records and background refresh. User text is inserted as text, and conversion can be cancelled before an API mutation.
- Website copy is grouped by page; an older load cannot replace a newer draft. Publishing disables controls, and responses after sign-out cannot refill private editor fields.
- Owner-only screens are unavailable to staff. Signing out clears inquiry, client, privacy, overview, and every content-catalog area.
- Existing tests still cover Auth/RLS, CSRF, body limits, public inquiry idempotency, exactly-once conversion, separate privacy completion, package snapshots, live metadata, outbox retry/capture, fresh installation, and recovery scripts.

## Team acceptance before client handoff

Read UPDATE-1.5.0.md and OWNER-GUIDE.md. Run `npm run verify`. Run `npx playwright install chromium` once, stop development servers, then `npm run test:browser`. Review the UI on a real phone and desktop, including keyboard focus, long names/messages, empty views, slow/offline requests, reduced motion, publication conflicts, and sign-out.

After the new Netlify deploy is Published, run `npm run verify:deployment -- https://vss-guild-batch1-staging.netlify.app`. The release marker must be 1.5.0. Test contact → open owner inbox → note/status → confirmed conversion → client; separately test privacy handling and owner publication into an already-open public page. Run Settings & help diagnostics. Preserve the existing hosting variables and database.
