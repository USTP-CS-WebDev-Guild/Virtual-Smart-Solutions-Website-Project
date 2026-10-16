# 3. Why conversion is repeat-safe

Goal: explain a business transaction without replacing it with client-side checks.

1. Create a local inquiry through the public form. Sign in as owner and convert it to a client.
2. Read `backend/routes/inquiries.ts` for the convert endpoint, then SQL `convert_inquiry` in the initial migration. Find the unique `clients.source_inquiry_id` constraint.
3. Read the repeat-safe conversion tests. Run `npm run test:database` and `npm run test:classroom`.
4. Explain what would happen if two staff members clicked convert at the same time and only the browser disabled the button. The database is the final authority.
5. Find the separate inquiry-create transaction that inserts inquiry, audit event, and outbox together. Explain what an email failure does to the saved lead.

Evidence: a short PR note naming the database guarantee and the test that proves it. Do not add another clients table or remove the unique constraint.
