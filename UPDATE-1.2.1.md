# Install the design/startup fixes — VSS 1.2.1

This ZIP is the complete working project. It fixes the screenshots from the 1.2.0 review: low-contrast footer links, the public test banner, static-looking hero/service/team sections, and the startup connection refusal.

## Update your existing VS Code folder

1. Stop the old dev terminal with **Ctrl+C**. Keep your existing `.git`, `.env` and `.local` folders/files. They contain Git history, configuration and your local records/accounts.
2. Extract this ZIP separately, then copy its `vss-website` **contents** into your existing project folder, replacing matching source files. It contains no local data, account keys or Git history. Do not create a second nested `vss-website` folder.
3. Open the folder containing `package.json` in VS Code. Run:

```powershell
npm ci
npm run verify
npm run dev
```

Startup now opens PostgreSQL and the API first, waits for the real ready signal, and then starts Astro. Open the address Astro prints: **http://127.0.0.1:4321/**. Footer → **Owner sign-in**. Use `npm run accounts` in a second terminal for your existing local logins.

If a port is already occupied, stop the previous project terminal. Startup deliberately stops on an API failure rather than opening a disconnected website. Do not delete your database to fix a port conflict.

## What to look for

- Dark navy footer with readable white/blue-gray links and visible Owner sign-in.
- No yellow TEST ENVIRONMENT banner on public pages.
- Floating hero cards and a slowly moving hero photograph.
- A continuously scrolling expertise strip with a nearby **Pause animations** button.
- Staggered team entrances and gentle portrait movement; refined portrait cards.
- Either pause button stops ongoing movement everywhere; Resume restores it. Device reduced-motion preferences take priority. If animation is paused from an earlier visit, use Resume animations. Hover/focus also pauses the expertise strip for reading.

The hidden test configuration is preserved: local/test notifications are still captured, and hosted test sites stay noindex. Removing the banner does not switch a test database into production or enable real email.

## Database and deployment

**Updating 1.2.0 → 1.2.1 needs no new database migration.** All four migration files and `INSTALL-FRESH.sql` are unchanged. Do not rerun the fresh installer on an existing database. If coming from 1.0.0, follow `UPGRADE-TO-1.2.md` for the earlier additive hardening migration first.

Commit the reviewed source to the team's repository through your staging PR process. Let the existing Netlify integration build the accepted commit, then run the deployment verifier and owner live-delivery checks. The hosted system and domain-launch instructions are unchanged. No cloud account, deployed site or GitHub branch was altered by producing this ZIP.

`npm warn allow-scripts`, funding messages and Astro's update notice are not the connection-refused error. Keep the checked-in versions while reviewing this fix; do not run `npm audit fix --force` or upgrade Astro just to dismiss a notice. If a dependency actually fails to install/build, inspect that error before changing versions.

Current test evidence and limitations: `docs/VERIFICATION.md`. Real browser/phone execution remains a required team release check; DOM/style checks are not a screenshot review.
