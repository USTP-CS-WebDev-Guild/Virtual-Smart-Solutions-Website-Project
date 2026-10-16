# Responsive and accessible review

Record page, commit, browser/device, viewport, reviewer, and pass/fail in the design handoff. CSS breakpoints are not proof of browser behavior.

| Width / case                 | What to check                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| 320px / 360px / 390px        | No horizontal scrolling; readable body/labels; menu opens/closes and has focus; buttons not clipped |
| 768px                        | Cards/tablet layout; owner sidebar/content both usable                                              |
| 1024px / 1440px              | Hierarchy, line lengths, consistent CTA, cards and form alignment                                   |
| Phone portrait + landscape   | Form keyboard, select, textarea, error text, submit/loading state                                   |
| 200% browser zoom            | Reading order and actions remain reachable                                                          |
| Keyboard only                | Visible focus, menu, fields, validation messages, owner tabs/editor                                 |
| Reduced motion               | No required information depends on animation                                                        |
| iPhone/Safari when available | All phone form controls at least 16px; tapping avoids unwanted text zoom                            |

For each form test empty, invalid, loading, accepted, backend failure, and rate-limit states. Announcements must be understandable without color alone. For the owner UI test empty lists, long synthetic names/messages, notification errors, sign-in/out, and content conflicts.

Record unavailable real-device checks as pending; do not mark them passed from a desktop resize alone. Pair with Backend for real error responses and with Frontend for focus/ARIA behavior.

For release 1.4.1, also check the compact menu at 811px and a short landscape viewport. The menu must overlay rather than move the page, identify the current route, leave its action reachable, close on Escape/outside focus and restore closed after Back. Throttle the document request: clicking a new page must not collapse the menu to expose the old page while waiting. Quickly change services and work categories; the actual button must keep focus and the service panel must retain its dimensions. A heading-only publication must not close an open work detail.
