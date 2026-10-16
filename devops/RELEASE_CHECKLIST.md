# Release acceptance

PM records the reviewed commit and results in `project-management/templates/release-record.md`.

- [ ] `npm ci` on a clean copy; `npm run verify`; relevant browser tests pass.
- [ ] No credentials, local data, dependencies, generated builds, or real records in Git.
- [ ] Public link opens on phone/incognito without a hosting login; app login still protects staff.
- [ ] Own isolated test database; reviewed migrations applied; Auth and active staff roles checked.
- [ ] Inquiry save/reference, note/status, repeat-safe conversion, client status, separate privacy handling work.
- [ ] Service/package prefill and immutable inquiry package context; catalog drafts hidden and client-case approvals enforced.
- [ ] Real two-tab content/inbox events; recovery and role isolation checked. Hosted owner Verify live delivery passes.
- [ ] Captured mail in tests; verified sender/webhook and outbox failure/retry handling if sending in production.
- [ ] Signed-out private DOM cleared; anonymous/forbidden API checks; logs contain no PII/secrets.
- [ ] Keyboard, labels, errors, contrast, 320/390/768/1440px tested.
- [ ] Client's identity, email, genuine proof, privacy notice/retention/handling approved before real collection.
- [ ] Hosted encrypted export and restore drill into separate staging, including staff Auth recreation and deletion replay.
- [ ] Provider quotas, inactivity behavior, monitoring, maintenance owner, and rollback plan understood.

This review release contains VSS client material and draft privacy text; use synthetic records until the business approves the launch. A real business release needs the client's decisions and hosted verification.

- [ ] New hardening migration applied only once; server-role workflow and existing record preservation checked.
- [ ] Service explorer, work filters/details, FAQ search, comparison and live edits tested; Escape/focus restoration verified in a real browser.
- [ ] OS reduced motion and saved Pause animations preference work; content readable without animation.
- [ ] Domain/HTTPS/origins/Auth URLs/sitemap checked; email DNS preserved; client owns renewal.
- [ ] Student tech lead + DevOps deputy completed release, rollback and restore drills without instructor credentials.

- [ ] Footer contrast build gate passes; public test banner absent; hero/ticker/team motion verified in a real browser and paused by both controls.
- [ ] npm run dev waits for actual API readiness; no first-load proxy refusal on the target workstation.

## Frontend 1.3 release acceptance

- [ ] Review the navy/mint design and full public flow on a real phone and desktop, including hover, focus, 200% zoom and long live CMS text.
- [ ] Check normal links and Back/Forward; mobile menu/Escape; service preview; portfolio filters/detail overlay; rapid FAQ/comparison clicks; pause/reload; OS reduced motion.
- [ ] Run the included browser tests; automated DOM/style checks are not visual approval.
- [ ] Confirm no extra migration is applied for 1.2.0/1.2.1 → 1.3.0. Preserve local configuration/data.

## Dependency packaging gate

- [ ] Change application version metadata explicitly; never replace version strings globally in the lockfile.
- [ ] Run `npm ci` from the final release files after the last lockfile edit, then run `npm run verify`. For a dependency incident, use a separate empty npm cache and the public registry.
- [ ] Keep `tests/devops/dependency-lock.test.ts` enabled: installed manifests must match final lockfile versions and dependency ranges.
- [ ] Package only the verified final source and preserve all environment secrets/local records outside the archive.

## 1.4 public presentation

- [ ] Confirm white header/light hero, charcoal/white surfaces and blue accents, with no green/mint/teal theme.
- [ ] Inspect actual page switching and Back/Forward on desktop/phone; no full-document fade/slide or delayed initial heading.
- [ ] Inspect later scroll/ambient motion, menu, filters, FAQs, focus and reduced motion on real devices; automated contracts do not prove frame pacing.
