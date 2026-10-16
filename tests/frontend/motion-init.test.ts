// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
const source = readFileSync(resolve("frontend/public/motion-init.js"), "utf8");
const contexts: Window[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.happyDOM.abort();
});
describe("deferred motion preference without a navigation effect", () => {
  it("respects a saved paused choice without registering page-transition handlers", () => {
    const w = new Window({ url: "https://test.example/" });
    contexts.push(w);
    w.localStorage.setItem("vss-motion", "off");
    const listen = vi.spyOn(w, "addEventListener");
    w.eval(source);
    expect(w.document.documentElement.dataset.motion).toBe("off");
    expect(listen).not.toHaveBeenCalled();
  });
  it("enables ambient motion while leaving browser page changes untouched", () => {
    const w = new Window({ url: "https://test.example/" });
    contexts.push(w);
    w.eval(source);
    expect(w.document.documentElement.dataset.motion).toBe("on");
    const skipTransition = vi.fn();
    const event = new w.Event("pagereveal");
    Object.assign(event, {
      viewTransition: { skipTransition, finished: Promise.resolve() },
    });
    w.dispatchEvent(event);
    expect(
      w.document.documentElement.dataset.navigationTransition,
    ).toBeUndefined();
    expect(skipTransition).not.toHaveBeenCalled();
  });
});
