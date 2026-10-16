// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_CONTENT } from "../../shared/site-content/defaults";
import { createPublicContentController } from "../../frontend/lib/public-content";
import { renderServices, renderPlans, renderPortfolio, renderFaqs } from "../../frontend/lib/public-catalog";
import { setupExperience } from "../../frontend/lib/experience";

let stop: () => void;
let controller: ReturnType<typeof createPublicContentController>;
const node = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const copy = () => structuredClone(DEFAULT_SITE_CONTENT);
beforeEach(() => {
  document.documentElement.dataset.motion = "off";
  document.body.innerHTML = `
    <h1 data-site-content="homeHeadline">${DEFAULT_SITE_CONTENT.settings.homeHeadline}</h1>
    <div data-public-services></div><div data-public-plans></div>
    <div data-work-tools><div data-work-filters></div><p data-work-count></p></div>
    <div data-public-portfolio></div><div data-public-faqs></div>
    <div data-explorer-choices></div><div data-explorer-panel></div>
    <div data-footer-services></div>
    <form data-form="inquiry"><input name="message" value="Keep my draft" />
      <select data-dynamic-services></select><select data-dynamic-plans></select>
      <p data-plan-summary></p><p data-selection-alert hidden></p>
    </form>`;
  renderServices(DEFAULT_SITE_CONTENT.services);
  renderPlans(DEFAULT_SITE_CONTENT.plans);
  renderPortfolio(DEFAULT_SITE_CONTENT.portfolio);
  renderFaqs(DEFAULT_SITE_CONTENT.faqs);
  stop = setupExperience();
  controller = createPublicContentController();
});
afterEach(() => {
  stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("stable public rendering", () => {
  it("does not rebuild the shipped HTML when the first API response contains the same catalog", () => {
    const photo = node("[data-public-services] img");
    const card = node("[data-work-id]");
    const button = node("[data-service-choice]");
    const option = node("[data-dynamic-services] option");
    const observed = new MutationObserver(() => {});
    observed.observe(document.body, { subtree: true, childList: true });
    const changed = vi.fn();
    document.addEventListener("vss:content-updated", changed, { once: true });
    expect(controller.apply({ content: copy(), revision: 0 })).toBe(false);
    expect(observed.takeRecords()).toHaveLength(0);
    expect(node("[data-public-services] img")).toBe(photo);
    expect(node("[data-work-id]")).toBe(card);
    expect(node("[data-service-choice]")).toBe(button);
    expect(node("[data-dynamic-services] option")).toBe(option);
    expect(changed).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.siteContentReady).toBe("true");
    observed.disconnect();
    document.removeEventListener("vss:content-updated", changed);
  });

  it("updates a heading without closing the work dialog or replacing photos and controls", () => {
    const photo = node("[data-public-portfolio] img");
    const filter = node("[data-work-category]");
    const choice = node("[data-service-choice]");
    node("[data-work-open]").click();
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true);
    const content = copy();
    content.settings.homeHeadline = "More space for your business";
    expect(controller.apply({ content, revision: 4 })).toBe(true);
    expect(node("h1").textContent).toBe("More space for your business");
    expect(dialog.open).toBe(true);
    expect(node("[data-public-portfolio] img")).toBe(photo);
    expect(node("[data-work-category]")).toBe(filter);
    expect(node("[data-service-choice]")).toBe(choice);
    expect(controller.apply({ content: copy(), revision: 3 })).toBe(false);
    expect(node("h1").textContent).toBe("More space for your business");
  });

  it("retains the service buttons and all panels through rapid selections", () => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-service-choice]")];
    const panels = [...document.querySelectorAll<HTMLElement>("[data-explorer-item]")];
    const photos = panels.map((panel) => panel.querySelector("img"));
    for (const button of [buttons[3], buttons[1], buttons[4], buttons[0], buttons[1]])
      button.click();
    expect([...document.querySelectorAll("[data-service-choice]")]).toEqual(buttons);
    expect([...document.querySelectorAll("[data-explorer-item]")]).toEqual(panels);
    expect(panels.map((panel) => panel.querySelector("img"))).toEqual(photos);
    expect(document.querySelectorAll('[data-explorer-item][data-active="true"]')).toHaveLength(1);
    expect(panels[1].inert).toBe(false);
    expect(panels[0].inert).toBe(true);
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
  });

  it("retains filter focus and existing cards while changing categories repeatedly", () => {
    const filters = [...document.querySelectorAll<HTMLButtonElement>("[data-work-category]")];
    const cards = [...document.querySelectorAll("[data-work-id]")];
    for (const filter of [filters[2], filters[3], filters[1], filters[0]]) {
      filter.click();
      expect(document.activeElement).toBe(filter);
      expect(filter.getAttribute("aria-pressed")).toBe("true");
      expect([...document.querySelectorAll("[data-work-id]")]).toEqual(cards);
      expect([...document.querySelectorAll("[data-work-category]")]).toEqual(filters);
    }
  });

  it("updates one service without rebuilding other cards, the selected button, or the form draft", () => {
    const button = node('[data-service-choice="virtual-assistant"]');
    button.focus();
    const unchangedPhoto = node('[data-service-id="data-entry"] img');
    const content = copy();
    content.services[0].description = "New approved support description.";
    controller.apply({ content, revision: 1 });
    expect(node('[data-service-id="virtual-assistant"] p').textContent).toContain("New approved");
    expect(node('[data-service-id="data-entry"] img')).toBe(unchangedPhoto);
    expect(node('[data-service-choice="virtual-assistant"]')).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(document.querySelector<HTMLInputElement>('[name="message"]')!.value).toBe("Keep my draft");
  });

  it("preserves an open unchanged FAQ and decoded photo when published rows are reordered", () => {
    const faq = document.querySelector<HTMLDetailsElement>("[data-faq-id]")!;
    faq.open = true;
    const photo = node('[data-service-id="data-entry"] img');
    const content = copy();
    content.services.reverse();
    content.faqs.reverse();
    controller.apply({ content, revision: 1 });
    expect(node('[data-service-id="data-entry"] img')).toBe(photo);
    expect(node(`[data-faq-id="${faq.dataset.faqId}"]`)).toBe(faq);
    expect(faq.open).toBe(true);
    expect([...document.querySelectorAll("[data-service-id]")].map((el) => el.getAttribute("data-service-id")))
      .toEqual(content.services.map((service) => service.id));
  });

  it("rejects malformed published content before changing the DOM", () => {
    const before = document.body.innerHTML;
    expect(() => controller.apply({ revision: 1, content: {} })).toThrow("invalid_public_content");
    expect(() => controller.apply({ revision: -1, content: copy() })).toThrow("invalid_content_revision");
    expect(document.body.innerHTML).toBe(before);
    expect(controller.revision).toBe(-1);
  });
});
