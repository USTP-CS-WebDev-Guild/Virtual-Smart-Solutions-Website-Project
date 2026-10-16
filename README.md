# Virtual Smart Solutions — complete website, release 1.5.0

Astro + TypeScript frontend, Netlify Functions backend, and Supabase PostgreSQL/Auth/Realtime. The same application also runs locally with persistent embedded PostgreSQL, random local accounts, pushed updates and captured email. Students need no cloud keys, Docker, or separate database installation to begin.

**Start locally:** open this folder (the one containing `package.json`) in VS Code, then run:

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:4321/**. The terminal prints your generated local logins; use **Owner sign-in** in the footer. `npm run accounts` shows them again. Leave the dev terminal running; stop with **Ctrl+C**.

**Updating your current 1.4.2 project? Read [UPDATE-1.5.0.md](UPDATE-1.5.0.md).** This release rebuilds the owner workspace with an independent black-and-white design, Overview, mobile navigation, stored-record searches, safer privacy handling, preserved drafts, and grouped website editing. It uses your existing database, owner accounts, and hosting settings. No database migration is needed from 1.4.2.

The public site opens normally for visitors. The owner signs in through its footer. Read [OWNER-GUIDE.md](OWNER-GUIDE.md) for the client-facing walkthrough. Operational tools are under **Settings & help**, rather than repeated on every business screen.

## Where each student works

| Role | Start here | Work folder |
| --- | --- | --- |
| Everyone | [START-HERE.md](START-HERE.md), [CONTRIBUTING.md](CONTRIBUTING.md) | Root guides and assigned issue |
| Frontend | [frontend/README.md](frontend/README.md) | `frontend/` — pages, components, CSS, browser behavior |
| Backend | [backend/README.md](backend/README.md), [backend/API.md](backend/API.md) | `backend/` — routes, validation, business logic, database migrations |
| DevOps | [devops/README.md](devops/README.md), [devops/DEPLOYMENT.md](devops/DEPLOYMENT.md) | `devops/`, `netlify.toml`, `.github/workflows/` |
| UI/UX | [ui-ux/README.md](ui-ux/README.md), [ui-ux/MOTION-AND-INTERACTIONS.md](ui-ux/MOTION-AND-INTERACTIONS.md) | Design flows, acceptance checks, `frontend/styles/` |
| Project manager | [project-management/README.md](project-management/README.md) | `project-management/` — issues, approval, release evidence |
| Shared contracts | [PROJECT-MAP.md](PROJECT-MAP.md) | `shared/` — content types, validation, release |

Your **student tech lead** reviews releases. Your DevOps lead manages hosting and recovery. The instructor is a mentor, not a permanent deployment dependency. Students commit with their individual GitHub identities to the team's repository.

## What is connected

- Eight public/owner routes; mobile navigation and 16px phone form controls.
- Owner Overview with actual inquiry counts and recent conversations, searchable inquiry/client/privacy records with cursor pagination, mobile drawer navigation, and readable black-and-white panels.
- Notes and website drafts survive workspace navigation and incoming updates. Client conversion and privacy anonymization have explicit confirmations. Website copy is grouped by page and approved photos have readable selectors.
- White navigation and a light split hero, black/charcoal sections, photographic service previews, white packages with a dark feature, and larger portraits. No green/mint/teal theme.
- Compact mobile navigation with selected-page state, a separate consultation action and a backdrop. The menu stays still until the next document arrives. Public navigation links opt into Astro prefetching.
- Pre-rendered service/filter controls, equal-height service regions and selective live content updates that preserve unchanged nodes.
- Normal page links with immediate visible content; small later scroll entrances, animated service/filter changes, measured FAQ expansion, floating hero cards, expertise ticker and reduced-motion/shared pause controls.
- Service explorer, work filters/detail overlays, searchable FAQs, package comparison, leadership introductions and the requested four-column VSS footer.
- Real inquiry receipt, repeat-safe retries, possible-duplicate review, notes, status and explicit conversion to a client.
- Separate owner-only privacy requests, verified completion and anonymization.
- Owner-published page copy, services, packages, team, FAQs and portfolio; revision history/conflict handling and pushed updates. Only approved client case studies are public.
- Server-owned package snapshots, transactional inquiry/audit/outbox writes, bounded email retries and signed delivery events.
- Authenticated roles, same-origin mutation checks, streaming body limits/timeouts, server validation, restricted SQL grants/RLS, CSP and safe text rendering.
- Encrypted backup/restore scripts, CI and tests using actual PostgreSQL permissions and transactions.

Public HTML is built ahead for fast delivery. Inquiries, login, owner edits and live data use the API/database. No fake success timer or idle 30-second record polling is used.

## Student setup and shared deployment — follow in order

### 1. Install the tools

| Tool | Install |
| --- | --- |
| [VS Code](https://code.visualstudio.com/download) | Desktop editor |
| [Node.js](https://nodejs.org/en/download) | **Node 24 LTS**; npm comes with it |
| [Git](https://git-scm.com/install/windows) | Git for Windows (or the installer for your OS) |
| [GitHub](https://github.com/) | Your individual account; accept the team's repository invitation |

Install **Astro** (publisher: Astro) and **EditorConfig for VS Code** from Extensions. The repository recommends them. `npm ci` installs Astro, TypeScript, the local database and testing packages. Only the DevOps maintainers need PostgreSQL client tools later for hosted backups.

### 2. Restart VS Code and confirm installation

Terminal → New Terminal:

```powershell
node --version
npm --version
git --version
```

Each command must print a version. Restart VS Code after installation if one is unrecognized. Before committing, use your own values:

```powershell
git config --global user.name "Your Name"
git config --global user.email "Your GitHub email"
```

### 3. Clone the TEAM repository and run it

Clone the students' team repository below and contribute with your own GitHub identity.

```powershell
git clone https://github.com/ustpcswebdevguildbatch1-afk/Virtual-Smart-Solutions-Website.git
cd Virtual-Smart-Solutions-Website
```

VS Code → File → Open Folder → select that clone. Confirm `package.json` is directly inside it.

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:4321/. A second terminal can run:

```powershell
npm run accounts
```

**Each computer has its own local records and credentials.** Git shares source; it does not synchronize local databases. The local `owner@classroom.test` login is not a hosted Supabase account. Never publish `.env`, `.local`, passwords or keys.

### 4. Walk through the full system, then verify

Use synthetic data. Submit contact → keep its reference → sign in through the footer → open the inquiry → add a note → change status → convert to client. Submit the separate privacy form and check Privacy requests as owner. Publish a heading/package change with the public page open in another tab. Try the service explorer, filters, FAQ search and Pause animations. Repeat with the local staff account in an incognito window to see its restricted permissions.

Stop dev with Ctrl+C, then:

```powershell
npm run verify
```

For real browser tests, install Chromium once:

```powershell
npx playwright install chromium
npm run test:browser
```

Stop other development servers first because browser tests use ports 4321 and 8787. The unit/DOM tests run inside `verify`; they do not replace checking the real phone layout. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for what was actually executed for this release.

### 5. Work by issue, branch and pull request

Read your role's guide above. The PM assigns a small issue with acceptance criteria. Example:

```powershell
git switch -c frontend/improve-services
```

Make and verify the change, commit, push the branch and open a pull request. The tech lead reviews security-sensitive code and migrations. CI runs on `main`, `staging` and pull requests. See [devops/STAGING-AND-PRODUCTION.md](devops/STAGING-AND-PRODUCTION.md) before connecting hosting.

### 6. Configure the shared Supabase TEST project — mentor + DevOps initially

1. Create the team's isolated Supabase Free test project.
2. SQL Editor → run `backend/database/INSTALL-FRESH.sql` **once on the empty project**. Existing projects apply only missing migrations in order.
3. Authentication → Users → create the hosted owner user with a real email and a unique password. Confirm the account using the dashboard/email flow offered for that project.
4. Edit `backend/database/owner-setup.sql.example` with that exact email and run it in SQL Editor. Auth identity and an active owner row are both required.
5. Disable public signups. Staff accounts are owner-managed.
6. Obtain project URL, publishable key and secret key. Browser configuration gets the publishable key; **server configuration only** gets the secret key.

Students do not need these keys for ordinary local work. Use individual provider memberships where available; keep recovery details with the tech lead and backup maintainer. Never put API keys or account passwords in chat/issues/source.

### 7. Import the team repository into Netlify

Use root `netlify.toml`:

| Setting | Value |
| --- | --- |
| Base directory | **Empty** — never a website URL |
| Production branch | `main` for the first shared test site; staging guide explains two environments |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `backend/functions` |
| Node version | `24` |

After Netlify assigns an HTTPS address, configure:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `PUBLIC_SUPABASE_URL` | Test Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Publishable key starting `sb_publishable_` |
| `SUPABASE_URL` | Same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret key starting `sb_secret_` |
| `PUBLIC_SITE_URL` | Assigned HTTPS Netlify origin |
| `APP_ORIGIN` | Same origin, no trailing slash/path |
| `PUBLIC_TEST_ENVIRONMENT` | `true` |
| `RATE_LIMIT_SECRET` | New private random secret |
| `TEST_EMAIL_MODE` | `capture` |
| `OWNER_NOTIFY_EMAIL` | `owner@example.test` |
| `RESEND_FROM` | `Virtual Smart Solutions <hello@example.test>` |

Generate the rate-limit secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Public variables need Build and Functions availability where used by both; `PUBLIC_SITE_URL` needs Build. Private keys belong only in Functions scope where the hosting plan offers scope controls. `APP_ORIGIN` is a server setting. Leave `PUBLIC_CLASSROOM_MODE` unset. Set Supabase Auth **Site URL** to this site's origin. Redeploy after setting variables.

Make the deployed production site Public in Netlify visitor-access settings. This allows ordinary public links while the app still protects owner records. See [devops/DEPLOYMENT.md](devops/DEPLOYMENT.md).

### 8. Verify the independent HTTPS deployment

Replace the example address:

```powershell
npm run verify:deployment -- https://your-team-site.netlify.app
```

Check a phone and an incognito window: no hosting login for public pages; hosted owner login works; an inquiry reaches an already-open inbox; edits reach an already-open public page. Owner tools **Check contact form**, **Verify live delivery** and **Run test jobs** must pass. Capture mode processes notices without sending email; real delivery needs the approved sender/provider setup in the deployment guide.

## Client approval, domain and maintenance

Use [devops/DOMAIN-LAUNCH.md](devops/DOMAIN-LAUNCH.md), [devops/MAINTENANCE-HANDOVER.md](devops/MAINTENANCE-HANDOVER.md) and [devops/RELEASE_CHECKLIST.md](devops/RELEASE_CHECKLIST.md). A `.com` is purchased/renewed by the client; no code rewrite is needed. Test and production must use separate records and secrets.

This project adds no required paid software. Free hosting/database plans have limits and may pause. Check repository/contributor eligibility before connecting hosting; publish client source/assets only with the client's approval. See [devops/COSTS.md](devops/COSTS.md).

Client approval is required for business details, prices, leadership/photo permissions, footer promises, authentic case studies and privacy/retention wording. Published content wins over repository defaults. Existing content is never silently reset by a software upgrade. Assets/licensing: [NOTICE.md](NOTICE.md). Operational/security boundaries: [SECURITY.md](SECURITY.md).
