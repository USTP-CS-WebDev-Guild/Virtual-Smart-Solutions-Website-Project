// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { motionAllowed, setupMotion } from "../../frontend/lib/motion";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  localStorage.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("accessible progressive motion", () => {
  it("keeps the nearby and footer pause controls synchronized", () => {
    document.body.innerHTML =
      "<button data-motion-toggle></button><button data-motion-toggle></button>";
    cleanup = setupMotion();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")];
    buttons[0].click();
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
    ]);
    expect(buttons[1].textContent).toBe("Resume animations");
    buttons[1].click();
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "true",
      "true",
    ]);
    expect(localStorage.getItem("vss-motion")).toBe("on");
  });
  it("tracks off-screen regions and pauses ongoing CSS motion when the tab is hidden", () => {
    document.body.innerHTML =
      "<div data-motion-region><img /></div><button data-motion-toggle></button>";
    let notify: IntersectionObserverCallback;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    cleanup = setupMotion();
    const node = document.querySelector<HTMLElement>("[data-motion-region]")!;
    const entry = (visible: boolean): IntersectionObserverEntry => ({
      target: node,
      isIntersecting: visible,
      boundingClientRect: node.getBoundingClientRect(),
      intersectionRect: node.getBoundingClientRect(),
      rootBounds: null,
      time: 0,
      intersectionRatio: visible ? 1 : 0,
    });
    notify!([entry(true)], {} as IntersectionObserver);
    expect(node.dataset.regionVisible).toBe("true");
    notify!([entry(false)], {} as IntersectionObserver);
    expect(node.dataset.regionVisible).toBe("false");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.documentElement.dataset.pageVisible).toBe("false");
  });
  it("gives the device reduced-motion preference priority over a saved on setting", () => {
    expect(motionAllowed(true, "on")).toBe(false);
    expect(motionAllowed(false, "off")).toBe(false);
    expect(motionAllowed(false, null)).toBe(true);
  });
  it("keeps content visible when the animation/observer API is unavailable", () => {
    document.body.innerHTML =
      "<h1>Read me</h1><button data-motion-toggle hidden>Motion on</button>";
    cleanup = setupMotion();
    expect(document.querySelector("h1")!.hidden).toBe(false);
    expect(document.querySelector("h1")!.style.opacity).toBe("");
    expect(
      document.querySelector("[data-motion-toggle]")!.hasAttribute("hidden"),
    ).toBe(false);
  });
  it("cancels an active reveal immediately when the visitor turns motion off", () => {
    document.body.innerHTML =
      '<article class="vss-service-card">Visible card</article><button data-motion-toggle>Motion on</button>';
    let reveal: IntersectionObserverCallback;
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          reveal = callback;
        }
        observe = vi.fn();
        unobserve = unobserve;
        disconnect = disconnect;
      },
    );
    const cancel = vi.fn();
    const card = document.querySelector<HTMLElement>("article")!;
    card.animate = vi.fn(
      () => ({ cancel, finished: new Promise(() => {}) }) as any,
    );
    cleanup = setupMotion();
    reveal!(
      [
        {
          isIntersecting: true,
          target: card,
          boundingClientRect: card.getBoundingClientRect(),
          intersectionRect: card.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
          intersectionRatio: 1,
        },
      ],
      {} as IntersectionObserver,
    );
    expect(card.animate).toHaveBeenCalledOnce();
    document.querySelector<HTMLButtonElement>("button")!.click();
    expect(cancel).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.motion).toBe("off");
    expect(localStorage.getItem("vss-motion")).toBe("off");
    expect(card.hidden).toBe(false);
  });
});

describe("immediate page content", () => {
  it("does not fade or move the heading that is already visible after navigation", () => {
    document.body.innerHTML =
      '<section class="vss-page-hero"><h1>Services</h1></section>';
    const heading = document.querySelector("h1")!;
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 180,
      left: 0,
      right: 500,
      width: 500,
      height: 80,
      x: 0,
      y: 100,
      toJSON() {},
    });
    const animate = vi.fn();
    heading.animate = animate;
    let notify!: IntersectionObserverCallback;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    cleanup = setupMotion();
    notify(
      [{
        isIntersecting: true, target: heading,
        boundingClientRect: heading.getBoundingClientRect(),
        intersectionRect: heading.getBoundingClientRect(),
        intersectionRatio: 1, rootBounds: null, time: 0,
      }],
      {} as IntersectionObserver,
    );
    expect(animate).not.toHaveBeenCalled();
    expect(heading.hidden).toBe(false);
  });
});
