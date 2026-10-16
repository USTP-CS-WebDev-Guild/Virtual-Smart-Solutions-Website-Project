# 2. Trace a request and reject invalid input

Goal: understand frontend, backend, and database responsibilities.

1. With `npm run dev` running, open browser Developer Tools → Network. Send a synthetic contact inquiry.
2. Inspect POST `/api/inquiries`: the request JSON includes a UUID idempotency key; the response contains a saved inquiry ID. Do not publish screenshots with real data.
3. Follow `frontend/scripts/submission.ts` → `backend/app.ts` → `backend/routes/public.ts` → `backend/validation/forms.ts` → SQL `submit_inquiry` in `backend/database/migrations/0001_initial_schema.sql`.
4. Read `tests/backend/inquiry-workflow.test.ts`. Identify a test that proves real database behavior. Run `npm run test:backend`.
5. In your isolated local environment, try a request with an invalid service or a message below the minimum length (use your browser Network request editor or a test). It must reject the request and not create a new inquiry.

Proposed change: improve one validation message or add a justified constraint agreed with UI/UX. Keep frontend and backend consistent. Evidence: valid request still saves, invalid request is rejected, relevant regression test passes. Validation in the browser helps the user; validation on the server protects the system.
