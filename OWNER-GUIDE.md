# Owner workspace

## Sign in

Open the public website, scroll to the footer, and choose **Owner sign-in**. You can also open `/admin/`. Local: use the generated owner account printed by `npm run dev` or `npm run accounts`. Hosted: use your Supabase Auth user, with an active `owner` entry in `staff_users`. Local passwords do not work on a hosted deployment.

Public visitors need no login. Staff login protects all private records on the server; scrolling a signed-out page cannot open the workspace.

## Follow a request

| Public action               | Owner destination |
| --------------------------- | ----------------- |
| Contact inquiry             | Inquiries         |
| Inquiry → Convert to client | Clients           |
| Separate privacy form       | Privacy requests  |

Open an inquiry to see its service, requested package and displayed price at submission, message, notes, history, and notification state. Add a note, set status, or explicitly convert it. Conversion is repeat-safe. A package inquiry does not create a subscription, charge, or automatic client.

For privacy requests, verify the requester through the business's approved process before sharing/deleting data. Record the handling action. Do not use sensitive real data while testing.

## Publish website content

Choose **Website editor**, then Page copy, Services, Packages, Our work, Team or Questions. Switching sections keeps the draft; **Save and publish** saves all sections together. Changes are drafts until you choose **Save and publish**. Keep the public page open in another tab: a successful publish pushes an update without a manual reload. A revision conflict asks you to reload rather than overwrite someone else's work. If you have an unsaved draft when another owner publishes, the editor preserves it and shows a notice.

| Editor area            | What you can change                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Business and page copy | Names, approved email, headings, introductions, pricing terms                                      |
| Services               | Names, descriptions, examples, local image paths, order and visibility                             |
| Questions              | FAQ questions/answers and visibility                                                               |
| Packages               | Name, displayed price/period, description, features, order, visibility and one highlighted package |
| Portfolio              | Work title/category, scope or verified outcome, image, kind, permission approval and visibility    |
| Team                   | Name, role, introduction, portrait path, order and visibility                                      |

**Add** creates an unpublished draft. Complete it and check its publish option when ready. Use the arrows to reorder, or uncheck publication to hide an item. Removing an item affects the catalog, not an existing inquiry's package snapshot. Only one published package can be highlighted. At least one service must remain published.

Portfolio entries can be **Illustrative engagement** or **Verified client case study**. A published case study requires the owner's verification/permission checkbox. Approval is your record of a real review; the software cannot verify a client's claim or consent for you. Do not turn an example into a real case study without evidence.

**Revision history** lists saved versions. Restoring creates a new published revision after confirmation. It does not erase the audit history.

## Images and page layout

The image fields accept local paths such as `/images/service-admin.webp`. They do not accept arbitrary remote URLs or uploaded files.

To add a new image, ask your frontend contributor to put the approved file in `frontend/public/images/`, commit it and redeploy. Then use its `/images/filename.webp` path in the editor. Portfolio/team image fields show a preview. Existing files are listed in `docs/ASSET-SOURCES.json`. Confirm image rights and portrait permission before publishing.

Page sections, logo geometry, hero photo and design styles are source changes in `frontend/`. The editor manages the catalog and marked copy; it is not a drag-and-drop page builder. Search-engine fallback copy and social preview metadata are built from source and need a rebuild to change.

## Live state and email

The workspace shows the live connection state. Reconnection reconciles changes missed while offline; it does not replace a note you are typing. Use **Refresh** if a connection is unavailable, and ask the maintainer to check readiness if the issue continues.

Test mode provides **Check contact form**, **Verify live delivery**, and **Run test jobs**. Captured notifications prove the queue was processed; no email was sent. Real mail requires a configured provider and verified sender. The inquiry remains in the inbox even if mail fails.

Owner/staff accounts and access are managed by the maintainer in Supabase; there is no public registration. Signing out clears private workspace content.
