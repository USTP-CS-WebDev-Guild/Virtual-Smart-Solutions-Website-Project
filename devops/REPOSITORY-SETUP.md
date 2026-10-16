# Publish the VSS project repository

This ZIP contains source without Git history. The project belongs in **your students’ team repository**. If that repository already exists, keep its clone/remote and follow `../UPGRADE-TO-1.2.md`; do not initialize a nested repo or move ownership to the instructor. For a genuinely new team repo, create it empty before the initial push. Choose public source for the Netlify Free multi-student contributor path; do not include keys or records. Do not initialize the GitHub repo with a README when pushing this source.

In VS Code open this project's root and run:

```powershell
git init -b main
git add .
git diff --cached --stat
```

Check that `.env`, `.local`, `.classroom-backups`, `node_modules`, and `dist` are absent. `git diff --cached` opens a pager on large changes; press **q** to leave it. Then:

```powershell
git commit -m "Add complete VSS website and owner system"
git remote add origin https://github.com/TEAM-OWNER/TEAM-REPO.git
git push -u origin main
```

Replace both placeholders with your team repository's actual values. If this is already a real clone, skip initialization and keep its existing remote. Do not copy files into nested folders and then run Git from the wrong parent.

In GitHub → Settings → General, enable **Template repository**. Students use **Use this template → Create a new repository**, then clone their own copy. They run `npm ci` and `npm run dev`; local accounts and data are generated separately.

For a shared team project, give each student a branch/issue and use pull requests. `.github/CODEOWNERS` is a commented example; replace accounts/teams before using it. GitHub feature enforcement varies by plan and repo visibility. Keep production credentials/deployment rights out of student-controlled repositories when branch protection is insufficient. CI uses no provider secrets.
