# Instructor setup and teaching flow

This is the VSS client project with a beginner-friendly teaching structure. Application code is MIT licensed; client branding and portraits have separate permissions in NOTICE.md. Existing live sites and accounts are untouched. Default local work needs only Node and VS Code. Each student's clone owns its own persistent local database and different random credentials; GitHub never syncs that data.

## Before class

- Extract and run `npm ci`, `npm run dev`. Submit an inquiry, convert it, publish a heading, and send a separate privacy request.
- Push the clean source into a **new** repository. Enable Settings → General → Template repository. Use [devops/REPOSITORY-SETUP.md](devops/REPOSITORY-SETUP.md).
- Students choose **Use this template → Create a new repository**, then clone their copy. They do not need Netlify/Supabase keys to begin.
- Keep one instructor-owned team test deployment if collaboration needs shared live records. Students use only synthetic data. Client production uses separate accounts and credentials.

## Suggested first sessions

| Session | Everyone sees                                   | Role work                                               |
| ------- | ----------------------------------------------- | ------------------------------------------------------- |
| 1       | Contact → inbox → client; separate privacy flow | Change a section, inspect one request, write an issue   |
| 2       | One form request traced end to end              | Frontend builds; backend validates; UI/UX checks mobile |
| 3       | Two tabs see a published change live            | Backend tests; DevOps CI; PM records acceptance         |
| 4       | A reviewed release on public HTTPS              | Instructor configures cloud once, team verifies flows   |

The detailed exercises are in `docs/learning/`. Let roles overlap: beginners should run the whole product before specializing. Do not assign the most sensitive infrastructure to the least experienced learner without review.

## Review boundaries

Students may edit every source area on a branch. That does not grant permission to deploy or read client data. Keep production GitHub/provider access with maintainers. Require your review of database/auth/server guards/CI and secrets. CODEOWNERS is a commented template until you replace the account/team names; branch protection depends on your GitHub plan. Use a separate restricted production repo when student branches cannot be safely isolated from production credentials.

## Assessment evidence

Ask students to show one real user action, the file path implementing it, the server check protecting it, and a test or manual observation proving it. A screenshot alone does not prove a database save. Have PM keep a small release record with the exact commit, tests, browser widths, and known limitations.

## Honest launch standard

The engineering features are preserved. The draft privacy notice, revised package terms and biographies, case-study permissions, email delivery, capacity planning, and hosted restore drill still need the client's decisions and actual environment verification. Do not describe local tests as hosted production certification. The Free tiers can stop at quotas or inactivity; there is no honest promise of unlimited forever-free hosting.
