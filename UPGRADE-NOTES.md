# VSS upgrade from the supplied prototype

Reference inspected: https://vss-website-sigma.vercel.app/ on 2026-10-15. This project reuses the supplied brand direction and client content, with a new implementation on the existing student-friendly stack. The old Next.js bundles are not included or required.

| Area             | Prototype observed                                     | This release                                                                            |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Contact          | Browser timer displayed success without a network save | Validated transaction, real saved reference, owner inbox and error recovery             |
| CTA context      | Services/packages led to a blank inquiry               | Stable service/package links preselect the form; server saves a package snapshot        |
| Owner operations | Not exposed by the reviewed public prototype           | Authenticated inbox, notes, clients, privacy and website editor                         |
| Content          | Compiled public copy                                   | Published PostgreSQL revisions with conflict protection and live updates                |
| Work examples    | Client/results claims not independently confirmed      | Clearly labelled illustrative engagements; verified case studies require owner approval |
| Pricing          | Vague unlimited/coverage promises                      | Starting figures retained; hours, coverage and final terms require written scope        |
| Public access    | Vercel prototype                                       | Normal public Netlify URL with a separate app-level staff login                         |
| Team work        | Original application structure                         | Explicit frontend/backend/devops/UI-UX/PM boundaries and guided exercises               |
| Phone use        | Small controls and incomplete field labelling          | Associated labels, 16px phone controls, keyboard menu and responsive layouts            |
| Search/share     | Shared title; limited page metadata observed           | Per-page titles/descriptions/canonicals, sitemap and source-built organization metadata |

## Retained direction

Blue, cream and ink; Bricolage Grotesque headings and DM Sans body text; photographic cards and rounded controls; five service areas; supplied leadership names/portraits; public business email; Starter, Professional, Business and Enterprise package options.

Stock imagery illustrates a work setting and is not presented as a photograph of the VSS staff. The two named leadership portraits come from the client prototype. Source records and font licenses are included. VSS must approve the revised copy, biography wording, terms and portrait use before real launch.

## Stack and full-system boundaries

Astro/TypeScript for the public and owner UI, small Node/Netlify Functions API modules, PostgreSQL functions/transactions, Supabase Auth/Realtime in hosting. Default local development supplies persistent PostgreSQL, local accounts and pushed events without cloud keys. It uses the same feature routes and schema.

This is an inquiry-led service system. It does not sell subscriptions, take payments, provide a client self-service portal, upload images, or run a visual page-layout builder. Those were not working features of the reviewed prototype and are not silently implied by the package cards. Email capture is the default for safe testing.

## Database installation or additive upgrade

- **New VSS project:** run `backend/database/INSTALL-FRESH.sql` once on a new empty Supabase project. It includes all three canonical migrations. Create Auth users and the staff allowlist separately.
- **Existing compatible student-starter test project:** back up first, inspect which migrations have been applied, and apply only the new `20261015105552_vss_inquiry_package_context.sql` after review. Never run the fresh installer over existing data. Local startup automatically applies new canonical migrations.
- **Existing unrelated company deployment:** leave it alone. Use the new VSS accounts/repository described in the deployment guide.

The upgrade adds nullable package JSON and replaces the inquiry function without widening anonymous grants. Anonymization clears saved package context. Saved package snapshots do not change when the public package changes.

Source defaults never overwrite an already-published database revision. Old saved content loads with empty new catalogs and safe field defaults. Add the VSS packages/work/team through the editor, or start a new empty project for the supplied VSS default content. Do not reset real data to update copy.

No hosted site, GitHub repository, provider account or database was changed by preparing this release. Local/browser checks are recorded in `docs/VERIFICATION.md`; hosted Auth, replication, outbound mail and recovery must be verified in your own environment.
