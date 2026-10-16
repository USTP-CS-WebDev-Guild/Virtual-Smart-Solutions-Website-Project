# Find the right stylesheet

The public layout loads `global.css → brand.css → vss.css → experience.css → navigation.css → motion.css`. The owner page loads `global.css → workspace.css → brand.css`. Public page geometry and animation no longer share the owner editor's stylesheet.

| Change | File / search |
| --- | --- |
| Black/white, charcoal, blue, text and surface tokens | `vss.css`, `.public-page` variables at the top |
| Header, hero, services, work, pricing, team, contact, footer | `vss.css`; each section has a named comment |
| Shared identity / logo sizing | `brand.css` |
| Service chooser, work filters/dialog, FAQ and comparison | `experience.css` |
| Ambient keyframes, hover/focus and reduced motion; no page snapshots | `motion.css` |
| Short entrances, visibility and shared pause buttons | `../lib/motion.ts` |
| Mobile panel, backdrop, selected links and menu control | `navigation.css` |
| Menu behavior, scroll-progress indicator, preference check | `../lib/navigation.ts` |
| Deferred preference boot (no page-transition listener) | `../public/motion-init.js` |
| FAQ/comparison expansion and cancellation | `../lib/accordions.ts` |
| Owner editor and identity adjustments | `workspace.css` |
| Shared fonts, forms, hidden/auth guard and owner foundations | `global.css` |

Keep edits in the owning file instead of adding another override file. Keep `[hidden] { display:none !important }` intact: it protects signed-out owner views and filtered/disabled UI. Phone inputs/selects/textareas remain 16px. Text on photos needs a controlled dark backing/gradient; solid text pairs must meet 4.5:1. The built footer has an automatic contrast gate.

Public data-driven components have both Astro fallback markup and a live DOM renderer. If their structure changes, update both `components/*.astro` and `lib/public-catalog.ts` (or `lib/service-ticker.ts`). Do not use `innerHTML` for CMS text. Test the public and owner workflows after shared CSS changes.
