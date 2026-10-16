// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { renderServiceTicker } from "../../frontend/lib/service-ticker";
import { DEFAULT_SITE_CONTENT } from "../../shared/site-content/defaults";

afterEach(() => document.body.replaceChildren());
describe("published service ticker", () => {
  it("makes two identical visual groups with one accessible list and no hidden services", () => {
    document.body.innerHTML = "<div data-public-service-strip></div>";
    const services = structuredClone(DEFAULT_SITE_CONTENT.services);
    services[0].published = false;
    renderServiceTicker(services);
    const groups = [...document.querySelectorAll(".vss-ticker-group")];
    expect(groups).toHaveLength(2);
    expect(groups[0].textContent).toBe(groups[1].textContent);
    expect(groups[0].getAttribute("aria-hidden")).toBeNull();
    expect(groups[1].getAttribute("aria-hidden")).toBe("true");
    expect(groups[0].querySelectorAll("span")).toHaveLength(4);
    expect(groups[0].textContent).not.toContain("Virtual Assistant");
  });
  it("replaces the prior catalog and treats an HTML-like title as literal text", () => {
    document.body.innerHTML = "<div data-public-service-strip></div>";
    renderServiceTicker(DEFAULT_SITE_CONTENT.services);
    renderServiceTicker([
      {
        ...DEFAULT_SITE_CONTENT.services[0],
        title: "<img src=x onerror=alert(1)>",
      },
    ]);
    expect(document.querySelectorAll(".vss-ticker-group")).toHaveLength(2);
    expect(
      document.querySelectorAll("[data-public-service-strip] img"),
    ).toHaveLength(0);
    expect(document.querySelector(".vss-ticker-group span")!.textContent).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });
});
