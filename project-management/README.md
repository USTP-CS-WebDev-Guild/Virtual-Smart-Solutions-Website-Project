# Project management — small, testable deliveries

**Your first task:** run the product, then create an issue for one observable improvement. Use `templates/work-item.md` and [BACKLOG.md](BACKLOG.md).

Keep one issue per outcome. Assign an owner and reviewer, list the affected roles, and write acceptance in user language: “An inquiry submitted at 390px appears in the already-open staff inbox with a saved reference.” Avoid “make it better.”

Suggested board: Ready → In progress → Review → Verify → Done. Move an issue to Done only when the acceptance criteria and validation evidence are present. Do not require paid project-management tools; GitHub issues/projects or a shared document are sufficient.

Coordinate frontend/backend using `../backend/API.md`, and UI/UX using the handoff template. Ask DevOps for the exact commit and deployed test URL. Keep production credentials and customer records outside project notes. A failed hosted configuration is a setup issue with evidence, not a reason to reset passwords repeatedly.

For a release use `templates/release-record.md` and `../devops/RELEASE_CHECKLIST.md`. [TEAM.md](TEAM.md) explains responsibilities and review boundaries. Definition of done: user flow works, relevant checks pass, phone and authorization behavior verified, docs updated, and limitations recorded.
