# 1.6.6 — Turnstile asynchronous loader correction — 2026-10-30

- Render after the provider script's load event, or reuse its already-loaded API. Remove the `ready()` call that Cloudflare rejects for async/defer scripts (error 3857).
- Replace the misleading connection instruction with a neutral retry message. Verification remains required and server-side token, hostname/action and session checks are retained.
- Add two readiness regressions and make the Chromium provider fixture enforce the real asynchronous-script restriction.
- See UPDATE-1.6.6.md. No database migration or dependency-version change.

# 1.6.4 — Native navigation lifecycle observations — 2026-10-27

## 1.6.5

- Replaced hCaptcha with Cloudflare Turnstile across public forms, staff login, server verification, build guards, browser policy and operating guides.
- Bound accepted public tokens to the configured hostname and form action, rejected production testing keys and partial configuration, and retained bounded provider requests.
- Added CAPTCHA lifecycle, PostgreSQL rejection/commit and Chromium provider-boundary regressions. Classroom mode and existing database/session/MFA protections are preserved.
- See UPDATE-1.6.5.md for the coordinated Netlify variables and Supabase Auth provider change. No database migration or new npm dependency.

- Replaced the failed in-flight animation-frame sampler. The browser check now installs a read-only observer before the real link click and records state after application click handlers and during native `beforeunload`. The real destination request still passes through a gate, but that gate is released before waiting for lifecycle records or inspecting them. No page evaluation, animation-frame wait or locator assertion runs against the stalled document.
- Retained real navigation, held-request verification, visible/non-inert menu and expanded state, stable geometry, request release in `finally`, destination/selected-link checks and Escape focus. No forced click, skipped scenario or longer timeout.
- Classroom scenarios now use default ordered mode with one worker. They each create their own records and also run on fresh data; after a failure Playwright can restart the runtime and attempt the other scenarios instead of skipping them as a serial group.
- Added two DOM regressions for the test observer: closure-free serialization and ordinary navigation/departure recording; detection of an intentionally injected early-close failure. Native layout/Chromium execution remains a separate gate.
- Production frontend/backend, five database migrations and all dependency versions are unchanged from 1.6.3. No hosted accounts, database or deployment was modified.
- Input Windows evidence: all 238 tests/types/build passed; the targeted browser run failed at the in-flight sampler and skipped six later scenarios. See docs/VERIFICATION.md for this package's actual checks and pending native acceptance.

# 1.6.3 — In-flight mobile navigation browser check — 2026-10-27

- Removed the browser test's circular wait: it held the destination document request while using locator assertions that waited for that navigation to finish.
- The test still performs a real, actionable link click. It confirms the destination request is held, samples the current document across three paint frames, checks the visible/non-inert menu, expanded state and stable menu/page geometry, and releases the request in `finally` before checking the destination, selected link and Escape focus.
- Retained all 31 scenarios without forced clicks, skipped cases or increased timeouts. Reviewed the six blocked scenarios against current service-panel, workspace and safe-text rendering behavior.
- No production backend/frontend, database migration or dependency changes from 1.6.2. Prior acceptance fixes remain included.
- Supplied Windows evidence: 238 Node/DOM/PostgreSQL tests, types/build and the targeted service-image scenario passed; the full browser run passed 24, failed the delayed-navigation assertion and left six unrun. See docs/VERIFICATION.md for the post-patch evidence and pending native acceptance.

# 1.6.2 — Selected service browser assertion — 2026-10-27

- Corrected the navigation/service/FAQ browser scenario to check exactly one active Data Entry panel, its pressed control, accessibility state, visibility and expected image. All five intentional pre-rendered panels remain in the UI.
- Retained every scenario and assertion; no broad first-match selector, forced click, skip or longer timeout was introduced.
- Reviewed the seven blocked classroom scenarios and remaining explorer locators against the pre-rendered DOM contract. Native execution remains required; review is not a passing browser result.
- No production backend/frontend, database migration or dependency changes from 1.6.1. Earlier heading and localhost fixture fixes remain included.
- The supplied Windows log passed all 238 tests/build and 23 native scenarios; one broad image selector failed and seven scenarios did not run. See docs/VERIFICATION.md for current checks and pending acceptance.

# 1.6.1 — Browser acceptance fixture corrections — 2026-10-27

- Scoped the homepage heading animation assertion to the application hero, excluding Astro development-toolbar shadow headings.
- Corrected the synthetic browser server's loopback HTTP context from production to dev; explicitly isolated hosted/classroom/CAPTCHA flags and restored environment values on cleanup.
- Kept production HTTPS/origin, CSRF, authentication, MFA, RLS and business logic unchanged. No new dependencies or database migration.
- Added a real HTTP/PostgreSQL adapter regression covering a valid owner probe, foreign-origin rejection, missing request-marker rejection and anonymous denial. The valid-probe test reproduced the reported 403 before the fix.
- The supplied Windows log passed 234 tests/build and 13 browser scenarios, then reported two failures and 16 unrun scenarios. See docs/VERIFICATION.md for patch checks and pending native acceptance; do not count unrun tests as passing.

# 1.6.0 — Production security hardening — 2026-10-27

- Bound approved staff to verified immutable Auth UUIDs; added production TOTP enrollment/challenge and active-session, absolute-lifetime and idle-expiry checks in both API and private-signal RLS.
- Added an additive migration, regenerated fresh installer, explicit production arming script and UUID-based owner approval. Existing business records and older migrations are preserved.
- Moved hosted auth tokens to tab storage; private UI clears during MFA/role loss and sign-out. Retained the independent local classroom experience.
- Added hCaptcha to public forms and hosted login, fail-closed production settings, atomic IP/email/daily budgets, stricter origins/path/method/header/query rules and network deadlines/redirect rejection.
- Generated exact-project CSP and private no-store headers; added public-asset/source secret checks and disabled test maintenance URLs in production.
- Patched happy-dom, fast-uri and undici, pinned direct dependencies and official Actions SHAs, added Dependabot/audit gates, production review ruleset and restricted encrypted-backup workflow. Restore excludes old sessions/staff approvals.
- Added real PostgreSQL authentication/session/budget regressions, CAPTCHA/request/MFA/storage/build/crypto tests and a native stored-XSS acceptance scenario. Carried forward phone drawer/static-fixture/browser harness fixes from reported CI failures.
- Added threat model, deployment activation and maintenance/recovery instructions. No live deployment, provider account change or remote database mutation was performed.

# 1.5.0 — Owner workspace redesign

- Replaced inherited public/legacy admin styles with a dedicated charcoal-and-white workspace stylesheet.
- Added Overview, real inquiry counts, latest conversations, task shortcuts, bookmarkable screens, and accessible mobile navigation.
- Added authenticated stored-record search to inquiries, clients, and owner-only privacy requests. Search is bounded, literal, parameterized in the classroom adapter, and compatible with cursor/status filters.
- Added client relationship filters, clearer empty states, direct email actions, inquiry reference copying, and confirmation before conversion.
- Preserved inquiry notes and status drafts between conversations and live updates; protected content drafts against delayed loads, role loss, and sign-out responses.
- Grouped website copy by page, added approved-image selectors, disabled editing during publication, and surfaced unpublished changes.
- Moved diagnostics and notification setup to Settings & help; kept the shared API role/CSRF gates and existing SQL transactions.
- Added explicit confirmation before privacy anonymization, useful API error wording, and private-data clearing across all content sections.
- Updated browser acceptance scenarios and added PostgreSQL search / DOM interaction regressions.
- No dependency upgrades, schema changes, database reset, or hosting/account migration required from 1.4.2.

# Changes

## 1.4.0 — 2026-10-16

- Replaced navy/mint/green/teal presentation with the supplied prototype’s white-header/light-hero, charcoal/white and blue-accent direction across public pages and controls.
- Removed full-document View Transition opt-in/names/listeners, page/header fade-slide layers and render-blocking motion boot. Normal links do not wait for animations.
- Already-visible content renders immediately; later scroll entrances are shorter/smaller and decorative orbit/star motifs are removed. Existing ambient/interactive motion, reduced motion, forms and live owner workflows remain.
- Added explicit palette/navigation regression coverage. Application release fields change without changing the transitive lockfile. No SQL or hosting/account changes.

## 1.3.1 — 2026-10-15

- Corrected the shipped lockfile: the 1.3.0 application-version replacement had changed 23 transitive dependency records, including source-map-js ranges and Rolldown versions.
- Restored the original dependency graph and changed only application release metadata, preserving the 1.3.0 frontend and full-system behavior.
- Validated installation from the final corrected files with a separate empty npm cache; added a regression checking installed manifests against final lockfile versions/ranges. No database migration or account changes.

## 1.3.0 — 2026-10-15

- Rebuilt the public design around navy/mint contrast, larger photography, editorial featured work, alternating service layouts and distinct dark pricing/process sections.
- Replaced overlapping/replayed entrances with one motion system, persistent pause/reduced-motion handling and optional native multi-page transitions.
- Added photographic service previews, animated filter results, measured interruptible FAQ/comparison expansion and a mobile menu that opens without shifting the page.
- Separated public design, interaction surfaces, motion, shared brand and owner workspace CSS; retained beginner role folders and no added dependencies.
- Preserved all database migrations, business APIs, captured-mail behavior, owner permissions and real live updates. No schema/account/hosting change.
- Added focused interaction regressions and a browser scenario; see docs/VERIFICATION.md for executed checks and browser limits.

## 1.2.1 — 2026-10-15

- Fixed the footer regression: explicit navy background, readable text/inverse brand and removal of obsolete position-dependent link colors.
- Removed the public test banner without changing isolated test data, captured mail or noindex settings.
- Added ongoing hero/card movement, a seamless expertise ticker, and team portrait/entrance animation with synchronized pause controls and OS reduced-motion support.
- Pause ongoing motion when its region or browser tab is not visible; retain animation markers after CMS refresh.
- Start Astro only after the backend announces actual readiness; fail clearly if the API stops, times out or uses the wrong port. A real child-process test verifies the first HTTP request after PostgreSQL startup.
- Added an emitted-CSS footer contrast gate and tests for ticker accessibility, motion controls and startup ordering.
- No new database migration, dependency upgrade or hosted account change.

## 1.2.0 — 2026-10-15

### Public experience

- Finite viewport entrances, hero settling, card/focus feedback and menu/FAQ/dialog effects using browser APIs and CSS.
- OS reduced-motion support plus a persistent Motion off control; content never depends on an animation to become readable.
- Published-content service explorer, portfolio filters/detail dialog, FAQ search and package comparison.
- Leadership introductions on the homepage; four-column VSS footer with the requested copy and a real service-health check.
- Readable mobile labels/control sizes, long-text wrapping, localized comparison scrolling and sticky navigation.
- Fixed missing service headings in built HTML, preserved contact drafts and rejected older concurrent content responses.

### API and database

- Streaming request byte limits, stalled-body timeout/cancellation, JSON content types, identifier/token/role bounds and safe exception logging.
- Bounded signed webhook metadata and notification network timeout.
- Additive SQL migration removes unnecessary public RPC definer privileges, restricts schema creation, bounds new records, saturates abuse counters and closes the expired-lease retry ceiling gap.
- Contact, privacy and owner sign-in forms use POST and remain disabled until their secure JavaScript handlers exist; no native GET fallback with personal information/passwords.
- Full production build plus emitted-HTML checks now run for each build.

### Team operation

- Complete student installation/local/hosted setup in README; role folders retained.
- Student tech lead/DevOps ownership, staging/main release process, domain cutover, maintenance, backup/rollback/offboarding guides.
- Existing published content and old applied migrations preserved. Existing hosted installations apply only the new migration; fresh installations use the regenerated bundle.

Validation: 125 Node/DOM/PostgreSQL tests and clean build passed. Twenty-two browser scenarios are included/collected, but real browser/phone execution remains a required release check; see `docs/VERIFICATION.md`. No hosted deployment or account change was performed.
