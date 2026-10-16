# 4. Live updates without exposing customer data

Goal: understand an event as a signal to refetch authorized data.

1. Open the owner workspace and public home in two tabs. Publish a heading. The already-open home updates immediately after the event.
2. Open a private/incognito browser with the generated staff login. Staff must not have privacy/editor access. Send a new contact inquiry and see both authorized inboxes update.
3. Read `frontend/lib/live-updates.ts`, then the `change_signals` definitions and RLS in the second migration. Find why a public browser cannot read the staff/owner revision rows.
4. For local transport, DevOps can inspect `devops/local/server.ts`. It sends metadata via SSE after API commits. Hosted production uses Supabase Realtime. The feature UI follows the same refresh/recovery logic.
5. Sign out. Verify private elements are cleared and remain hidden when scrolling. Close/reopen the dev server: sign in again; saved records remain.

Evidence: role boundaries, two-tab delivery, and restart observations. Run `npm run test:classroom`. Do not stream inquiry bodies, bypass RLS, or introduce a 30-second timer to hide a broken connection.
