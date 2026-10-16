// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_SITE_CONTENT } from "../../shared/site-content/defaults";
const state = vi.hoisted(() => ({
  changed: null as null | (() => Promise<void>),
}));
vi.mock("../../frontend/lib/supabase", () => ({ supabase: {} }));
vi.mock("../../frontend/lib/live-updates", () => ({
  connectLiveUpdates: (_client: unknown, _scopes: unknown, callbacks: any) => {
    state.changed = callbacks.changed;
    return () => {};
  },
}));
afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it("keeps the newest published revision when two content requests complete out of order", async () => {
  document.body.innerHTML =
    '<h1 data-site-content="homeHeadline">Starting title</h1>';
  const responses: Array<(response: Response) => void> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>((resolve) => responses.push(resolve))),
  );
  await import("../../frontend/scripts/site-content");
  expect(responses).toHaveLength(1);
  const newer = state.changed!();
  const content = structuredClone(DEFAULT_SITE_CONTENT);
  content.settings.homeHeadline = "Latest accepted heading";
  responses[1](Response.json({ revision: 2, content }));
  await newer;
  const old = structuredClone(DEFAULT_SITE_CONTENT);
  old.settings.homeHeadline = "Stale heading";
  responses[0](Response.json({ revision: 1, content: old }));
  await vi.waitFor(() =>
    expect(document.documentElement.dataset.siteContentReady).toBe("true"),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector("h1")!.textContent).toBe(
    "Latest accepted heading",
  );
});
