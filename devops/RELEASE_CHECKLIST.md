# Release acceptance — current patch 1.6.4

PM records the reviewed commit, named approver and actual results in `project-management/templates/release-record.md`. An unchecked item is not proved by the existence of a test file or configuration template.

## Source and automation

- [ ] Clean `npm ci` using the final lockfile; `npm run security:check`, `npm run security:audit` and `npm run verify` pass.
- [ ] `npm run test:browser` passes all scenarios, including the stored hostile-message scenario, without skipped/forced-action substitutes. Both Windows and Linux CI jobs pass on the intended commit.
- [ ] No credentials, local accounts/records, dumps/backups, dependencies or generated output are committed. Public source/assets have client permission.
- [ ] Dependency and migration diffs reviewed. Earlier applied migrations remain unchanged; fresh installer matches canonical migrations.
- [ ] CODEOWNER is an actual reviewer with Write access; main ruleset/review/check requirements are activated on GitHub. Deployment and provider administrators use individual accounts with MFA.

## Environment and security

- [ ] Staging and production use separate Supabase projects/secrets. Untrusted preview builds cannot receive production credentials. Classroom mode is absent on hosting.
- [ ] Existing database receives only the new additive migration. Verified owner/staff UUID bindings reviewed; no active unbound member.
- [ ] Client production has run `SECURE-PRODUCTION.sql`; `APP_ENV=production`, `PUBLIC_TEST_ENVIRONMENT=false`, exact HTTPS origin, matching project keys and a fresh rate-limit secret of at least 32 characters.
- [ ] Real hCaptcha hostname/site key/secret configured; same provider enabled in Supabase Auth; missing/invalid verification rejected on public forms and login. Public signup and anonymous sign-in disabled.
- [ ] Owner enrolls/verifies authenticator. Password-only access receives no business records; staff cannot publish/edit privacy data. Disablement and session revocation stop an already-open session. Expired sessions require a new sign-in.
- [ ] Built CSP allows exactly the intended Supabase project and active verification provider; no script unsafe-inline/eval or Supabase wildcard. Owner/API responses are no-store; no private data/tokens appear in logs.
- [ ] Supabase security/database Advisors and provider patch/attack-protection settings reviewed on the intended project; findings tracked privately. Previously exposed secrets rotated at their providers.

## Business and browser walkthrough

- [ ] Public pages open normally on phone/incognito without a hosting login. Owner sign-in is discoverable in the footer.
- [ ] Contact → reference → already-open owner inbox → note/status → confirmed repeat-safe conversion → one client.
- [ ] Separate privacy request arrives only in its owner-only queue; identity handling/anonymization and deletion ledger follow approved procedures.
- [ ] Owner publishes into an already-open public page; reconnection reconciles missed updates; unsaved drafts/conflict prompts and sign-out cleanup work.
- [ ] Package/service links preserve intent; server price snapshot is authoritative; unpublished or unapproved client claims stay hidden.
- [ ] Keyboard/focus, validation/errors, long content, 200% zoom, 320/390/768/1440px, reduced motion and pause controls checked in actual browsers. Approved monochrome public/workspace design retained.
- [ ] Client approves business identity, contacts, fees, photo permissions, genuine case studies, footer promises, privacy/provider disclosure and retention before real collection.

## Delivery, domain and recovery

- [ ] `npm run verify:deployment -- https://APPROVED-ORIGIN` passes with release 1.6.4. Real hosted MFA, private delivery and form abuse checks also pass; the anonymous verifier alone does not prove them.
- [ ] Production notification sender/domain and webhook configured; a controlled message delivers. Failures retain the lead and retries are observed. Production test-job URLs return 404; scheduled maintenance is confirmed in hosting.
- [ ] Client owns domain/DNS/renewal and recovery contacts; HTTPS, Auth URLs, CAPTCHA hostnames, origins, sitemap and mail DNS checked after cutover.
- [ ] Available firewall/bot rules, quota/downtime/error alerts and stuck-outbox monitoring configured. Free-tier/inactivity limits and submission ceilings understood by the client.
- [ ] Encrypted export restored into empty isolated staging; no old staff approvals/live sessions restored; new verified Auth UUIDs explicitly bound; counts/permissions/MFA/deletion replay checked.
- [ ] Backup workflow enabled only in restricted private operations repo; successful first run and independent recovery copy verified; passphrase stored separately; retention/storage limits agreed.
- [ ] Tech lead and deputy complete release, code rollback, staff recovery and restore drills using the runbooks without instructor credentials. Maintenance scope and incident owner accepted by the client.

Follow `../SECURITY-UPGRADE-1.6.0.md` for activation and `SECURITY-OPERATIONS.md` for ongoing maintenance. A source package does not configure these remote controls automatically.
