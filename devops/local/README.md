# Local classroom infrastructure

This folder removes cloud setup from the first lessons. Feature logic belongs in `backend/`, not here. The hosted Functions never import these modules.

| File           | Responsibility                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `settings.mjs` | Generate per-clone random accounts once; store scrypt password hashes and a private local access guide                 |
| `database.ts`  | Persist PGlite PostgreSQL, apply canonical migrations transactionally, reject changed checksums or duplicate processes |
| `auth.ts`      | Check local passwords, rate-limit login, issue/revoke expiring random sessions                                         |
| `postgres.ts`  | Adapt the application's small database API surface to parameterized PostgreSQL queries and whitelisted SQL functions   |
| `server.ts`    | Bind loopback HTTP, enforce host/origin, call the shared application, push metadata events and run maintenance         |

Browser adapter: `frontend/lib/classroom-client.ts`. It exposes only the sign-in/session and metadata operations used by the UI. The `import.meta.env.DEV` boundary excludes it from production bundles. Hosted Auth, PostgREST, and WebSocket integration are covered separately in the production-transport browser suite.

Local push delivery follows API/maintenance commits. Use the real API/editor for live tests; direct manual SQL edits are not a supported local event source. RLS filters signal metadata per active identity, and every private API checks its role again. No customer body is streamed. Local sessions reset with the process; records and accounts persist on disk.

Do not change the bind address, expose the dev server through a tunnel, or deploy this folder as a public backend. Follow ../DEPLOYMENT.md for the public hosted system. Tests live in `tests/classroom/` and `tests/e2e/classroom.spec.ts`.
