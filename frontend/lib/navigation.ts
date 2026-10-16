// Real same-origin links remain real links. We do not intercept navigation,
// cache forms, or put owner sessions into a client-side router.
export function navigationMotionAllowed(root: Document = document) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  if (root.documentElement.dataset.motion === "off") return false;
  try {
    return localStorage.getItem("vss-motion") !== "off";
  } catch {
    return true;
  }
}
export function setupNavigation(root: Document = document) {
  const button = root.querySelector<HTMLButtonElement>("#mobile-menu-toggle");
  const menu = root.querySelector<HTMLElement>("#mobile-menu");
  const backdrop = root.querySelector<HTMLElement>("[data-menu-backdrop]");
  const label = button?.querySelector<HTMLElement>("[data-menu-label]");
  const progress = root.querySelector<HTMLElement>("[data-scroll-progress]");
  const desktop = window.matchMedia("(min-width: 900px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animation: Animation | null = null;
  let frame = 0;
  let open = false;
  const setMenu = (next: boolean, immediate = false) => {
    if (!button || !menu) return;
    const interrupted = animation ? getComputedStyle(menu) : null;
    const start = interrupted
      ? { opacity: interrupted.opacity, transform: interrupted.transform }
      : next
        ? { opacity: 0.6, transform: "translateY(-5px)" }
        : { opacity: 1, transform: "translateY(0)" };
    animation?.cancel();
    animation = null;
    open = next;
    button.setAttribute("aria-expanded", String(next));
    button.setAttribute(
      "aria-label",
      next ? "Close navigation" : "Open navigation",
    );
    menu.inert = !next;
    if (label) label.textContent = next ? "Close" : "Menu";
    root.documentElement.dataset.navigationOpen = String(next);
    if (next) {
      menu.hidden = false;
      if (backdrop) backdrop.hidden = false;
    }
    if (
      immediate ||
      !navigationMotionAllowed(root) ||
      typeof menu.animate !== "function"
    ) {
      menu.hidden = !next;
      if (backdrop) backdrop.hidden = !next;
      return;
    }
    const current = menu.animate(
      [start, { opacity: next ? 1 : 0, transform: "translateY(0)" }],
      { duration: next ? 180 : 120, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    animation = current;
    void current.finished.then(
      () => {
        if (animation !== current) return;
        menu.hidden = !open;
        if (backdrop) backdrop.hidden = !open;
        animation = null;
      },
      () => {},
    );
  };
  const click = () => setMenu(!open);
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      setMenu(false);
      button?.focus();
    }
  };
  const outside = (event: Event) => {
    if (open && (event.target === backdrop || !(event.target as Element).closest(".vss-header")))
      setMenu(false);
  };
  const focusOutside = (event: Event) => {
    if (open && !(event.target as Element).closest(".vss-header"))
      setMenu(false, true);
  };
  const choose = (event: Event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!link) return;
    const target = new URL(link.href, window.location.href);
    // Closing before the destination arrives exposes the old page for a frame
    // (or several seconds on a phone). Keep this overlay still until native
    // navigation commits. Hash links on this page close immediately.
    if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search)
      setMenu(false, true);
  };
  const updateProgress = () => {
    frame = 0;
    const extent = root.documentElement.scrollHeight - innerHeight;
    if (progress)
      progress.style.transform = `scaleX(${extent > 0 ? Math.min(1, Math.max(0, scrollY / extent)) : 0})`;
  };
  const scroll = () => {
    if (!frame) frame = requestAnimationFrame(updateProgress);
  };
  const close = () => setMenu(false, true);
  const settle = () => {
    animation?.cancel();
    animation = null;
    if (menu) menu.hidden = !open;
    if (backdrop) backdrop.hidden = !open;
  };
  button?.addEventListener("click", click);
  menu?.addEventListener("click", choose);
  root.addEventListener("keydown", key);
  root.addEventListener("click", outside);
  root.addEventListener("focusin", focusOutside);
  root.addEventListener("vss:motion-change", settle);
  root.addEventListener("vss:content-updated", scroll);
  desktop.addEventListener("change", close);
  reduced.addEventListener("change", settle);
  window.addEventListener("pagehide", settle);
  window.addEventListener("pageshow", close);
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("resize", scroll, { passive: true });
  updateProgress();
  return () => {
    animation?.cancel();
    if (frame) cancelAnimationFrame(frame);
    button?.removeEventListener("click", click);
    menu?.removeEventListener("click", choose);
    root.removeEventListener("keydown", key);
    root.removeEventListener("click", outside);
    root.removeEventListener("focusin", focusOutside);
    root.removeEventListener("vss:motion-change", settle);
    root.removeEventListener("vss:content-updated", scroll);
    desktop.removeEventListener("change", close);
    reduced.removeEventListener("change", settle);
    window.removeEventListener("pagehide", settle);
    window.removeEventListener("pageshow", close);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("resize", scroll);
    delete root.documentElement.dataset.navigationOpen;
  };
}
