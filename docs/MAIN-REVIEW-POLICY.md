# Production release policy for a solo owner and student contributors

The instructor (`@franku69`) currently works alone on releases and also reviews student contributions. A PR authored by this account cannot receive its own approving review. Production changes still use a PR and passing CI; a narrowly assigned owner exception makes solo releases possible.

## Two active rulesets are required

Both target only `refs/heads/main`.

| Ruleset | Bypass | Requirements |
| --- | --- | --- |
| Production main - required checks | Empty for everyone | PR required with zero approvals in this layer; resolved conversations; up-to-date Ubuntu/Windows CI from GitHub Actions; force pushes and deletions blocked. |
| Production main - reviewed releases | Only user `franku69`, ID `150372008`, for pull requests only | One approval, Code Owner review, independent latest-push approval and dismissal of stale approvals for actors without the exception. Its duplicate CI/history rules are also enforced by the first ruleset. |

The first ruleset is `.github/rulesets/production-main-guardrails.json`. The second is `.github/rulesets/production-main.json`. Editing these files does not apply live GitHub settings.

GitHub aggregates applicable rulesets. An exception in the review ruleset does not grant an exception in the separate required-checks ruleset. The owner therefore still needs a PR, both successful checks and resolved review conversations. Direct pushes, force pushes and branch deletion remain blocked by the first ruleset.

The review exception applies when `franku69` merges a PR, including a student-authored PR if the owner deliberately uses the exception. Other accounts cannot use it. A student merging without the owner exception needs the required Code Owner approval. This is owner-controlled release authorization, not independent peer review of the owner's own work. Bypasses are recorded by GitHub; use `pull_request`, not an unlogged `exempt` mode.

`.github/CODEOWNERS` assigns `* @franku69`, with the same owner on all later, specific paths. `/.github/` includes the ownership policy itself. The reviewer must have Write access. GitHub uses the PR base branch's CODEOWNERS file; the all-file default takes effect after this change reaches main. Students should have Write access for feature/staging collaboration, with repository administration reserved for the intended maintainers.

## Install the live settings in this order

On 2026-11-01, read-only API checks confirmed the existing active review ruleset ID `26264437`, main commit `2cc6a58e0647366e3451dbd7478c33a0c2783861`, PR #18 open under `franku69`, and only that existing ruleset enforcing main protection. The owner's public GitHub profile confirmed user ID `150372008`. These are preparation observations, not confirmation that the new settings have been applied.

1. Download/import `production-main-guardrails.json` using repository **Settings → Rulesets → New ruleset → Import a ruleset**. Keep the name **Production main - required checks**, enforcement **Active**, target **main**, and the bypass list empty. Verify both required contexts have GitHub Actions as their source and that branches must be up to date. Create the ruleset.
2. Confirm that the new ruleset is saved and active, independently requiring a PR, both checks, resolved conversations, blocked force pushes and restricted deletions. A read-only rules API result should identify these controls under the new ruleset's ID. Keep it active before configuring the review exception.
3. Edit the existing **Production main - reviewed releases** ruleset, ID `26264437`. In **Add bypass**, select only the exact user `franku69` and choose **For pull requests only**. Keep its existing review requirements and save. The JSON template uses the verified numeric User ID. If the UI does not offer individual users, inspect that limitation before selecting any broader role or team.
4. Check that the required-checks bypass list is still empty and the review bypass list contains only this user in PR-only mode. Giving the existing combined ruleset an exception without the independent required-checks layer would also permit skipping its CI requirements.

The zero-approval setting belongs only to the required-checks layer; the existing review layer continues to require one Code Owner approval for users without the owner exception. There is no need for a second account belonging to the same person or another replacement branch.

## Reuse the existing reviewed change and PR #18

PR #18 already contains the all-file Code Owner update and Vite fix. Commit `c00228ed8e3a3dff175f7e578d66adf352b31416` on `security/production-review-policy` and cherry-pick `e892bf18c4908936a421dcee1fcf254efb23c9ef` on `security/production-review-policy-reviewed` have identical trees. This follow-up patch applies to either tree; use the original PR branch to update PR #18.

Preserve any modified or staged project files before switching. Untracked downloaded patches can stay in the repository folder. From that folder:

```powershell
git status --short
git switch security/production-review-policy
git apply --check .\vss-solo-owner-policy.patch
git apply .\vss-solo-owner-policy.patch
git add -- .github/CODEOWNERS .github/rulesets/production-main.json .github/rulesets/production-main-guardrails.json docs/MAIN-REVIEW-POLICY.md SOURCE-CHECKSUMS.sha256
npm run security:check
npm run security:audit
git --no-pager diff --cached --check
git --no-pager diff --cached --stat
```

The follow-up changes only those five files; the complete PR against main contains seven files, including the inherited package/lockfile fix. If any command fails, inspect that failure before continuing. After checking the exact diff:

```powershell
git commit -m "Support solo owner releases while keeping CI mandatory"
git push
```

Update PR #18's description to explain the two rulesets and deliberate solo-owner exception. Use the title **Require owner-controlled releases and patch Vite tooling**. The new push reruns both required jobs. Confirm the exact latest commit passes both Ubuntu and Windows jobs, inspect all changed files and resolve conversations. Then use GitHub's PR merge action with the recorded owner review bypass. This action is release authorization; it does not produce a self-approving review. Keep the separate required-checks ruleset active with no bypass.

Main's application release remains 1.6.4; staging 1.6.10 is a separate application promotion. This change does not relabel or promote the staging site.

## Verification and inherited build-tool fix

The underlying main change pins Vite 6.4.5 to clear a moderate audit failure in Vite 6.4.4 ([GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj)). Resolved dependency-version comparison changes only Vite. The advisory concerns an exposed development server, not evidence of a compromise of the static hosted website.

Before this policy-only follow-up, the user confirmed 240 tests, 31 browser tests, type checks, the build, source credential and whitespace checks passed, with zero reported audit vulnerabilities. The main build verified eight routes, 90 local asset references and footer contrast at a minimum of 13.58:1 across 266 checks. Counts belong to main's 1.6.4 baseline, distinct from staging 1.6.10's 313 tests and 38 browser tests.

This follow-up changes policy JSON, CODEOWNERS comments, this document and checksums. It leaves executable application files, dependencies, migrations and deployment environment values untouched. Configuration checks cover both actors' applicable rules, required-check sources, ownership coverage, canonical checksums and clean patch application. They are preparation checks; actual GitHub enforcement and bypass audit records must be verified after the settings are saved. Existing application suites need not be repeated locally for these policy/comment changes; the required CI jobs rerun on the updated PR.

The regenerated manifest also includes pre-existing baseline corrections to an installer hash and two already-tracked migration entries, inherited from the original main patch. Those SQL files are not changed. This follow-up is not an ASVS conformance claim. Record the solo-review exception explicitly in any later assurance assessment; the separate ASVS baseline documentation patch remains pending.

## Post-configuration evidence

- Both rulesets are active and target main; only the review layer has the exact owner PR-only bypass.
- The effective main rules API includes the independent required-checks ruleset's two checks, strict freshness, PR, conversation and history protections.
- The latest PR commit's successful jobs originate from GitHub Actions, integration `15368`.
- Rule Insights records the owner's review-layer bypass for the merge. Do not test protection with a destructive push or branch deletion.
- After merge, main contains `* @franku69` and both JSON templates. A later genuine student PR should request the owner and remain blocked for the student until required review/checks pass.

To return to mandatory independent reviews when another trusted reviewer is available, remove the owner exception from the review ruleset after arranging eligible Code Owners and the review workflow. The separate required-checks layer remains applicable.

References: [GitHub rule layering](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [PR-only bypass](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository), [User bypass and rule parameters](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset), and [CODEOWNERS base-branch behavior](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).
