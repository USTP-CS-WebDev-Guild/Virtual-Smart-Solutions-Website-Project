# VSS 1.3.1 — fix npm ci / ETARGET

The 1.3.0 ZIP had corrupted dependency metadata in `package-lock.json`. A global replacement of the application version also changed unrelated dependency ranges and versions, including `source-map-js` and Rolldown. This was a packaging error. The frontend design and working system do not need to be rebuilt or downgraded.

This release restores the full original dependency graph and changes only the application version metadata. Do not fix this with `npm audit fix --force`, a global Astro install, a registry mirror, or a single source-map override: more than one entry was affected.

## Replace source and run

1. Stop dev with **Ctrl+C** if it is running.
2. Keep your existing `.env`, `.local` and `.git`. They hold your configuration, local database/accounts and repository history. Do not delete them.
3. Extract this ZIP elsewhere, then copy the **contents** of its `vss-website` folder into the existing project root beside `package.json`, replacing the source files. Do not create an extra nested project folder.
4. In the existing project terminal run:

```powershell
npm ci
npm run verify
npm run dev
```

Open **http://127.0.0.1:4321/** and keep the terminal running. `npm ci` recreates dependencies automatically; you do not need to manually delete the lockfile or run `npm install` first. If local startup prints credentials, those accounts are only for that computer. Use `npm run accounts` to show existing local accounts again.

The complete 1.3.0 frontend, backend, database files, owner tools and instant updates are retained. No database migration or new account/service is required. Hosted sites update through the team's normal reviewed GitHub/Netlify deployment.

For future releases, edit the application's `version` and the lockfile's root/package-root metadata explicitly. Never replace a version string across dependency records. Run installation from the **final** release files in a clean directory before packaging; validating before a lockfile edit does not validate the archive.
