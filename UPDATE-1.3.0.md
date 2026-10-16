# Update to VSS 1.3.0 — frontend redesign

The project keeps its working backend, PostgreSQL database, owner workspace, forms and pushed updates. This release rebuilds the public presentation with navy/mint/blue surfaces, a larger editorial portfolio, photographic service previews and coordinated browser-native motion. There are no new cloud services, animation packages or database migrations.

## Update an existing project without losing your work

1. Stop the existing development terminal with **Ctrl+C**.
2. Keep a backup or commit of the team's source. Preserve your existing **`.git`**, **`.env`**, and **`.local`** folders/files. They hold repository history, configuration and the local database/accounts. Never publish them or replace them with another person's values.
3. Extract the ZIP elsewhere. Copy the **contents** of its `vss-website` folder into your existing project root, beside the current `package.json`. Do not create `vss-website/vss-website`. Include the new `frontend/styles/brand.css`, `workspace.css`, `frontend/lib/navigation.ts`, `accordions.ts` and `frontend/public/motion-init.js`.
4. Open that existing root folder in VS Code. In its terminal run:

```powershell
npm ci
npm run verify
npm run dev
```

5. Open **http://127.0.0.1:4321/**. Keep the terminal open. Use **Ctrl+F5** once if the old CSS remains in your browser cache. The terminal's local accounts remain the same when `.local` is preserved; show them with `npm run accounts`.

**No SQL is needed when upgrading from 1.2.0 or 1.2.1. Do not run `INSTALL-FRESH.sql` on an existing database.** If you are upgrading from an earlier release, follow the existing database upgrade guide for any missing migrations; all four canonical migrations are unchanged in this release.

## See the new frontend

- **Home:** navy hero, mint actions, layered floating cards, slow image movement and a moving expertise strip. Scroll into the photographic service explorer, process, featured work, packages, people and answers.
- **Services:** alternating image/detail layouts, dark package comparison and animated FAQs.
- **Our work:** dark introduction, orbit graphic, one featured engagement and supporting entries. Changing a filter changes which entry is featured; details open in a keyboard-accessible overlay.
- **About:** large photography, dark working principles and full-width portrait cards. Team entrances run once rather than sliding repeatedly on every scroll.
- **Contact:** a dark invitation beside readable white form controls. The real saved receipt, package selection and live owner delivery remain connected.
- **Navigation:** mobile menu fades without moving the page. Public links use short native cross-document transitions in supporting browsers; other browsers use normal links. Forms and owner authentication keep their normal document lifecycle.

Use **Resume animations** if a previous visit saved the paused preference. Both footer/ticker controls stay synchronized. A device's reduced-motion preference takes priority. There is no scroll-jacking, artificial loading screen or hidden-content dependency on JS.

## Team review and release

Read `frontend/styles/README.md` to locate design files, then `ui-ux/MOTION-AND-INTERACTIONS.md` for timing and acceptance checks. Stop dev before running the browser suite:

```powershell
npx playwright install chromium
npm run test:browser
```

The supported browser preview was unavailable during this build. Type/DOM/SQL/build checks were run; real browser painting and phone review are still required. The included browser scenarios cover mobile navigation, rapid FAQ interactions, service previews, filtering, pause/reduced-motion behavior and the existing full business workflow. See `docs/VERIFICATION.md` for actual results.

Push the reviewed source to the **team's** GitHub repository and let the existing Netlify integration build it. This ZIP does not change the live deployment. Keep your team's configured Supabase/Netlify settings, captured-mail and test isolation flags. The public technical test banner remains removed. Custom-domain and maintenance instructions remain in `devops/DEPLOYMENT.md` and `devops/MAINTENANCE-HANDOVER.md`.
