# Make this your team's project

Keep the working system; for another business replace VSS branding, copy and portraits with approved assets. Create your own GitHub template copy first. Never reuse the original company's database, keys, deployment, or branding.

## Change one thing at a time

| Change                                                 | File / tool                                                 | Needs                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------- |
| Starting copy, services, FAQs, packages, work and team | `shared/site-content/defaults.ts`                           | Source edit; dev reload / hosted build                |
| Published copy on a running site                       | Owner → Website editor                                      | Save and publish; live immediately                    |
| Logo symbol / wordmark layout                          | `frontend/components/Brand.astro`                           | Source edit                                           |
| Favicon                                                | `frontend/public/brand/mark.svg`                            | Source edit                                           |
| Colors, type, spacing, phone layout                    | `frontend/styles/vss.css` and shared tokens in `global.css` | Source edit                                           |
| Page sections / remaining sample copy                  | `frontend/pages/*.astro`                                    | Source edit                                           |
| Form fields                                            | Form component + `backend/validation/forms.ts`              | Follow the backend lesson before changing persistence |
| New stored data                                        | New SQL migration + API + tests                             | Backend and instructor review                         |

`defaults.ts` is the initial public fallback, not a database migration. Once an owner publishes content, the saved database revision wins. Editing a fallback never silently overwrites the owner's work. Use Website editor to update that project, or archive/reset disposable local data to return to defaults. A fresh team/database starts from the current defaults with no customer records.

To change editable content shape, update `shared/site-content/defaults.ts`, `validation.ts`, editor fields, rendering, and tests together. Keep stable IDs for services, FAQs and packages already in use. Do not hardcode another student's account identifiers.

## Replace the sample honestly

This version is the Virtual Smart Solutions client project. You can make it a design service, tutoring service, repair business, or another inquiry-led business. It is not an e-commerce checkout, payments system, medical-record system, or multi-tenant SaaS. Those require separate scope and security design.

Write your own offer and process. Use only real, approved photos, testimonials, rates, and results. Fill business/privacy email values only with addresses approved for publication. Leave optional sample mail blank until then. Search all page copy for the old sample business before handoff.

## Keep the useful boundaries

Keep validation, server authorization, transactions, idempotency, audit history, outbox reliability, RLS, and privacy handling. A UI redesign should not remove them. Do not enable local classroom authentication on a public host; production uses Supabase Auth.

Run `npm run verify`, then the browser walkthrough. Complete [devops/RELEASE_CHECKLIST.md](devops/RELEASE_CHECKLIST.md) before collecting real data.
