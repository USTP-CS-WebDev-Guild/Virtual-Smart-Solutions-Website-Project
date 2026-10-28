# Database — one schema, two ways to run it

## Local classroom

`npm run dev` opens persistent embedded PostgreSQL, applies the canonical files in `migrations/` in order, and creates local owner/staff infrastructure accounts. It seeds no business records. The schema and business functions are the same as in Supabase. Data lives in ignored `.local/database/`; migration checksums prevent silently changing an applied schema.

Stop dev before copying/resetting local database files. `npm run reset:local -- --confirm-local-data` archives the entire local folder, including the account guide, into ignored `.classroom-backups/`. It does not contact any hosted project.

## New hosted Supabase project

Run `npm run db:prepare` if migrations changed. On a **fresh empty** project, run `INSTALL-FRESH.sql` in Supabase SQL Editor once. It contains all five checked-in migrations in a single transaction and refuses an existing application database. Then create/verify your Auth user and run the edited `owner-setup.sql.example` with that user's exact UUID and email. No password belongs in SQL.

`seed-test-data.sql` is optional synthetic sample data for your isolated test project. Do not run it in a client database. The local walkthrough generates data through the actual public forms instead.

## Tables by purpose

| Tables                                         | Purpose                                                |
| ---------------------------------------------- | ------------------------------------------------------ |
| `inquiries`, `inquiry_notes`, `inquiry_events` | Leads, follow-up, audited actions                      |
| `clients`                                      | Explicit repeat-safe inquiry conversion                |
| `privacy_requests`                             | Separate verified privacy workflow                     |
| `site_content`, `site_content_events`          | Published content and revision history                 |
| `outbox`, `webhook_events`                     | Durable notification and delivery deduplication        |
| `staff_users`                                  | Verified immutable Auth UUID membership and owner/staff role |
| `app_private.security_settings`, `app_private.staff_sessions` | Production MFA policy and server-verified session activity; never browser-readable |
| `rate_limit_buckets`                           | Keyed abuse counters                                   |
| `change_signals`                               | Three metadata-only revisions, the only streamed table |

Browser roles cannot read business tables or execute business mutation RPCs. The server uses its private key after HTTP authorization. The allowed signal scopes are RLS protected: public / active staff / owner. Do not broaden grants to fix a missing migration or misconfigured session.

## Add a schema change

Use Supabase CLI `migration new describe_change` to create a timestamped file, then move it into this folder's `migrations/` directory. Write a forward-compatible migration and a test. Rebuild the fresh installer with `npm run db:prepare`. Local startup applies new files automatically; an existing hosted database applies **only new migrations**, in order, after review. Never rerun the fresh installer over a deployed project.

Run `npm run test:database` for real PostgreSQL constraints, transactions, grants, and RLS, and `npm run test:classroom` for the local full system. These tests do not replace hosted restore and delivery checks.

## Existing 1.5.0 database → 1.6.0

Apply only `migrations/20261027110215_harden_identity_and_sessions.sql` after backup/review. It preserves business rows and binds uniquely matched verified staff identities once. Review any null `auth_user_id` privately and explicitly bind the intended verified account. Deleted/recreated users cannot inherit old membership by email.

Production then runs `SECURE-PRODUCTION.sql` after binding review. It enables mandatory MFA and live-session/idle/absolute checks in both private APIs and signal RLS. Do not run this activation on the shared classroom/staging project unintentionally. See `../../SECURITY-UPGRADE-1.6.0.md` for the complete order; it also explains Auth recovery and restore requirements.
