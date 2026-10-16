# Small changes, clear reviews

1. Read `START-HERE.md` and your role README. Run the complete local system.
2. Choose one PM issue with observable acceptance criteria. Create a branch: `git switch -c frontend/service-card` (use your role/topic).
3. Change the smallest relevant feature. Use synthetic data and explain any API/design contract change to the other role.
4. Run the relevant role test command while working. Run `npm run verify` before a pull request. Use browser tests for user-flow, layout, auth, or live-update changes.
5. Open a PR using the template. Include the problem, result, validation, screenshots for visual changes, and any migration. Ask a teammate for review.
6. Instructor reviews auth, database, CI, deployment, backups, and secrets. PM records acceptance; a maintainer merges.

Do not commit `.env`, `.local`, records, credentials, dependencies, or generated builds. Check `git diff --cached --stat` and `git diff --cached` before committing. Do not paste terminal logins into issues. If `fatal: not a git repository` appears, open the actual cloned/template repository; do not reinitialize a different folder over it.

Do not rewrite applied migrations. Add a new migration through Supabase CLI `migration new describe_change`, move the generated file into `backend/database/migrations/`, implement it, and regenerate `npm run db:prepare` for fresh installs. Existing deployments apply only the new file. Local startup tracks migration checksums and stops if an applied file changed.

Required code behavior: bounded input, real server authorization for private data, no personal details in logs/events, repeat-safe submission/convert actions, clear loading/error states, keyboard and phone accessibility. Explain why a new test catches a real failure; skip tests that only repeat the implementation.
