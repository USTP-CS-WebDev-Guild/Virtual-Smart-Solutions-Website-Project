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
