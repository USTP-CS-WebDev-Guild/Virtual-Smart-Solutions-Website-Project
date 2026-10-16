// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupNavigation } from "../../frontend/lib/navigation";

let cleanup: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.motion = "off";
  document.body.innerHTML = `<header class="vss-header"><button id="mobile-menu-toggle" aria-expanded="false" aria-label="Open navigation"></button><div data-menu-backdrop hidden></div><nav id="mobile-menu" hidden><a href="/portfolio/">Our work</a></nav><span data-scroll-progress></span></header><main>Content</main>`;
  cleanup = setupNavigation();
});
afterEach(() => {
  cleanup?.();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("mobile navigation with real links", () => {
  it("opens the menu, closes on Escape and returns focus without revealing a hidden menu", () => {
    const button = document.querySelector<HTMLButtonElement>("button")!;
    const menu = document.querySelector<HTMLElement>("nav")!;
    button.click();
    expect(menu.hidden).toBe(false);
    expect(menu.inert).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(menu.hidden).toBe(true);
    expect(menu.inert).toBe(true);
    expect(document.activeElement).toBe(button);
  });
  it("preserves ordinary link navigation and settles an interrupted closing animation", async () => {
    const button = document.querySelector<HTMLButtonElement>("button")!;
    const menu = document.querySelector<HTMLElement>("nav")!;
    document.documentElement.dataset.motion = "on";
    let complete!: () => void;
    const cancel = vi.fn();
    menu.animate = vi.fn(
      () =>
        ({
          cancel,
          finished: new Promise<void>((resolve) => {
            complete = resolve;
          }),
        }) as any,
    );
    button.click();
    button.click();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(menu.inert).toBe(true);
    document.documentElement.dataset.motion = "off";
    document.dispatchEvent(new Event("vss:motion-change"));
    expect(menu.hidden).toBe(true);
    expect(cancel).toHaveBeenCalled();
    complete();
    await Promise.resolve();
    expect(menu.hidden).toBe(true);
    expect(menu.querySelector("a")!.getAttribute("href")).toBe("/portfolio/");
  });
  it("never prevents a page link or waits for a closing animation before navigating", () => {
    document.querySelector<HTMLButtonElement>("button")!.click();
    document.documentElement.dataset.motion = "on";
    const menu = document.querySelector<HTMLElement>("nav")!;
    const animate = vi.fn();
    menu.animate = animate;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    const allowed = menu.querySelector("a")!.dispatchEvent(event);
    expect(allowed).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(animate).not.toHaveBeenCalled();
    expect(menu.hidden).toBe(false); // Do not expose the old page while navigation loads.
    window.dispatchEvent(new Event("pageshow"));
    expect(menu.hidden).toBe(true);
    expect(document.documentElement.dataset.navigationOpen).toBe("false");
  });
  it("closes the backdrop on an outside click and when keyboard focus leaves navigation", () => {
    const button = document.querySelector<HTMLButtonElement>("button")!;
    const menu = document.querySelector<HTMLElement>("nav")!;
    const backdrop = document.querySelector<HTMLElement>("[data-menu-backdrop]")!;
    button.click();
    expect(backdrop.hidden).toBe(false);
    backdrop.click();
    expect(backdrop.hidden).toBe(true);
    button.click();
    const external = document.createElement("button");
    document.querySelector("main")!.append(external);
    external.focus();
    expect(menu.hidden).toBe(true);
    expect(document.documentElement.dataset.navigationOpen).toBe("false");
  });
  it("closes a same-page anchor without blocking its native scrolling behavior", () => {
    const button = document.querySelector<HTMLButtonElement>("button")!;
    const link = document.querySelector<HTMLAnchorElement>("nav a")!;
    link.href = location.pathname + location.search + "#details";
    button.click();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector<HTMLElement>("nav")!.hidden).toBe(true);
  });
});
