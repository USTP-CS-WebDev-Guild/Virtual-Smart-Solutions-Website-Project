# VSS public design and motion — 1.4.1

The client's supplied screenshot is the visual reference. Use white/light content with black/charcoal sections and blue only as a small brand/interaction accent. Do not introduce green, mint, teal, decorative orbit graphics or color gradients on headings/buttons. Image shades for readable captions are allowed; photographs retain their natural colors.

| Purpose | Value / treatment |
| --- | --- |
| Black / charcoal | `#101116`, `#202228` |
| White / light surfaces | `#ffffff`, `#fafaf9`; hero `#f8f7f4` |
| Main text / secondary text | `#14161c`, `#626874` |
| Brand blue | `#2457d6` |
| Active navigation | Blue text on `#edf2fc`, without sliding/stretching pills |
| Photography | Retained local photographs, controlled neutral shade for text |
| Type | Locally hosted Bricolage Grotesque + DM Sans |

## Navigation and movement

Public links use normal browser navigation. Do not add full-document snapshots, cross-fading headers, loading curtains or page-sized slides. The old native View Transition opt-in, names and listeners have been removed. The small preference script is deferred and cannot hold up first rendering.

Content already in the viewport is readable immediately. Only later scroll entries use a short 340ms / 10px entrance with at most 60ms stagger. Service/filter changes use a single 160ms opacity response from 94% to 100%; controls and images are retained. They do not translate the grid and its child cards at the same time. Avoid combining parent and child animations or replaying portraits on every scroll.

Ambient motion stays limited to hero cards, gentle photo movement and the expertise marquee. CSS transform effects pause off-screen and in hidden tabs. Dots separate the expertise labels; there are no rotating star/orbit decorations. Controls retain short focus/hover feedback, a measured FAQ/comparison expansion and a mobile menu that does not shift the page.

Both pause buttons stay synchronized; `vss-motion` stores the visitor's choice. OS reduced motion wins. Existing keyboard, Escape, focus restoration, form errors/receipts and live publication behavior must remain independent of an animation completing.

## Find the code

| Change | Open |
| --- | --- |
| Public palette / layouts / phone rules | `frontend/styles/vss.css` |
| Brand | `frontend/styles/brand.css` |
| Chooser / filters / dialogs / FAQs | `frontend/styles/experience.css`, `frontend/lib/experience.ts` |
| Ambient and hover CSS | `frontend/styles/motion.css` |
| Visibility / short entrances / pause controls | `frontend/lib/motion.ts` |
| Deferred preference boot | `frontend/public/motion-init.js`, `layouts/BaseLayout.astro` |
| Mobile panel and real link behavior | `frontend/styles/navigation.css`, `frontend/components/Header.astro`, `frontend/lib/navigation.ts` |
| Selective CMS updates / keyed row reuse | `frontend/lib/public-content.ts`, `frontend/lib/published-list.ts` |
| Measured FAQ/comparison expansion | `frontend/lib/accordions.ts` |

When changing a data-driven component, update its Astro fallback and safe live renderer together. Never interpolate CMS text into HTML. Keep `[hidden]` guards and phone form controls at 16px.

## Acceptance

Review 320/390/768/1440px, touch/keyboard, portrait/landscape and 200% zoom. Check white-header contrast, light hero copy, dark photo captions, all dark/light sections, form boundaries, focus and footer. Check initial paint and link switches, Back/Forward, fast service/filter/FAQ clicks, pause/reload/reduced motion, hidden tab return and a live publication.

The automated palette contract rejects green/mint/teal literals in public theme files; the navigation contract rejects a return of View Transition opt-in or render-blocking motion boot. These are constraints, not visual approval. `npm run verify` runs types/DOM/SQL/build/contrast checks. Run `npm run test:browser` and inspect a real phone before client approval; see `docs/VERIFICATION.md` for actual evidence and limits.

## Stable navigation and selection

The mobile menu is a single-column panel capped at 420px. Its link list scrolls on short screens while the main contact action remains in the panel footer. It overlays the page without adding height. Do not collapse it when an ordinary page link is clicked: leave it visible until the browser commits the next document, then start the new page closed. Escape, outside click/focus, same-page anchors and desktop resizing close it immediately or with its short local animation. Browser Back/Forward restores a closed menu.

Astro prefetching is opt-in on public header/menu links, using hover intent and Astro's built-in network checks. Owner pages and form submissions are not opted into it. See [Astro's prefetch documentation](https://docs.astro.build/en/guides/prefetch/).

Service choices and portfolio filters occupy their initial layout in Astro HTML. JavaScript enables those controls instead of creating them after a network response. Service descriptions occupy the same grid cell and reserve the height of the tallest published description. Only the selected region is visible and reachable by assistive technology. Both local fonts preload; `font-display: optional` keeps a slow first font download from swapping an already-painted fallback face.

Use the new browser scenarios to inspect geometry at 320/390/768/1440px and a deliberately delayed navigation at 811px. Browser scenarios were compiled/listed for this release, not executed here; record real-device results before approval.
