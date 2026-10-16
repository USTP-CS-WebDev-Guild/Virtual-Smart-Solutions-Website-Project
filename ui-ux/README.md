# UI/UX — make the real flows usable

**First task:** run `npm run dev`, use the full system at phone width, and write three specific observations. No cloud account is needed.

VSS uses black/charcoal `#101116` / `#202228`, white `#ffffff`, light surfaces `#fafaf9` and a restrained blue accent `#2457d6`, Bricolage Grotesque headings and DM Sans body text. Public layout is in `frontend/styles/vss.css`; shared form/workspace foundations are in `global.css`. The shared brand markup is `frontend/components/Brand.astro`. Assets and their sources are recorded in `docs/ASSET-SOURCES.json`.

| Person              | Flow to design and verify                                                |
| ------------------- | ------------------------------------------------------------------------ |
| Visitor             | Understand offer → service/package choice → inquiry → real receipt/error |
| Staff               | Sign in → inquiry → note/status → convert → client status                |
| Owner               | Staff flow + catalog publish/history + privacy handling                  |
| Keyboard/phone user | Same actions with readable labels, visible focus and useful targets      |

A package selection expresses interest; it does not buy anything. Work examples must stay visibly illustrative until there is a verified, approved client case. Inquiries, clients and privacy requests have different destinations. Empty queues are valid; never add fake records just to fill a screen.

Preserve unsent messages if a catalog changes and preserve staff notes during live updates. An unavailable package needs an explanation and a new selection. Signed-out visitors must never see the private workspace below the login.

Create a handoff using `templates/design-handoff.md`: screen, copy, loading/empty/error/success states, phone layout, keyboard behavior and acceptance criteria. Use [RESPONSIVE-CHECKLIST.md](RESPONSIVE-CHECKLIST.md). Verify changes through a real save/publish, not a visual mockup alone.
