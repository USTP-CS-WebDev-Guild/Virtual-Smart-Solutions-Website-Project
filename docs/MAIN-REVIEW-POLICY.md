# Production review policy and build-tool patch

The instructor (`@franku69`) approves production changes. Students prepare and test changes on feature/staging branches. A separate production PR targets `main`; a successful staging deployment is not approval to promote it.

## Required controls

- `.github/CODEOWNERS` assigns the default pattern `*` to `@franku69`, including new frontend, documentation and other paths. More-specific existing entries have the same owner. The policy itself is owned through `/.github/`.
- The GitHub repository's active `main` ruleset requires one approval, Code Owner review, dismissal of stale approvals, approval of the latest reviewable push by another person, resolved conversations and up-to-date branches.
- Both `verify (ubuntu-latest)` and `verify (windows-latest)` must come from GitHub Actions (integration ID `15368`). Force pushes and deletions are blocked, with an empty bypass list.
- CODEOWNERS patterns assign ownership; they do not grant Write access or activate branch protection. The reviewer must have appropriate repository access. GitHub uses CODEOWNERS from the PR's base branch.

On 2026-10-31, a read-only GitHub API check confirmed `main.protected=true`, effective ruleset `26264437`, both required contexts pinned to integration `15368`, and a latest-push/Code Owner approval requirement. Actual GitHub Actions check runs for `134b6b8` identified that integration as GitHub Actions. This source template now preserves the chosen check sources; editing a template does not modify the active GitHub setting.

## Applying this policy update

This patch is based on **main commit `2cc6a58e0647366e3451dbd7478c33a0c2783861`**, whose application release is 1.6.4. Published staging is a later release; its application promotion remains a separate reviewed change. Application version, runtime code, database migrations and deployment environment values are unchanged.

The baseline main lockfile fails the required moderate-level audit because it contains Vite 6.4.4 ([GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj)). This patch pins the fixed build-tool version **6.4.5**, already used in staging. The resolved package-version comparison changes only Vite; it does not import the later CAPTCHA/MFA/homepage application changes. The advisory concerns an exposed development server, not proof of a compromise of the static hosted website.

The regenerated checksum manifest also aligns a pre-existing stale installer hash and two missing entries for migration files already tracked on main. Those SQL files are not modified by this patch.

A trusted teammate uses their own GitHub account and clean clone to apply, commit, push and open this PR. The instructor reviews and approves it. With the current rules, the instructor cannot approve a PR that they authored or satisfy the independent latest-push approval after making that push themselves. Keep the configured review/check controls enabled.

From the teammate's repository folder, with the downloaded patch in that folder:

```powershell
git status --short
git fetch origin
git switch --no-track -c security/production-review-policy origin/main
git apply --check .\vss-production-review-policy.patch
git apply .\vss-production-review-policy.patch
npm ci
npm run verify
npx playwright install chromium
npm run test:browser -- --reporter=line
git add -- .github/CODEOWNERS .github/rulesets/production-main.json package.json package-lock.json docs/MAIN-REVIEW-POLICY.md SOURCE-CHECKSUMS.sha256
npm run security:check
npm run security:audit
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
```

Preserve any existing local work before switching. If a check fails, stop at that failure and inspect it; do not use reset/force-push or weaken the rules to proceed. The staged diff should contain only the six policy/dependency/checksum files listed above.

After reviewing that diff:

```powershell
git commit -m "Require instructor reviews and patch Vite tooling"
git push -u origin security/production-review-policy
```

Open a PR with **base `main`**, compare `security/production-review-policy`. Suggested description:

> Requires instructor Code Owner review for all production files and preserves GitHub Actions as the expected source for both required CI checks. Pins Vite 6.4.5 to clear an existing moderate audit failure on main. Application runtime code is unchanged.
>
> Validation: clean dependency install; type checks, 240 tests and build passed on main's 1.6.4 baseline; source credential, checksum and whitespace checks passed; dependency audit found zero vulnerabilities. The patch was checked in a fresh checkout with Windows line-ending conversion. Browser discovery found 31 tests; full browser execution and required Ubuntu/Windows CI remain pending.

The teammate opens/pushes the PR; the instructor checks its exact diff, both required CI jobs and then approves. New pushes dismiss stale approvals and require another review. Main protection is already active; all-path Code Owner coverage takes effect after this change reaches `main`.

## Preparation verification

On 2026-10-31, the prepared change passed:

- `npm ci`: installed 320 packages from the final lockfile.
- `npm run verify`: no diagnostics across 182 Astro files; all 240 tests across 49 test files passed; the build verified eight routes, 90 local asset references and 266 footer contrast checks (minimum 13.58:1).
- `npm run security:check`: source credential check passed for 301 tracked files.
- `npm run security:audit`: zero vulnerabilities reported at the time of the check.
- `git diff --cached --check` and all 300 canonical Git-index source checksums passed.
- A fresh checkout of the exact main baseline accepted the exported patch with `core.autocrlf=true`; its staged blobs and checksums matched the prepared change.
- Browser discovery found 31 tests in two files. Full browser execution and the required Ubuntu/Windows GitHub Actions checks must still run before merge.

The counts above belong to main's older 1.6.4 baseline. They do not replace the separate 313-test/38-browser-test evidence for staging 1.6.10. This is a limited policy/build-tool change, not an ASVS conformance claim or approval of a production application release.

## Completion evidence

After the reviewed merge, verify the effective rules remain active and `main` contains the default owner line. Use a small ordinary PR authored by a teammate to check that a change outside the old sensitive-path list requests the instructor's review and remains blocked before the required approval/checks. Do not test with a direct push, force push or bypass.

This update neither protects `staging` nor promotes its application to production. Choose staging's collaboration rules separately. The ASVS baseline documentation patch is a separate, still-pending staging change.

References: [GitHub CODEOWNERS and base-branch behavior](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) and [ruleset review/check-source controls](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
