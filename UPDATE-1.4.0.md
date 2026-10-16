# VSS 1.4.0 — black/white presentation and lighter navigation

This release follows the supplied prototype screenshot: white navigation, a light hero beside dark photography, charcoal sections, white content surfaces and restrained blue accents. Green/mint/teal presentation colors and decorative orbit/star graphics have been removed. The working backend, owner tools, saved records and live updates remain connected.

## Update your existing folder

1. Stop the development terminal with **Ctrl+C**.
2. Keep a backup/commit and preserve your existing **`.git`**, **`.env`** and **`.local`**. They contain repository history, configuration and local accounts/database.
3. Extract this ZIP elsewhere. Copy the **contents** of its `vss-website` folder into your existing project root, replacing source files. Do not create `vss-website/vss-website`.
4. Open the existing root in VS Code and run:

```powershell
npm ci
npm run verify
npm run dev
```

Open **http://127.0.0.1:4321/**. Use **Ctrl+F5** once to clear the old page/CSS from the browser. Keep the terminal open. If you previously paused motion, use **Resume animations** beside the expertise strip or in the footer. OS reduced motion still takes priority.

**No database migration or new account/service is needed for an update from 1.3.1.** All canonical SQL files and dependency versions are retained. Only application version metadata changes. Your local records/accounts remain when `.local` is preserved; `npm run accounts` prints the local logins again.

## What changed

- Light header and split hero: black text and buttons, blue active-link/accent states, full-height dark photography on the right.
- Charcoal expertise band, process/work/closing/footer sections; white service and package surfaces with one dark featured package.
- Neutral service chooser, filters, comparison, dialogs, team cards and forms. Natural photo colors are retained.
- Removed full-page View Transition snapshots and cross-fading/sliding headers. Normal links navigate without waiting for an exit animation.
- Motion preference boot is deferred rather than blocking page rendering. Already-visible headings/content are not faded or moved when opening a page.
- Small one-time entrances apply to later scrolling. Hero/photo movement, the expertise ticker, hover/focus feedback, service/filter changes, FAQ expansion and mobile menu effects remain.

There is no claim that page switching is instant on every network/device. The costly full-document animation path has been removed; real device frame pacing should be checked on your machine. See `docs/VERIFICATION.md` for executed checks and browser limits.

## Before client approval

Stop dev, then run `npx playwright install chromium` once and `npm run test:browser`. Review real desktop/phone layouts, links, Back/Forward, hover, keyboard focus, 200% zoom, motion off/reduced motion and live owner publications. Repeat contact → receipt → owner inbox → note → client conversion, plus the separate privacy-request workflow.

Hosting remains through the team's existing GitHub/Netlify/Supabase configuration. This archive does not change the live site until the team deploys it. Keep test isolation/noindex/captured-mail configuration for test environments; the public technical test banner remains absent.
