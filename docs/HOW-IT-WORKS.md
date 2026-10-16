# How the system fits together

Start with PROJECT-MAP.md for the file path of one inquiry. The same feature routes run locally and hosted.

Public form validation and abuse checks happen before a PostgreSQL transaction saves inquiry + audit event + outbox. A response includes the actual saved UUID. Network retries reuse the same key. Client conversion is explicit and unique per source inquiry. Privacy requests are separate and owner-only.

Staff identity is checked on the server for every API call, then matched to an active normalized-email role. The browser cannot grant itself a role. Only metadata revisions can be streamed; business records are fetched from authorized APIs. Pushed changes invalidate views immediately. Reconnection and focus reconcile missed state. Revision conflicts preserve the owner's unsaved content.

Default classroom mode uses embedded PostgreSQL, local scrypt-checked accounts, and SSE under devops/local. Hosted uses Supabase Postgres/Auth/Realtime and Netlify Functions. The local adapter is not a public deployment option. Both use the same canonical schema, routes, validation, and UI behavior.

Email is downstream of durable data. A five-minute maintenance job claims/retries notices and enforces retention. Tests capture delivery instead of sending. Deployment and backups have their own runbooks; credentials and real records stay outside student Git repositories.
