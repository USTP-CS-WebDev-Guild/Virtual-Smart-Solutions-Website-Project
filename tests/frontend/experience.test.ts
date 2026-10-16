// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupExperience,
  checkServiceHealth,
} from "../../frontend/lib/experience";
import { renderPortfolio, renderFaqs } from "../../frontend/lib/public-catalog";
import { DEFAULT_SITE_CONTENT } from "../../shared/site-content/defaults";

let cleanup: (() => void) | undefined;
beforeEach(() => {
  document.documentElement.dataset.motion = "off";
  document.body.innerHTML = `<div data-explorer-choices hidden></div><div data-explorer-panel></div>
    <div data-work-tools hidden><div data-work-filters></div><p data-work-count></p></div><div data-public-portfolio></div>
    <div data-faq-search-wrap hidden><input data-faq-search /><p data-faq-count></p></div><div data-public-faqs></div>
    <details class="vss-comparison"><table data-plan-comparison></table></details><div data-footer-services></div>`;
  renderPortfolio(DEFAULT_SITE_CONTENT.portfolio);
  renderFaqs(DEFAULT_SITE_CONTENT.faqs);
  cleanup = setupExperience();
});
afterEach(() => {
  cleanup?.();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe("public browsing interactions", () => {
  it("opens and closes a work detail and returns focus to the trigger", () => {
    const trigger =
      document.querySelector<HTMLButtonElement>("[data-work-open]")!;
    trigger.focus();
    trigger.click();
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("ILLUSTRATIVE ENGAGEMENT");
    const close = dialog.querySelector<HTMLButtonElement>(".vss-dialog-close")!;
    expect(document.activeElement).toBe(close);
    close.click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
  it("selects a service, preserves focus, and carries the exact choice into contact", () => {
    document
      .querySelector<HTMLButtonElement>('[data-service-choice="data-entry"]')!
      .click();
    expect(
      document.querySelector("[data-explorer-panel] [data-active=true] h3")!.textContent,
    ).toBe("Data Entry");
    expect(
      document
        .querySelector<HTMLAnchorElement>("[data-explorer-panel] [data-active=true] a")!
        .getAttribute("href"),
    ).toBe("/contact/?service=data-entry");
    expect(document.activeElement?.getAttribute("aria-pressed")).toBe("true");
    expect(
      document.querySelector("[data-explorer-panel] [data-active=true] img")!.getAttribute("src"),
    ).toBe("/images/service-data.webp");
  });
  it("filters work and recovers when a live revision removes the selected category", () => {
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        "[data-work-filters] button",
      ),
    ]
      .find((b) => b.textContent === "Bookkeeping")!
      .click();
    expect(
      document.querySelectorAll("[data-work-id]:not([hidden])"),
    ).toHaveLength(1);
    expect(document.querySelector(".is-work-featured")?.textContent).toContain(
      "Bookkeeping",
    );
    expect(document.querySelectorAll(".is-work-featured")).toHaveLength(1);
    const content = structuredClone(DEFAULT_SITE_CONTENT);
    content.portfolio = [];
    renderPortfolio(content.portfolio);
    document.dispatchEvent(
      new CustomEvent("vss:content-updated", { detail: { content } }),
    );
    expect(
      document.querySelector("[data-work-tools]")!.hasAttribute("hidden"),
    ).toBe(true);
    expect(document.querySelector("[data-work-count]")!.textContent).toBe(
      "0 engagements shown",
    );
  });
  it("searches questions and answers, announces no matches, and keeps the search during a live revision", () => {
    const input =
      document.querySelector<HTMLInputElement>("[data-faq-search]")!;
    input.value = "xyz-no-result";
    input.dispatchEvent(new Event("input"));
    expect(document.querySelector("[data-faq-count]")!.textContent).toBe(
      "0 answers found",
    );
    const content = structuredClone(DEFAULT_SITE_CONTENT);
    content.faqs[0].answer = "xyz-no-result is now answered.";
    renderFaqs(content.faqs);
    document.dispatchEvent(
      new CustomEvent("vss:content-updated", { detail: { content } }),
    );
    expect(input.value).toBe("xyz-no-result");
    expect(
      document.querySelectorAll("[data-public-faqs] details:not([hidden])"),
    ).toHaveLength(1);
  });
  it("renders CMS strings as text and updates comparison/links from the same published catalog", () => {
    const content = structuredClone(DEFAULT_SITE_CONTENT);
    content.services[0].title = "<img src=x onerror=alert(1)>";
    content.plans[0].price = "₱9,000";
    document.dispatchEvent(
      new CustomEvent("vss:content-updated", { detail: { content } }),
    );
    expect(document.querySelectorAll("[data-explorer-panel] [data-active=true] img")).toHaveLength(
      1,
    );
    expect(
      document.querySelector("[data-explorer-panel] [data-active=true] img")!.getAttribute("src"),
    ).toBe(content.services[0].image);
    expect(
      document.querySelector("[data-explorer-panel] [data-active=true] [onerror]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-explorer-panel] [data-active=true] h3")!.textContent,
    ).toBe(content.services[0].title);
    expect(
      document.querySelector("[data-plan-comparison]")!.textContent,
    ).toContain("₱9,000");
    expect(document.querySelectorAll("[data-footer-services] a")).toHaveLength(
      5,
    );
  });
  it("does not report a healthy site when the database or notification health fails", async () => {
    const node = document.createElement("span");
    const failed = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "not_ready" }), { status: 503 }),
    );
    await checkServiceHealth(node, failed as any);
    expect(node.textContent).toBe("Service status unavailable");
    const healthy = vi.fn(
      async (path) =>
        new Response(
          JSON.stringify({ status: path.includes("ready") ? "ready" : "ok" }),
        ),
    );
    await checkServiceHealth(node, healthy as any);
    expect(node.textContent).toBe("All systems operational");
  });
});
