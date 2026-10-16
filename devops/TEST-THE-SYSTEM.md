# Test the whole product

Local: `npm run dev`, generated owner/staff accounts. Hosted: your own published URL and Supabase staff accounts. Use synthetic names/emails only.

1. Public pages open in an incognito window with no provider login. On hosted run `npm run verify:deployment -- https://your-site.netlify.app`.
2. Owner sign-in in the footer opens the login page. Scrolling while signed out never reveals the workspace. Invalid credentials get a clear error.
3. On `/services/`, choose a service CTA and confirm prefill. Choose **Discuss Professional**, confirm the package prefill, and check its displayed terms. Sign in as owner in one window; open `/contact/` in another. A valid submission shows a saved reference and reaches the already-open inbox without manual refresh.
4. Retrying the same submission key does not create a second inquiry. A new inquiry using the same recent email is flagged for review rather than discarded.
5. Open the inquiry, change status, add a note, inspect audit history, convert to client. Clients update; another conversion cannot create a second client. Test client active/paused/closed.
6. Submit the form on `/privacy/`. Only the owner can see/process it. Verify identity using synthetic test evidence and record handling. Test deletion on disposable records, including linked notes/client details.
7. Website editor: publish package pricing, a team role and a work title to already-open pages. An unpublished draft must remain hidden; an unapproved client case study must fail with a useful error. Keep a visitor message in progress and confirm it survives a price change. Withdraw its selected package and confirm review is required. Then publish a heading while the home page is already open. It updates through a pushed event. A second editor with an old revision gets a conflict; do not overwrite unsaved drafts.
8. In test tools, Check contact form / Verify live delivery / Run test jobs. Capture mode processes notices without sending. Inbox data survives email failures.
9. Staff can handle inquiries/clients, cannot read privacy/editor APIs, even by requesting the URL directly. Signed-out APIs return 401; forbidden roles 403.
10. Sign out; private DOM is cleared. Reconnect/focus recovers missed updates. At 320/390/768/1440px there is no horizontal overflow; keyboard and 16px phone form controls work.
11. Local only: stop/restart dev, sign in again, check data persists. Hosted: close your laptop and open the public link on a phone; provider hosting runs independently.

Record exact commit, environment, browsers/widths, result, and limitations in the PM release record. A passing build is necessary but is not an end-to-end hosted test.
