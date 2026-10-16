# Team responsibilities

| Role                    | Delivers                                            | Coordinates with     |
| ----------------------- | --------------------------------------------------- | -------------------- |
| PM                      | Prioritized issues, acceptance, release record      | Everyone             |
| UI/UX                   | Flows, content, phone/focus/state requirements      | Frontend + PM        |
| Frontend                | Components, browser state, accessible user flows    | UI/UX + Backend      |
| Backend                 | Validated API, business transactions, tests         | Frontend + DevOps    |
| DevOps                  | Reproducible setup, CI, deployment and recovery     | Backend + tech lead |
| Instructor / maintainer | Sensitive reviews, production access, final release | All roles            |

Roles are responsibilities, not isolated silos. Every student runs the complete local workflow and can explain one request. Pair across roles for changes that cross the API boundary. Local databases are independent; the team hosted test project uses only synthetic shared records.

Students propose schema/auth/CI changes on branches. Instructor approval and restricted production account access are still required for a real client release. See CONTRIBUTING.md and TEACHER-GUIDE.md.
