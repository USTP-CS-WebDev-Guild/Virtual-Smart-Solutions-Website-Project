# Security operations and client ownership

Use `../SECURITY-UPGRADE-1.6.0.md` for installation and `../docs/SECURITY-THREAT-MODEL-1.6.0.md` for the control map. Assign a primary maintainer and a deputy before production. The instructor is not a permanent operational dependency.

## Accounts and permissions

- The client owns the registrar/domain, production Supabase, hosting and email/verification providers. Record who can recover each account and where renewal notices go. Staging belongs to the guild and never contains real client records.
- Administrators use individual accounts, MFA and a password manager. Use provider invitations and scoped permissions. Do not share a Gmail password, a repository-owner login, service-role key or Auth password among students.
- Prefer passkeys/security keys for platform administrators where offered. TOTP for website staff is additional protection, not protection against all phishing.
- Disable public Auth signup and anonymous login. Keep Auth Site URL and approved redirects exact. Enable hCaptcha in Supabase Auth so the provider endpoint also enforces it.
- Browser configuration receives only publishable/anon keys. Server/backup secrets are private. If any secret was pasted into chat or a public issue, replace it in its provider and redeploy the new server value; deleting the message is not rotation.
- Import the main ruleset and verify required reviewers/checks apply. Confirm every CODEOWNER has repository Write access. Restrict deployment/admin access and do not give untrusted previews production credentials.

## Add or remove a website staff member

Create a verified, non-anonymous Supabase Auth user and explicitly approve that exact UUID in `public.staff_users`. Owner is for publishing/privacy administration; staff is for the shared inquiry/client inbox. A new email match never substitutes for approving a recreated account's ID.

To offboard, a trusted operator disables the staff record immediately using a parameterized/privileged console action, then revokes that user's Auth sessions and removes provider/repository memberships. If an employee had private keys or shared credentials, rotate those too. Record the operator, account ID, reason, timestamp and request IDs in a restricted maintenance log. Check from the already-open old session that private APIs are denied and private updates no longer arrive. Retain business audit history according to the approved retention policy.

Production reads the actual Auth session on every private API call and enforces MFA in private signal RLS. A disabled membership cannot continue by replaying an otherwise unexpired JWT. The public page stays accessible normally.

## Lost authenticator / account recovery

Do not disable the production database policy or add a public reset bypass. A second authorized operator verifies the person through the company's agreed channel, revokes the affected sessions, and uses the Supabase account-management recovery controls. Have the user set a unique password and enroll a new authenticator. Confirm the unchanged approved Auth UUID (or explicitly approve the replacement UUID), test role access, and record the recovery. Keep provider recovery material outside the public repository.

The website's private API activity limit is fifteen minutes and its absolute session limit is eight hours. New sign-in creates a new session. Saving often avoids losing an unsaved long edit when reauthentication is required. Do not relax expiry merely to fix an unrelated login/configuration issue.

## Checks and responsibilities

| Frequency | Named maintainer action |
| --- | --- |
| Each release | Review migration/role changes and dependency diff; clean `npm ci`, source check, audit, `verify`, native browser suite; staging walkthrough; reviewed production commit. |
| Each day / alert | Check provider errors, public availability and quota alerts; inspect the owner outbox for failed/stuck delivery. Never put message bodies/tokens in an uptime log. |
| Each week | Review Dependabot/security alerts, backup success and age, unused access, unexpected logins and request-ID error patterns. Test a controlled form path if alerts suggest a problem. |
| Each month | Restore an encrypted backup into an empty isolated project; re-establish verified staff bindings, check authorization and deletion replay; record evidence and remove drill data. |
| Before domain renewal or cutover | Confirm ownership, billing/renewal contact, registrar MFA, HTTPS, exact origins/Auth URLs/CAPTCHA hostnames/CSP, DNSSEC where supported, and preserved mail DNS. |
| At each handover | Transfer recovery ownership, keys, schedules and runbooks to the client/appointed maintainers; remove students' production rights. |

Use available provider firewall/bot/rate controls and alerts before traffic reaches Functions. Review Supabase Database/Security Advisors in the intended staged project after migration; investigate findings rather than marking them handled because a source test passed. Keep providers on supported security patch levels. Understand free-tier caps and inactivity behavior; code cannot guarantee unlimited availability.

## Incident response

1. Preserve the timestamp, release/commit, request IDs and minimal redacted provider logs. Keep evidence private and do not copy customer records into a public issue.
2. Contain the actual affected boundary: disable the compromised staff membership/revoke sessions, revoke a leaked service key or deploy token, or restrict a vulnerable endpoint through the hosting provider. Keep public information available when safe. Assign a decision owner.
3. Rotate affected credentials at their provider and redeploy. Review repository/workflow changes, current deployed commit, database privileges/policies, provider logins and DNS changes. A leaked service-role key has broader consequences than a stolen low-privilege staff token.
4. Fix in a reviewed branch and verify in isolated staging. Inspect audit/history for unauthorized changes and assess affected records. Follow the company's applicable incident notification process with appropriate professional advice; this runbook does not set a legal deadline.
5. Restore only when needed, into an isolated empty target first. Validate content/records and replay completed deletion actions that occurred after the backup. Recreate Auth accounts, explicitly bind their new UUIDs and test MFA before reopening private access.
6. Document what happened, corrective changes, who approved recovery and which monitoring/checks will detect recurrence. Do not erase incident evidence by blindly resetting the database.

## Backup boundaries and release rollback

The application dump covers `public` and `app_private` schema/business data, excluding session activity and staff approvals. It does not back up managed Auth users/passwords, provider configuration, DNS or email accounts. The encrypted artifact and its passphrase must be stored separately. Tamper tests check authentication of the encrypted file; they do not prove a remote database restore succeeds.

Run `.github/workflows/backup-production.yml` only in the selected private operations repository, with `ENABLE_PRODUCTION_BACKUP=true` and `PRODUCTION_BACKUP_REPOSITORY=OWNER/REPO`. Check Actions/artifact/storage limits before enabling it. The source project's public workflow is disabled by default and refuses public repository execution. Maintain an approved client recovery copy; do not rely on a fourteen-day Actions artifact as the entire retention policy.

Keep schema changes backward-compatible and pause schema changes during a two-part export. For an application rollback, redeploy the last reviewed compatible commit. The 1.6.0 migration is additive; do not drop its policy/session tables or turn off MFA as a rollback shortcut. If old code cannot satisfy a strengthened policy, ship the fix or keep private access closed while resolving it.
