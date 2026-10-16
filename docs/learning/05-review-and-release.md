# 5. Review and release one change

Goal: make a contribution someone else can assess.

1. PM writes an issue with one outcome, scope, and acceptance criteria.
2. UI/UX defines loading, empty, error, success, phone, and keyboard behavior.
3. Frontend/backend agree on the API contract if it changes. Implement on a branch.
4. Run `npm run verify`. For relevant browser behavior, run `npx playwright install chromium` once and `npm run test:browser`.
5. Open a PR. Include the result, relevant evidence, migration if any, and limitations. Do not paste `.env`, logins, or real records.
6. Instructor reviews sensitive paths. PM checks acceptance. DevOps deploys a reviewed commit using `devops/DEPLOYMENT.md` to the team's isolated hosted test project.
7. Open the published link in an incognito window/phone with no Netlify login. Run the deployed verifier and authenticated live-delivery checks. Record the exact commit.

The student tech lead approves promotion; the DevOps lead deploys reviewed source into the separate client production environment. Local PostgreSQL files and account passwords are never deployed.
