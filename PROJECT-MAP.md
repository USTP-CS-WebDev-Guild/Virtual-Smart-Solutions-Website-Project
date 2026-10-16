# Where each part lives

```text
frontend/             Pages and browser code                 FRONTEND
  pages/              URL routes: /, /contact/, /admin/
  components/         Reusable UI: Brand, forms, navigation
  scripts/owner/      Workspace behavior, split by feature
  lib/                Sign-in, live events and public-catalog rendering
  styles/             Design tokens and responsive CSS
  public/             Static assets copied as-is
backend/              Server application                      BACKEND
  app.ts              Request dispatcher and shared staff gate
  routes/             Feature endpoints
  validation/         Zod input contracts
  services/           Notifications and published content
  domain/             Business rules independent of HTTP
  database/           Canonical SQL, owner setup, install bundle
  functions/          Thin Netlify hosting adapters
shared/               Public content defaults and contracts   SHARED
  site-content/       defaults.ts + validation.ts; copy, services, packages, work, team
  release.ts          Application release marker
devops/              Infrastructure and runbooks              DEVOPS
  local/              Classroom database/auth/event adapters
  scripts/            Setup, start, build, verify, backup
ui-ux/                Design guidance and acceptance checks   UI/UX
project-management/   Team roles, backlog, templates          PM
tests/               Same role and feature boundaries        EVERYONE
docs/learning/       Guided exercises
.github/              CI, optional backups, PR/issue templates
.vscode/              Tasks and recommended extensions
```

Start with your role folder. You do not need to understand every infrastructure file to make a good first contribution. `node_modules`, `.astro`, `dist`, `.local`, and `.netlify` are generated; do not edit or commit them.

## Trace one inquiry

1. `frontend/pages/contact.astro` renders `components/InquiryForm.astro`.
2. That form uses `scripts/submission.ts` to POST `/api/inquiries`.
3. `backend/app.ts` sends the request to `routes/public.ts`.
4. `validation/forms.ts` checks it; `security/rate-limit.ts` enforces the limit.
5. PostgreSQL `submit_inquiry` saves the inquiry, event, and outbox together.
6. The metadata revision changes. The owner browser refetches the authorized inbox API.
7. `scripts/owner/inquiries.ts` renders the updated list and saved package snapshot.

For catalog changes, trace `scripts/owner/catalog-editor.ts` → `/api/admin/site-content` → PostgreSQL publication/revision → public signal → `scripts/site-content.ts` → `lib/public-content.ts` (revision and section comparison) → `lib/public-catalog.ts` / `lib/published-list.ts` (only affected rows). See OWNER-GUIDE.md for what is editable without a source change.

Same feature code in both environments: local DevOps adapters supply PostgreSQL/auth/events; Netlify supplies the hosted Supabase client. A browser cannot choose or inject a server database.

## What can cross the boundary?

Public browser: published content, public signal metadata, its own form receipt. Staff browser: authorized records fetched through the API. Owner browser: additional privacy/editor actions. Secrets never belong in `frontend/`, `shared/`, or any `PUBLIC_` variable. See [backend/API.md](backend/API.md).
