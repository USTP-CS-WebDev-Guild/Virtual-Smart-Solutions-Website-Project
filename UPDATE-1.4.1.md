# VSS 1.4.1 — stable rendering and a compact mobile menu

This is the complete application: public pages, local classroom system, backend, database migrations, owner workspace, live updates, tests and deployment guides. It updates the supplied 1.4.0 source. It does not change the live site until your team deploys the new source.

## Update your existing project

1. Stop the development terminal with **Ctrl+C**.
2. Make a private backup of your existing project, including `.git`, `.env` and `.local`. Do not upload that backup. These contain history, configuration and local records/accounts.
3. Extract the new ZIP elsewhere. Copy the **contents** of its `vss-website` folder into your existing project root and replace the source files. Keep your existing `.git`, `.env` and `.local`; this archive contains none of them. Avoid nesting a second `vss-website` folder inside the project.
4. Open the existing project root in VS Code. `package.json` must be directly inside the opened folder. Run:

```powershell
npm ci
npm run verify
npm run dev
```

Open **http://127.0.0.1:4321/**. Use **Ctrl+F5** once if an old page/style is cached. Keep the terminal open. Use Owner sign-in in the footer; `npm run accounts` prints the existing local credentials when `.local` was preserved.

**An update from 1.4.0 needs no new database migration, cloud account, dependency or secret.** The four canonical migrations and `INSTALL-FRESH.sql` are unchanged. Do not run the fresh database installer over an existing project. Do not reset the local database to update the design.

## What was corrected

- The full-width two-column mobile navigation is now a compact single-column panel with selected-page state, a separate black contact action, clear spacing, a smaller Menu/Close control and a subdued backdrop. It overlays the content and its links scroll on short viewports.
- A cross-page menu link retains the open panel until the browser commits the next document. The previous behavior exposed the old page as soon as the link was clicked. Native links and Back/Forward remain intact; public header/menu links opt into Astro prefetching.
- The initial API response no longer rebuilds an identical public catalog. A heading-only publication leaves service/work photos, controls and an open work detail alone. Changed lists reconcile by stable ID rather than replacing every row.
- Service choices, all service regions, work filters and initial featured-card state are present in Astro HTML. The controls do not appear late and move the content.
- Service regions share one grid cell and reserve the height of the tallest description. Selecting a different service retains the buttons and photos; only the active region is visible and interactive.
- Service/filter feedback uses one short opacity animation. It no longer shifts each card and the entire panel simultaneously. Dialog feedback is also opacity-only. Existing hero/photo/ticker motion, later scroll entrances, pause controls and reduced-motion support remain.
- Both local fonts preload and use `font-display: optional` to avoid a late font-face swap on slow first visits.

The public palette remains white/light, black/charcoal and restrained blue. No new green theme or full-page transition effect has been added.

## Check on your machine before sharing

`npm run verify` checks types, DOM behavior, database/security workflows and the production build. It does not measure real browser painting. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for actual results and limits.

Stop dev first. Install the browser once and run the browser scenarios:

```powershell
npx playwright install chromium
npm run test:browser
```

Check a phone and desktop, including a short landscape viewport, at 320/390/768/811/1440px. Open the menu, change pages, use Back/Forward and Escape, select every service, filter work rapidly, open/close details and publish content with another page open. A longer description must not move the service buttons. A normal page link must not reveal the previous page while the request is pending.

Repeat contact → receipt → owner inbox → note/status → convert to client, then the separate privacy request. Keep the test database, captured email and noindex settings for the team's test environment. Client approval, real-device review, approved business/privacy copy, mail setup and a tested recovery remain release tasks.

## Publish through the existing team repository

From the actual Git clone, review `git status` and `git diff --stat`. Commit the source update on a branch, push it and open a pull request. The tech lead reviews and merges it into the branch connected to the team's Netlify site. Do not commit `.env`, `.local`, account keys, runtime records, `node_modules` or `dist`. Do not create a second provider account to apply this frontend update.

After Netlify publishes the new commit:

```powershell
npm run verify:deployment -- https://YOUR-SITE.netlify.app
```

Then use the hosted owner account and owner diagnostic tools. Local classroom passwords are not hosted Supabase credentials. Existing staging/production, custom-domain and maintenance guides remain under `devops/`.
