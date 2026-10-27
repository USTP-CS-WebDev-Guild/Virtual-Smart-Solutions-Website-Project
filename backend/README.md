# Backend — real requests and business data

**Your first task:** trace a saved contact inquiry from `routes/public.ts` to PostgreSQL. Use [lesson 2](../docs/learning/02-request-to-database.md); no cloud project needed.

Production security: `security/` owns request/origin/CAPTCHA/abuse boundaries; `lib/auth.ts` validates immutable identity, MFA and live sessions. `database/migrations/20261027110215_harden_identity_and_sessions.sql` adds the persistent policy/session rules. Apply the steps in `../SECURITY-UPGRADE-1.6.0.md`; hiding a UI control never grants or revokes a role.

| Need                                   | Open                              |
| -------------------------------------- | --------------------------------- |
| All request entry points and role gate | `app.ts`                          |
| Inquiry create                         | `routes/public.ts`                |
| Staff inquiries, notes, conversion     | `routes/inquiries.ts`             |
| Clients / privacy / content editor     | Matching file in `routes/`        |
| Form schema                            | `validation/forms.ts`             |
| Business constants / normalization     | `domain/rules.ts`                 |
| Staff identity and role check          | `lib/auth.ts`                     |
| Notifications / content services       | `services/`                       |
| Tables, transactions, permissions      | `database/migrations/`            |
| Netlify hosting entry points           | `functions/` (thin adapters only) |

[API.md](API.md) is the contract with frontend developers. `app.ts` takes a standard `Request` and returns a `Response`; the same feature code runs locally and when deployed. DevOps supplies the local database/auth adapter. Production uses the native Supabase client. Request headers cannot select a database or bypass authorization.

Exercise: improve validation or a business rule and add a test that proves rejection/rollback. Do not begin by restructuring authentication. Schema changes need a new migration and tech lead review; see [database/README.md](database/README.md).

Run `npm run test:backend`, `npm run test:database`, and `npm run test:classroom`. Use `npm run verify` before review. Private reads require active staff; owner-only features remain owner-only. Browser roles cannot query business tables or call mutation RPCs directly. Never log submitted messages or access tokens.

Request-body limits/timeouts live in `http/body.ts`; `http/responses.ts` applies JSON content-type checks. The 1.2 security migration is additive; earlier applied migrations remain unchanged. See `../docs/SECURITY-REVIEW-1.2.md` and `../UPGRADE-TO-1.2.md`.
