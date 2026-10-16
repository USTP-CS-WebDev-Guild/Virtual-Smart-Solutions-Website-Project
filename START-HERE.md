**Release 1.5.0:** existing projects start with [UPDATE-1.5.0.md](UPDATE-1.5.0.md). Client owners use [OWNER-GUIDE.md](OWNER-GUIDE.md).

# Your first working system

Allow about 15 minutes. Use Node.js 24 LTS, VS Code and Git. The full install/clone/deploy sequence is in README.md. Start in the folder containing `package.json`.

## 1. Install and run

```powershell
npm ci
npm run dev
```

First startup creates your ignored `.env`, two random local logins, and an empty PostgreSQL database. There are **zero preloaded inquiries, clients, or privacy requests**. Open the exact URL printed in the terminal: http://127.0.0.1:4321/.

Leave that terminal running. Open a second VS Code terminal for other commands. Run `npm run accounts` whenever you need the local credentials. These are local classroom logins, not Supabase accounts.

## 2. See the public and owner sides

In one tab open the home page. Scroll to **Owner sign-in** in the footer and sign in with the generated **owner@classroom.test** account. Keep that workspace open.

In a second tab open `/services/`, choose **Discuss Professional**, and confirm the contact form preselects that package. Enter **Alex Example**, **alex@example.test**, choose a service, and write a synthetic request. A successful save shows a reference number.

The owner inbox updates after the save without a page reload or a 30-second poll. If it does not, inspect the visible live connection state and the backend terminal; do not insert a fake success message.

## 3. Follow the actual workflow

| What you do                                  | Where it appears                             |
| -------------------------------------------- | -------------------------------------------- |
| Send the contact form                        | Inquiries                                    |
| Open an inquiry → add a note / change status | That inquiry's detail and audit history      |
| Open an inquiry → Convert to client          | Clients, with a link to the original inquiry |
| Send the separate form on `/privacy/`        | Privacy requests, visible to owner only      |

A contact inquiry does not automatically become a client or a privacy request. Client conversion is repeat-safe.

Open the inquiry and confirm its requested package/price. Save a note, change its status, then convert it. Click **Clients** and confirm the record. In the owner test tools, click **Run test jobs**. The notification becomes **captured**, which means it was processed without sending email.

## 4. Publish a real content change

Open the home page in another tab and leave it open. In the owner workspace choose **Website editor**, change **Home page heading**, then **Save and publish**. The already-open home page changes through a pushed event. Refreshing or restarting preserves it because the content is in PostgreSQL.

Try the same with a package price, portfolio entry and team introduction. New entries start unpublished. Keep an unsent contact form open: changing a price preserves the visitor’s message; withdrawing its selected package asks the visitor to choose again. See [OWNER-GUIDE.md](OWNER-GUIDE.md).

Use a private/incognito window for the generated **staff@classroom.test** account. Staff can handle inquiries and clients. Website editor and privacy requests belong to the owner role. Signing out must hide and clear private workspace content.

## 5. Make your first source change

Follow [docs/learning/01-first-change.md](docs/learning/01-first-change.md), then your role's README. Your API-published content takes precedence over fallback content in `shared/site-content/defaults.ts`; the customization guide explains this distinction.

## 6. Check before sharing

Stop the dev server with Ctrl+C when finished, then run:

```powershell
npm run verify
```

It checks types, real database rules, security, and a production build. It does **not** deploy anything.

## Common first-run problems

| Symptom                                           | Action                                                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `astro is not recognized`                         | Run `npm ci` in the folder containing `package.json`.                                                                                   |
| Wrong folder / no package.json                    | VS Code → File → Open Folder → this project's root.                                                                                     |
| Port 4321 or 8787 in use                          | Stop the other dev terminal with Ctrl+C. Do not start two copies.                                                                       |
| Where is my password?                             | Run `npm run accounts` in a second terminal. Never paste passwords into chat or GitHub.                                                 |
| Logged out after restarting                       | Local sessions intentionally expire on server restart; sign in again. Data remains.                                                     |
| Changes to defaults do not replace published copy | Edit/publish in Website editor, or archive your disposable local database as below.                                                     |
| Need a completely fresh local project             | Stop dev, then `npm run reset:local -- --confirm-local-data`. This archives the old `.local` folder into ignored `.classroom-backups/`. |

A phone on another network cannot open your computer's `127.0.0.1`. To share an independent normal HTTPS link, complete [devops/DEPLOYMENT.md](devops/DEPLOYMENT.md). Do not expose the classroom runtime to the internet.

## Design and team handover

Try the homepage service explorer, work filters/details, searchable FAQs and package comparison. Use Pause animations beside the expertise strip or in the footer and try OS reduced motion. Existing published footer copy stays yours; see UPDATE-1.4.2.md if upgrading. The student tech lead owns review/release, supported by DevOps and a deputy. Read devops/STAGING-AND-PRODUCTION.md and devops/MAINTENANCE-HANDOVER.md.
