# Frontend — pages and browser behavior

**Your first task:** run `npm run dev`, then improve one service card or contact helper text. You can use the full system without cloud keys.

| Need                                              | Open                                               |
| ------------------------------------------------- | -------------------------------------------------- |
| Homepage / page structure                         | `pages/index.astro`, other `pages/*.astro`         |
| Starting copy / services / packages / work / team | `../shared/site-content/defaults.ts`               |
| Reusable navigation, logo, forms                  | `components/`                                      |
| Design tokens and phone CSS                       | `styles/vss.css`, `styles/README.md`          |
| Contact receipt / retries                         | `scripts/submission.ts`                            |
| Owner inbox / clients / privacy / editor          | `scripts/owner/`, one file per feature             |
| API calls / session                               | `scripts/owner/api.ts`, `session.ts`               |
| Public live catalog rendering                     | `lib/public-content.ts`, `lib/public-catalog.ts`, `lib/published-list.ts`, `scripts/site-content.ts` |
| Package/work/team editor                          | `scripts/owner/catalog-editor.ts`                  |
| Animation and public interactions | `lib/motion.ts`, `lib/navigation.ts`, `lib/accordions.ts`, `styles/motion.css` |
| Push connection and recovery                      | `lib/live-updates.ts`                              |

Astro renders HTML; TypeScript adds browser behavior. There is no extra frontend framework to learn. The public pages load quickly from built HTML; live content and records come from the working API/database. `output: static` does not mean the forms or workspace are fake.

Follow [lesson 1](../docs/learning/01-first-change.md), then [lesson 2](../docs/learning/02-request-to-database.md). Use existing components and design tokens. `data-site-content` marks text supplied from the owner editor. Render user text with `textContent`; do not inject untrusted HTML.

Useful commands: `npm run test:frontend`, `npm run check`. For a standalone page task `npm run dev:frontend` is available; use full `npm run dev` for forms/login/live data.

Acceptance: no horizontal scrolling at 320/390/768/1440px, readable labels, 16px phone form controls, visible focus, errors read aloud through existing status regions, signed-out workspace hidden. Do not remove the global `[hidden]` guard. Never import server keys or database-admin code here.

The motion/design guide is [ui-ux/MOTION-AND-INTERACTIONS.md](../ui-ux/MOTION-AND-INTERACTIONS.md). New behavior uses ordinary TypeScript, native buttons/details/dialog and the existing published catalog.

Visible motion: `styles/motion.css`, `lib/motion.ts`, `components/ServiceTicker.astro`, `lib/service-ticker.ts`. The footer palette lives in `styles/vss.css`. Owner-only styles live in `styles/workspace.css`. Public pages have no technical test banner; retain test/noindex/capture configuration separately.

Public navigation uses real links with no full-page snapshots. Initial visible content appears immediately; later scroll entrances are restrained. The public theme is black/white/charcoal with blue accents; `tests/frontend/design-contract.test.ts` protects the no-green requirement. Read `../UPDATE-1.4.1.md` in the root when upgrading.

The first public API response is compared with the HTML catalog. Unchanged responses do not replace cards, images or controls. A changed publication updates only its affected sections; keyed rows retain unaffected DOM nodes. Do not restore an unconditional `replaceChildren()` on every response.

Mobile menu markup is in `components/Header.astro`; its layout is in `styles/navigation.css` and behavior in `lib/navigation.ts`. Service regions share a grid cell in `styles/experience.css`. Inactive regions use `visibility: hidden`, `inert` and `aria-hidden` to reserve equal space while keeping only the selected region interactive. This does not weaken the global `[hidden]` authentication guard.

## Owner workspace (1.5.0)

The owner application has an independent stylesheet so public design changes cannot accidentally recolor its controls.

| Need | File or folder |
| --- | --- |
| Sign-in and workspace shell | `pages/admin/index.astro` |
| Consistent owner colors and responsive layout | `styles/workspace.css` |
| Reusable owner SVG icons and editor markup | `components/workspace/` |
| Navigation, role-aware screens, mobile drawer | `scripts/owner/navigation.ts` |
| Sign-in and feature wiring | `scripts/owner/index.ts` |
| Overview and actual summary counts | `scripts/owner/overview.ts` |
| Inquiry list, notes, status, conversion | `scripts/owner/inquiries.ts` |
| Client / privacy / website workflows | Matching file in `scripts/owner/` |
| Reusable confirmation, search, image choices | `confirm.ts`, `search.ts`, `image-picker.ts` |

Start with a small issue in one feature. Read [OWNER-GUIDE.md](../OWNER-GUIDE.md), then trace an interaction through the API. Never replace server authorization with hidden UI buttons.

## Production authentication (1.6.0)

`scripts/owner/mfa.ts` handles authenticator enrollment/challenge; `lib/auth-storage.ts` scopes hosted tokens to this browser tab. `components/Captcha.astro` and `lib/captcha.ts` add the configured verification widget to contact/privacy/login forms. The backend and database still make every authorization decision. Local classroom startup remains independent of external CAPTCHA/MFA accounts.

Never store a server secret here, inject arbitrary CMS HTML, or open private screens merely because a client SDK reports a user. The API must accept the approved identity/MFA/session first. See `../SECURITY-UPGRADE-1.6.0.md` and the new frontend security regressions.
