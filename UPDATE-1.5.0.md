# Upgrade the existing VSS project to 1.5.0

This release rebuilds the owner workspace in black, white, and charcoal, with a blue brand accent. It adds Overview, a mobile navigation drawer, stored-record search, client filters, clearer privacy handling, preserved drafts, grouped page editing, and approved-image selectors. Diagnostics have moved to Settings & help.

**No database migration is required from 1.4.2.** All existing migration files and INSTALL-FRESH.sql are unchanged. Keep the existing Supabase project, Auth accounts, business records, and Netlify environment variables. Do not run INSTALL-FRESH.sql over the existing database.

## 1. Copy the update into the existing Git project

Stop development with Ctrl+C. Extract the ZIP into a separate folder. Copy the contents of its `vss-website` folder into your existing project folder and replace matching source files. Keep your existing `.git`, `.env`, `.local`, and account configuration. The ZIP contains no Git metadata, secrets, runtime database, or installed dependencies.

For your current Windows project, open:

```text
C:\Users\im\Desktop\Client_website\vss-website
```

Confirm that `package.json` is directly in this folder. Its version should be `1.5.0`.

## 2. Verify locally

```powershell
npm ci
npm run verify
npm run dev
```

Open http://127.0.0.1:4321/ and use Owner sign-in in the footer. `npm run accounts` prints your local accounts. Local classroom records remain local; hosted accounts remain in Supabase. Try the walkthrough in OWNER-GUIDE.md. Stop dev with Ctrl+C before browser tests.

Browser acceptance:

```powershell
npx playwright install chromium
npm run test:browser
```

The updated suites cover desktop and mobile navigation, publishing, live inquiries, conversion confirmation, and privacy completion. Review a real phone as well. See docs/VERIFICATION.md for tests actually run while producing this archive.

## 3. Publish to the students' existing repository

```powershell
git status
git remote -v
```

Confirm that the `team` remote points to the students' repository:

```text
https://github.com/ustpcswebdevguildbatch1-afk/Virtual-Smart-Solutions-Website.git
```

The remote URL may include the team's username before github.com. Use the team browser profile for any authentication prompt, then:

```powershell
git add frontend backend devops shared tests docs README.md START-HERE.md OWNER-GUIDE.md CHANGELOG.md UPDATE-1.5.0.md package.json package-lock.json SOURCE-CHECKSUMS.sha256
git diff --cached --stat
git commit -m "Redesign owner workspace and improve client workflows"
git -c credential.helper= -c credential.helper=manager push -u team HEAD:main
```

Review the staged paths before committing. Production credentials and local runtime data must remain ignored. If your remote has another name, use that verified team remote instead of `team`.

## 4. Verify the hosted update

Netlify rebuilds from the pushed commit. Wait for the new deploy to say Published. All twelve existing settings remain in place, including both PUBLIC_SUPABASE_URL and SUPABASE_URL with the same project origin.

```powershell
npm run verify:deployment -- https://vss-guild-batch1-staging.netlify.app
```

The release marker must be 1.5.0. Open the public website in an incognito window and on a phone. Sign in through the footer with the hosted Supabase owner account, then verify:

- Overview counts and recent inquiries reflect saved records.
- A synthetic contact submission reaches an already-open owner inbox.
- Search finds old records and status filtering works.
- An unsaved note survives switching conversations and an incoming live update.
- Conversion asks for confirmation and creates one client.
- Client status saves and its original inquiry opens.
- Website edits are preserved across workspace navigation; publishing updates another open public tab.
- Privacy requests remain separate and require identity verification, a note, and confirmation before anonymization.
- Settings & help → Check contact form, Verify live delivery, and Run test jobs succeed in staging.
- Signing out hides the workspace and clears private displayed records.

The ZIP itself does not change the deployed website. The push and successful Netlify deployment publish the update.
