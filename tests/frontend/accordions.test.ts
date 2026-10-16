// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupAccordions } from "../../frontend/lib/accordions";
let cleanup: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.motion = "on";
  document.body.innerHTML =
    '<details class="vss-faq"><summary>What happens next?</summary><p>We agree the scope.</p></details>';
  cleanup = setupAccordions();
});
afterEach(() => {
  cleanup?.();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe("interruptible native details animation", () => {
  it("settles at the most recent intent after a fast open and close", async () => {
    const row = document.querySelector("details")!;
    const summary = row.querySelector("summary")!;
    const effects: {
      complete: () => void;
      cancel: ReturnType<typeof vi.fn>;
    }[] = [];
    row.animate = vi.fn(() => {
      let complete!: () => void;
      const finished = new Promise<void>((r) => {
        complete = r;
      });
      const cancel = vi.fn();
      effects.push({ complete, cancel });
      return { finished, cancel } as any;
    });
    summary.click();
    expect(row.open).toBe(true);
    summary.click();
    expect(effects[0].cancel).toHaveBeenCalled();
    effects[0].complete();
    await Promise.resolve();
    expect(row.open).toBe(true);
    effects[1].complete();
    await Promise.resolve();
    expect(row.open).toBe(false);
  });
  it("turning motion off completes the pending close and leaves native keyboard behavior available", () => {
    const row = document.querySelector("details")!;
    row.open = true;
    row.animate = vi.fn(
      () => ({ cancel: vi.fn(), finished: new Promise(() => {}) }) as any,
    );
    row.querySelector("summary")!.click();
    document.documentElement.dataset.motion = "off";
    document.dispatchEvent(new Event("vss:motion-change"));
    expect(row.open).toBe(false);
    expect(
      row
        .querySelector("summary")!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        ),
    ).toBe(true);
  });
});
