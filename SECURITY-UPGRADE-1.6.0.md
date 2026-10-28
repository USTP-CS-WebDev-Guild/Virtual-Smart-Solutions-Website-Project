# Apply the VSS security upgrade — current patch 1.6.4

The client-approved public design and business workflows are retained. This release adds production staff MFA, immutable account bindings, revoked/idle-session checks, anti-bot verification, stricter HTTP/CSP boundaries, dependency patches and release controls. No security change is active on your existing hosted site until its source, migration and provider settings are applied.

Use staging first. Keep your existing Git history, `.env`, `.local`, records, domain and provider accounts. This archive contains no real credentials or customer data. Do not overwrite students' unrelated work without reviewing the diff.

## 1. Open and verify the complete project

Copy the contents of the archive's `vss-website` folder into your existing checkout, including `.github`. In VS Code's terminal, from the folder containing `package.json`, run individually:

```powershell
node -p "require('./package.json').version"
npm ci
npm run security:check
npm run security:audit
npm run verify
```

The version must be **1.6.4**. Existing 1.6.0–1.6.3 source uses the browser-test patches in `UPDATE-1.6.4.md`; no additional database migration is needed for those patches. Keep development servers stopped before native acceptance:

```powershell
npx playwright install chromium
npm run test:browser
```

Existing Chromium installations can skip installation. All browser scenarios must run and pass before production approval. `npm run dev` still starts the local classroom system without cloud keys, Docker or an authenticator account. Local classroom credentials never work on hosted production.

## 2. Upgrade the staging database

In the existing **staging** Supabase project's SQL Editor, apply only:

`backend/database/migrations/20261027110215_harden_identity_and_sessions.sql`

PowerShell can copy it without exposing any credentials:

```powershell
Get-Content .\backend\database\migrations\20261027110215_harden_identity_and_sessions.sql -Raw | Set-Clipboard
```

Paste into SQL Editor, confirm you selected staging, and run once. Earlier migrations are unchanged. **Never run INSTALL-FRESH.sql on an existing database.** Keep staging `APP_ENV=staging`, `PUBLIC_TEST_ENVIRONMENT=true`, and `TEST_EMAIL_MODE=capture`. Leave hCaptcha keys unset if you want synthetic classroom testing without an external verification provider.

The additive migration binds existing verified staff identities once and starts with the production enforcement switch off. Review this result privately:

```sql
select email, auth_user_id, role, active from public.staff_users;
```

Any active row with a null ID needs an explicit verified account binding. A deleted and recreated Auth account cannot inherit an old row just by reusing its email.

## 3. Prepare the client-owned production database and accounts

- **New, empty client project:** run the regenerated `backend/database/INSTALL-FRESH.sql` once.
- **Existing client production project:** take a verified backup, then apply only the new migration from step 2.

Create individual verified owner/staff Auth accounts. Disable public signups and anonymous sign-ins in Supabase Auth. Do not use a shared student/team login as the client's production owner.

Edit `backend/database/owner-setup.sql.example` with the exact owner Auth UUID and email. Both values must match the verified account. Run it in the intended project and confirm its resulting binding. Additional staff approvals use the same explicit UUID binding with `role='staff'`. Membership tables cannot be edited from a browser.

Rotate any project keys or passwords previously shared in chats, screenshots or student configuration. Use new client-production secrets and individual platform access; do not distribute the production service-role key to the class.

## 4. Set up the client verification provider

Use a client-owned [hCaptcha account](https://dashboard.hcaptcha.com/). Register the exact production hostname and its `www` variant if used. Obtain the public site key and private secret.

In **Supabase Auth → Attack Protection / CAPTCHA**, enable hCaptcha and configure its secret. The website passes the widget token to Supabase's password sign-in; enabling the provider protects the Auth endpoint itself, including callers that bypass your webpage.

Configure the same site key for the website forms. Production rejects published dummy keys, missing tokens and failed verification. Tokens are single-use: the form resets verification after each attempt and retains the visitor's draft on errors. Verify the company's privacy notice names its active verification provider before taking real submissions.

## 5. Arm the database policy

After confirming the verified account bindings, run **`backend/database/SECURE-PRODUCTION.sql` in production only**. It refuses to arm when approved members have unbound identities or no bound owner exists.

The next sign-in requires an authenticator. The website provides a setup QR/manual key for first enrollment and a six-digit challenge for later sign-ins. Business screens remain closed until the API accepts MFA and the database validates the session.

Production policy enforces:

- A verified, non-anonymous Auth identity bound to an active staff record.
- MFA (`aal2`) before private APIs and private Realtime signals.
- A current Auth session, a maximum eight-hour lifetime and a fifteen-minute idle limit measured by private API activity. An expired session cannot be revived by replaying its token; sign in again.
- Immediate denial after membership disablement or underlying session deletion.

Long editing sessions can require a fresh sign-in; save work regularly. Use a trusted authenticator and protect its recovery material. TOTP does not make users immune to phishing or a compromised device. Tokens are scoped to tab storage, remain JavaScript-readable, and are also protected by the site's safe rendering and CSP.

## 6. Configure the production Netlify site

Keep the existing build settings: base empty, `npm run build`, publish `dist`, Functions `backend/functions`, Node 24. Production and staging must use different Supabase projects and private credentials.

| Setting | Client production value | Availability |
| --- | --- | --- |
| `APP_ENV` | `production` | Builds and Functions |
| `PUBLIC_TEST_ENVIRONMENT` | `false` | Builds and Functions |
| `PUBLIC_SITE_URL` | Exact approved HTTPS website origin | Builds |
| `APP_ORIGIN` | Same exact origin, no path or trailing slash | Functions |
| `PUBLIC_SUPABASE_URL` | Client Supabase HTTPS project origin | Builds and Functions |
| `PUBLIC_SUPABASE_ANON_KEY` | Client publishable key | Builds and Functions |
| `SUPABASE_URL` | Same client Supabase project origin | Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Client private server key | Functions only |
| `PUBLIC_HCAPTCHA_SITE_KEY` | Real client site key | Builds and Functions |
| `HCAPTCHA_SECRET_KEY` | Client private verification secret | Functions only |
| `RATE_LIMIT_SECRET` | New random secret, at least 32 characters | Functions only |
| `TEST_EMAIL_MODE` | `send` | Functions |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | Approved real notification configuration | Functions only |
| `OWNER_NOTIFY_EMAIL`, `RESEND_FROM` | Approved recipient and verified company sender | Functions |

Leave `PUBLIC_CLASSROOM_MODE` unset on hosting. Restrict production secrets to the production deployment context; branch deploys and untrusted PR previews get staging-only credentials. Never authorize preview builds from arbitrary forks to use privileged keys.

Generate the rate-limit secret privately on your computer:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" | Set-Clipboard
```

Paste it only into the private hosting setting. It is not a password or a public variable. Set Supabase Auth's Site URL to the same production origin and keep redirect URLs narrowly scoped. Rebuild after public configuration changes: CSP is generated for one exact Supabase project, not every Supabase tenant.

The provider email configuration remains separate from form storage: a lead is retained even if notification delivery fails. Check the outbox/notification health and a real controlled email delivery before handoff.

## 7. Protect release approval

Create a review branch, commit this update, and open a PR in the organization repository. Confirm the remote is `USTP-CS-WebDev-Guild/Virtual-Smart-Solutions-Website-Project`; the existing workstation remote is normally `guild`.

```powershell
git switch -c security/hardening-1.6.0
git status
git remote -v
```

Review and stage the changed project files, excluding `.env`, local records and generated files. Run verification before pushing your review branch. Do not force-push students' work. Merge only after the Linux and Windows checks pass and the appointed production reviewer approves.

`.github/CODEOWNERS` initially assigns security-sensitive paths to `@franku69`, the existing maintainer. Confirm that account has repository Write access, or replace it with the appointed reviewer before enabling required code-owner review. Import `.github/rulesets/production-main.json` in repository Rulesets and verify it actually applies to `main`. Required reviews/ruleset availability depends on the repository plan and visibility; a JSON file alone does not protect a branch.

Enable available secret scanning/push protection and Dependabot alerts. All GitHub, Netlify, Supabase and registrar administrators must use individual accounts with MFA. Review membership and recovery ownership before handoff. Deployment rights and production secrets belong to the client and appointed maintainers.

## 8. Complete hosted acceptance

After Netlify publishes the reviewed commit:

```powershell
npm run verify:deployment -- https://YOUR-APPROVED-DOMAIN
```

Require release **1.6.4**. Then test in a fresh browser/phone:

1. Public pages open without a hosting login.
2. A missing or invalid form verification is rejected without creating a lead; a valid synthetic inquiry gets a reference and appears in the already-open owner inbox.
3. Password-only staff sign-in opens the authenticator flow, not business data. A valid code opens the correct role; staff cannot access owner-only privacy/content tools.
4. An owner edit reaches an already-open public page. No published content is replaced with placeholders or fake success.
5. Sign-out removes private records and stops private updates. Verify offboarding with a separate test staff account: disable its membership, revoke sessions, and confirm access stops.
6. Confirm privacy handling, captured/live mail mode, outbox retries and restore evidence. Production test-job URLs intentionally return 404; scheduled maintenance is invoked by Netlify.

The default production write budgets are five submissions per IP per ten minutes, three per recipient address per hour per form type, and 200 total public-form writes per day. Email/IP identifiers in abuse buckets are keyed hashes. If a budget is reached, the form tells the visitor to contact the company; tune limits deliberately with tests for actual business traffic.

Configure available Netlify firewall/rate rules and provider usage alerts. These application budgets cannot stop a volumetric DDoS before it reaches the hosting provider. Keep the domain in the client's account with renewal reminders, registrar MFA and DNSSEC where supported.

## 9. Backups and recovery

The backup still exports application schema and business data, then encrypts it with AES-256-GCM. It deliberately omits live session activity and staff approvals. Auth users/passwords and provider configuration are not in the application dump. On restore, create verified Auth accounts, bind the new exact UUIDs, and verify MFA before reopening access. Replay later completed deletion requests before returning restored data to service.

Run the backup workflow only in a restricted private operations repository. Set `ENABLE_PRODUCTION_BACKUP=true` and `PRODUCTION_BACKUP_REPOSITORY=OWNER/PRIVATE-OPS-REPO` there, with database/encryption secrets available only to trusted operators. The job refuses to run in a public repository. Retention is 14 days in this workflow; define an additional client-owned recovery copy and retention policy within approved storage limits. Keep the encryption key separately from the encrypted backups.

Perform a restore drill into an empty staging project. Do not test restores on the live database. Keep the previous application deployment for code rollback; do not undo the additive migration or disable MFA to work around a deployment issue. Follow the incident and recovery procedures in `devops/SECURITY-OPERATIONS.md`.
