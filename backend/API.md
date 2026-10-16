# API map — frontend/backend handoff

Browsers call `/api/*` on the same site origin. `backend/app.ts` applies authorization before staff routes. Responses include `X-Request-ID`. Private responses are never public-cacheable. Keep personal data and tokens out of logs.

| Method     | Path                                               | Access / behavior                                             | Source in `routes/` |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------- | ------------------- |
| GET        | `/api/health/live`                                 | Public; no database required                                  | `system.ts`         |
| GET        | `/api/health/ready`                                | Public; database readiness                                    | `system.ts`         |
| GET        | `/api/health/notifications`                        | Public; status only                                           | `system.ts`         |
| GET        | `/api/public/content`                              | Public; published items only                                  | `public.ts`         |
| GET        | `/api/public/runtime`                              | Public; release, project URL, publishable key, test flag only | `public.ts`         |
| POST       | `/api/inquiries`                                   | Public; same origin, validation, honeypot, rate limit         | `public.ts`         |
| POST       | `/api/privacy-requests`                            | Public; same guards                                           | `public.ts`         |
| POST       | `/api/webhooks/resend`                             | Verified provider signature                                   | `email-webhook.ts`  |
| GET        | `/api/auth/session`                                | Bearer token; active role                                     | `system.ts`         |
| GET        | `/api/admin/summary`                               | Active staff/owner; counts                                    | `inquiries.ts`      |
| GET        | `/api/admin/inquiries?status=new&cursor=…`         | Active staff/owner; 50 per page                               | `inquiries.ts`      |
| GET        | `/api/admin/inquiries/:id`                         | Active staff/owner; detail and notification                   | `inquiries.ts`      |
| GET        | `/api/admin/inquiries/:id/events`                  | Active staff/owner; latest 100 audit entries                  | `inquiries.ts`      |
| GET / POST | `/api/admin/inquiries/:id/notes`                   | Active staff/owner; latest 100 notes / repeat-safe add        | `inquiries.ts`      |
| PATCH      | `/api/admin/inquiries/:id/status`                  | Active staff/owner                                            | `inquiries.ts`      |
| POST       | `/api/admin/inquiries/:id/convert`                 | Active staff/owner; repeat-safe                               | `inquiries.ts`      |
| GET        | `/api/admin/clients?cursor=…`                      | Active staff/owner; 50 per page                               | `clients.ts`        |
| PATCH      | `/api/admin/clients/:id/status`                    | Active staff/owner; active/paused/closed                      | `clients.ts`        |
| GET        | `/api/admin/privacy-requests?status=open&cursor=…` | Owner; 50 per page, optional open/completed filter            | `privacy.ts`        |
| PATCH      | `/api/admin/privacy-requests/:id/complete`         | Owner; identity verification and completion note required     | `privacy.ts`        |
| GET / PUT  | `/api/admin/site-content`                          | Owner; current revision required to publish                   | `content.ts`        |
| GET        | `/api/admin/site-content/history`                  | Owner                                                         | `content.ts`        |
| GET        | `/api/admin/site-content/history/:revision`        | Owner                                                         | `content.ts`        |
| GET        | `/api/admin/submission-checks`                     | Owner; non-secret server/database/realtime diagnostics        | `system.ts`         |
| GET        | `/api/admin/realtime-status`                       | Active staff/owner; metadata readiness                        | `system.ts`         |
| POST       | `/api/admin/test/live-check`                       | Owner, test+capture only; harmless metadata revision probe    | `notifications.ts`  |
| POST       | `/api/admin/test/run-jobs`                         | Owner; execute due notification/retention handlers            | `notifications.ts`  |
| POST       | `/api/admin/outbox/retry`                          | Owner; requeue one dead notice                                | `notifications.ts`  |

Paginated lists return `{inquiries|clients|requests, nextCursor}`. Send the opaque returned cursor unchanged. `null` means the last page. Ordering is stable by `created_at DESC, id DESC`; invalid cursors return 422. Notes/events are bounded recent-history views, not complete exports.

## Inquiry example — synthetic

```json
{
  "idempotencyKey": "c5e6d010-c81f-4be0-9392-ac620b8649e3",
  "name": "Test Contact",
  "email": "contact@example.test",
  "company": "Example Test Company",
  "phone": "",
  "service": "Virtual Assistant",
  "message": "Synthetic request for calendar support.",
  "requestedPlan": "professional",
  "privacyAcknowledged": true,
  "website": ""
}
```

Create one UUID per submission attempt and reuse it on retry. First saved inquiry returns 202 with `{ok:true,inquiryId,repeated:false}`; a repeated key returns 200 with `repeated:true`. A possible duplicate email is flagged rather than dropped. Honeypots receive a generic response without storing a record; the UI requires a valid saved UUID before showing receipt success. Privacy saves return `privacyRequestId`.

`requestedPlan` is optional: send a published stable package ID, not a browser price. The server creates the snapshot `{id,name,price,period,contentRevision}` stored on the inquiry. An unavailable package returns 422 `plan_unavailable` without a partial inquiry/outbox save. Staff inquiry detail includes `requestedPlan` or null. A retry keeps the first saved record; future public price changes do not rewrite it.

`/api/public/content` includes published services, FAQs, packages, portfolio and team only. Drafts stay private; a client case study requires owner approval before publication. Catalog images accept validated local `/images/` paths. Publishing returns field-specific validation errors or 409 on an outdated revision.

A note POST sends `{idempotencyKey,body}` (2–2000 characters). Client status PATCH sends `{status}`. Staff calls send `Authorization: Bearer <Supabase access token>`. Mutations also send JSON, the same-site Origin, and `X-Requested-With: VSSDashboard`; use `frontend/scripts/owner/api.ts`.

Typical errors: 401 unsigned/inactive staff, 403 forbidden role/origin, 409 stale revision/locked record, 422 invalid fields/cursor, 429 real rate limit with `Retry-After`, 503 unavailable service/setup. Missing submission protection fails closed with 503.

## Live connection contract

The browser uses its publishable key and signed-in JWT to SELECT/subscribe to **only `change_signals`**. Anonymous sees public; active staff adds staff; owner adds owner. Each event invalidates views; fresh records come through the authorized API above. The signal stream carries no customer information. Green Live requires server readiness and a successful state reconciliation, not just a joined socket.

## Workspace search (1.5.0)

Authenticated list endpoints accept optional `q` (trimmed, up to 100 characters; control characters rejected). Search checks all matching stored records before applying the cursor page.

| Endpoint | Search columns | Optional status |
| --- | --- | --- |
| `GET /api/admin/inquiries?q=...` | Name, email, company, service | new, in_progress, waiting, converted, closed |
| `GET /api/admin/clients?q=...` | Contact name, email, company | active, paused, closed |
| `GET /api/admin/privacy-requests?q=...` | Name, email | open, completed |

Privacy remains owner-only. Cursor, status, and search are combined with AND. Input becomes a quoted, regex-escaped literal substring filter; client input never chooses columns or supplies an arbitrary PostgREST expression. The classroom adapter uses bound PostgreSQL parameters. Search errors return 422 without executing a partial action. Search reads are `no-store`; avoid writing request query strings to logs because they can contain personal data. No new SQL migration is required.
