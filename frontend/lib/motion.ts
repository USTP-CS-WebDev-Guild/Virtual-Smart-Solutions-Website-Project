export function motionAllowed(
  reduced: boolean,
  preference: string | null,
): boolean {
  return !reduced && preference !== "off";
}

// Ambient CSS loops and short WAAPI entrances share a single preference.
// Never apply a hidden/opacity-zero class to fallback HTML.
export function setupMotion(root: Document = document) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controls = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-motion-toggle]"),
  ];
  let preference: string | null = null;
  try {
    preference = localStorage.getItem("vss-motion");
  } catch {
    /* Optional storage. */
  }
  const seen = new WeakSet<Element>();
  const observed = new Set<HTMLElement>();
  const active = new Map<HTMLElement, Animation>();
  let observer: IntersectionObserver | null = null;
  const targets = [
    ".vss-hero-copy > .vss-pill",
    ".vss-hero-copy > h1",
    ".vss-hero-lede",
    ".vss-hero-copy > .vss-actions",
    ".vss-hero-assurance",
    ".vss-page-hero > .vss-pill",
    ".vss-page-hero > h1",
    ".vss-page-hero > p:last-child",
    ".vss-about-hero > div:first-child",
    ".vss-section-heading",
    ".vss-centered-heading",
    ".vss-service-card",
    ".vss-work-card",
    ".vss-plan",
    ".vss-person",
    ".vss-steps li",
    ".vss-values article",
    ".vss-approach article",
    ".vss-contact-copy",
    ".vss-contact-form-wrap",
    "[data-reveal]",
  ].join(",");
  const stop = () => {
    active.forEach((a) => a.cancel());
    active.clear();
  };
  const visible = () => root.visibilityState !== "hidden";
  const enter = (
    node: HTMLElement,
    delay = 0,
    distance = 10,
    duration = 340,
  ) => {
    if (
      !motionAllowed(media.matches, preference) ||
      !visible() ||
      typeof node.animate !== "function" ||
      node.hidden
    )
      return;
    active.get(node)?.cancel();
    const animation = node.animate(
      [
        { opacity: 0.8, transform: `translate3d(0,${distance}px,0)` },
        { opacity: 1, transform: "translate3d(0,0,0)" },
      ],
      {
        duration,
        delay,
        easing: "cubic-bezier(.2,.75,.25,1)",
        fill: "none",
      },
    );
    active.set(node, animation);
    void animation.finished.then(
      () => {
        if (active.get(node) === animation) active.delete(node);
      },
      () => {
        if (active.get(node) === animation) active.delete(node);
      },
    );
  };
  const pageVisibility = () => {
    root.documentElement.dataset.pageVisible = String(visible());
    if (!visible()) stop();
  };
  const refresh = () => {
    for (const node of observed) {
      if (!node.isConnected) {
        observer?.unobserve(node);
        observed.delete(node);
      }
    }
    for (const node of root.querySelectorAll<HTMLElement>(
      "[data-motion-region]," + targets,
    )) {
      // Initial/visible content paints immediately. Only elements that enter
      // later from below the viewport receive a small, one-time entrance.
      if (!seen.has(node) && !node.hasAttribute("data-motion-region")) {
        const bounds = node.getBoundingClientRect();
        if (bounds.top < innerHeight && bounds.bottom > 0) seen.add(node);
      }
      if (!observer) {
        if (node.hasAttribute("data-motion-region"))
          node.dataset.regionVisible = "true";
      } else if (
        !observed.has(node) &&
        (!seen.has(node) || node.hasAttribute("data-motion-region"))
      ) {
        observer.observe(node);
        observed.add(node);
      }
    }
  };
  const apply = () => {
    const enabled = motionAllowed(media.matches, preference);
    root.documentElement.dataset.motion = enabled ? "on" : "off";
    pageVisibility();
    for (const button of controls) {
      button.hidden = false;
      button.disabled = media.matches;
      button.setAttribute("aria-pressed", String(enabled));
      button.textContent = media.matches
        ? "Reduced motion"
        : enabled
          ? "Pause animations"
          : "Resume animations";
      button.title = media.matches
        ? "Paused to respect your device’s reduced-motion setting."
        : "Control animation across the website";
    }
    observer?.disconnect();
    observer = null;
    observed.clear();
    stop();
    if (!enabled) return;
    if ("IntersectionObserver" in window)
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const node = entry.target as HTMLElement;
            if (node.hasAttribute("data-motion-region")) {
              node.dataset.regionVisible = String(entry.isIntersecting);
              continue;
            }
            if (!entry.isIntersecting || seen.has(node)) continue;
            seen.add(node);
            observer?.unobserve(node);
            observed.delete(node);
            const siblings = node.parentElement
              ? [...node.parentElement.children].filter((x) =>
                  x.matches(targets),
                )
              : [];
            const index = Math.max(0, siblings.indexOf(node));
            enter(node, Math.min(index, 2) * 30);
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
      );
    refresh();
  };
  const uiChange = (event: Event) => {
    const detail = (event as CustomEvent<{ targets?: HTMLElement[] }>).detail;
    detail?.targets?.slice(0, 1).forEach((node) => {
      seen.add(node);
      for (const child of node.querySelectorAll<HTMLElement>(targets)) {
        seen.add(child);
        observer?.unobserve(child);
        observed.delete(child);
      }
      for (const [child, animation] of active) {
        if (child === node || node.contains(child)) {
          animation.cancel();
          active.delete(child);
        }
      }
      if (!motionAllowed(media.matches, preference) || !visible() || typeof node.animate !== "function") return;
      // A filter/tab changes content in place. Do not slide the entire layout
      // and its cards at the same time; that looks like a second page render.
      const animation = node.animate([{ opacity: 0.94 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      active.set(node, animation);
      void animation.finished.then(
        () => { if (active.get(node) === animation) active.delete(node); },
        () => { if (active.get(node) === animation) active.delete(node); },
      );
    });
  };
  const toggle = () => {
    preference = root.documentElement.dataset.motion === "on" ? "off" : "on";
    try {
      localStorage.setItem("vss-motion", preference);
    } catch {
      /* Current page still works. */
    }
    apply();
    root.dispatchEvent(new Event("vss:motion-change"));
  };
  const sync = (event: StorageEvent) => {
    if (event.key === "vss-motion") {
      preference = event.newValue;
      apply();
      root.dispatchEvent(new Event("vss:motion-change"));
    }
  };
  const changed = () => {
    apply();
    root.dispatchEvent(new Event("vss:motion-change"));
  };
  const hide = () => {
    root.documentElement.dataset.pageVisible = "false";
    stop();
  };
  const show = () => {
    pageVisibility();
    refresh();
  };
  controls.forEach((b) => b.addEventListener("click", toggle));
  media.addEventListener("change", changed);
  window.addEventListener("storage", sync);
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", show);
  root.addEventListener("visibilitychange", pageVisibility);
  root.addEventListener("vss:content-updated", refresh);
  root.addEventListener("vss:ui-change", uiChange);
  apply();
  return () => {
    observer?.disconnect();
    observed.clear();
    stop();
    controls.forEach((b) => b.removeEventListener("click", toggle));
    media.removeEventListener("change", changed);
    window.removeEventListener("storage", sync);
    window.removeEventListener("pagehide", hide);
    window.removeEventListener("pageshow", show);
    root.removeEventListener("visibilitychange", pageVisibility);
    root.removeEventListener("vss:content-updated", refresh);
    root.removeEventListener("vss:ui-change", uiChange);
  };
}
