# Security review — release 1.2.0

Scope: uploaded VSS 1.0.0 source, public browser code, API request boundaries, authorization, SQL migrations, notifications and local/cloud separation. This is source hardening with automated tests, not an external penetration test or a guarantee against attacks. No client account, production database or live domain was modified.

| Finding | Change | Evidence |
| --- | --- | --- |
| Native form fallback could put details/passwords in a GET URL | Explicit POST actions, submit disabled until handlers register, and no-JS notice | Emitted-HTML build verification |
| JSON/webhook limits checked after fully buffering | Shared streaming reader bounds actual bytes, validates length/UTF-8, times out stalled input and cancels the stream | `tests/backend/body-limits.test.ts` |
| Mutation body type implicit | JSON API mutations require `application/json` | Body-limit and existing workflow tests |
| Malformed resource IDs reached SQL | Shared authenticated route gate validates UUID layout before feature queries/mutations | Route guard tests |
| Unbounded/malformed bearer inputs and unknown roles | Token length/whitespace bounds and explicit allowed-role check | Auth tests + route gates |
| Raw exception messages in application logs | Safe error class and small fixed configuration-error allowlist; request ID preserved | Log redaction test |
| Webhook metadata unchecked | Bounded identifiers/signature headers, valid timestamp window/key length, real HMAC verification retained | Webhook boundary tests |
| Server helpers carried unnecessary definer powers | Public business RPCs use invoker permissions; service role has explicit grants; browser CREATE denied | Real PostgreSQL service-role workflow and catalog/grant tests |
| SQL relied on HTTP-only field bounds | Additive NOT VALID constraints enforce safe bounds for new writes without deleting legacy records | SQL rollback/bounds tests |
| Rate-limit counter grew indefinitely inside a window | Saturates at limit+1; server-only RPC validates parameters | SQL rate-limit tests |
| Expired crashed email lease could exceed max attempts | Eighth expired lease becomes dead letter; network requests have a timeout | SQL retry-ceiling + outbox tests |
| Older content fetch could overwrite a newer revision | Revision guard prevents backwards application | Concurrent public-content DOM test |
| Client-managed text could become HTML if features used string templates | New interactions use safe DOM nodes/text; existing schemas restrict asset paths | DOM text-injection tests and content validation |

Preserved controls: same-origin/CSRF checks, private key outside browser, staff Auth verification plus active allowlist/role on every private API request, browser table/RPC denial, metadata-only Realtime with RLS, parameterized queries, transactional writes, idempotent conversion/submission/webhooks, append-only audit, privacy anonymization, CSP/security headers, local-only classroom credentials and synthetic test data.

## Deployment controls still owned by the team

- Disable public Auth signup; create/confirm staff users and active role rows. Use MFA for provider administrators and least-privilege individual memberships where available.
- Keep origins/keys/environment data isolated. Use the hosted verifier and actual owner live-delivery checks; local tests do not validate hosted Auth/provider configuration.
- Revoke/rotate any credentials ever exposed in chat, Git or screenshots before a client launch. Never use a secret key as `PUBLIC_SUPABASE_ANON_KEY`; preflight rejects that prefix/role.
- Apply only missing reviewed migrations; inspect legacy constraint violations before validation. Never broaden browser grants to make a feature work.
- Monitor readiness, notification failures and quotas independently. Per-source hashed rate limits and the honeypot reduce abuse; they cannot guarantee protection from distributed bots or volumetric denial of service. Provider protections/quota ceilings still apply.
- A stolen service-role key bypasses RLS by design. Protect/rotate it; database browser policies cannot compensate for exposing it.
- Confirm privacy/retention/deletion handling, approved mail sender and external encrypted backups/restore drills. Test staging recovery and deletion replay before launch.
- Native DOM/SQL tests do not replace phone/browser review, a hosted configuration review or an independent security assessment where the business requires one.

References checked 2026-10-15: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [function permissions](https://supabase.com/docs/guides/database/functions), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [API key handling](https://supabase.com/docs/guides/api/api-keys). Explicit grants are retained for new-table Data API defaults; no managed Auth/Realtime schemas are exposed by the new migration.
