import { DEFAULT_SITE_CONTENT } from "../../shared/site-content/defaults";
import { reconcilePublishedList } from "./published-list";
import type {
  PublicSiteContent,
  ServiceContent,
  PlanContent,
  PortfolioContent,
  TeamContent,
  FaqContent,
} from "../../shared/site-content/defaults";

import { renderServiceTicker } from "./service-ticker";

// Build untrusted published text as DOM nodes, never HTML strings.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
function image(src: string, alt: string, width = 1000, height = 670) {
  const node = el("img");
  node.src = src;
  node.alt = alt;
  node.width = width;
  node.height = height;
  node.loading = "lazy";
  return node;
}
function link(text: string, href: string, className = "vss-text-link") {
  const node = el("a", className, text);
  node.href = href;
  return node;
}

export function renderServices(services: ServiceContent[], previous = DEFAULT_SITE_CONTENT.services) {
  renderServiceTicker(services);
  for (const container of document.querySelectorAll<HTMLElement>(
    "[data-public-services]",
  )) {
    const detail = container.dataset.serviceLayout === "detail";
    const items = services.slice(0, Number(container.dataset.limit || 20));
    reconcilePublishedList(container, items, "data-service-id", (service, index) => {
        const card = el("article", "vss-service-card");
        if (detail) card.id = service.id;
        const visual = el("div", "vss-service-image");
        visual.append(
          image(
            service.image,
            service.title + " — illustrative work environment",
          ),
          el("span", "vss-service-number", String(index + 1).padStart(2, "0")),
        );
        const inquire = link(
          "↗",
          "/contact/?service=" + encodeURIComponent(service.id),
          "vss-round-link",
        );
        inquire.setAttribute("aria-label", "Inquire about " + service.title);
        visual.append(inquire);
        const copy = el("div", "vss-service-copy");
        copy.append(
          el(
            "span",
            "vss-eyebrow",
            detail
              ? "VSS / SERVICE " + String(index + 1).padStart(2, "0")
              : "A LITTLE MORE ROOM TO GROW",
          ),
          el("h3", "", service.title),
          el("p", "", service.description),
        );
        if (detail) {
          const list = el("ul");
          service.examples.forEach((text) => list.append(el("li", "", text)));
          copy.append(list);
        }
        copy.append(
          link(
            detail ? "Discuss this service ↗" : "Explore service ↗",
            detail
              ? "/contact/?service=" + encodeURIComponent(service.id)
              : "/services/#" + encodeURIComponent(service.id),
          ),
        );
        card.append(visual, copy);
        return card;
      }, previous);
    container.querySelectorAll<HTMLElement>(".vss-service-number").forEach((node, index) => {
      const value = String(index + 1).padStart(2, "0");
      if (node.textContent !== value) node.textContent = value;
      if (detail) {
        const label = node.closest("article")?.querySelector(".vss-service-copy > .vss-eyebrow");
        if (label && label.textContent?.trim() !== "VSS / SERVICE " + value)
          label.textContent = "VSS / SERVICE " + value;
      }
    });
  }
}
export function renderPlans(plans: PlanContent[], previous = DEFAULT_SITE_CONTENT.plans) {
  for (const container of document.querySelectorAll<HTMLElement>(
    "[data-public-plans]",
  )) {
    reconcilePublishedList(container, plans, "data-plan-id", (plan) => {
      const card = el(
        "article",
        "vss-plan" + (plan.featured ? " is-featured" : ""),
      );
      card.dataset.planId = plan.id;
      if (plan.featured)
        card.append(el("span", "vss-plan-ribbon", "A LITTLE MORE SUPPORT"));
      const price = el("h3", "", plan.price);
      price.append(el("small", "", plan.period));
      const list = el("ul");
      for (const feature of plan.features) {
        const row = el("li");
        const check = el("span", "", "✓");
        check.setAttribute("aria-hidden", "true");
        row.append(check, document.createTextNode(feature));
        list.append(row);
      }
      card.append(
        el("span", "vss-eyebrow", plan.name),
        price,
        el("p", "", plan.description),
        list,
        link(
          "Discuss " + plan.name + " ↗",
          "/contact/?plan=" + encodeURIComponent(plan.id),
          "vss-button " +
            (plan.featured ? "vss-button-blue" : "vss-button-outline"),
        ),
      );
      return card;
    }, previous);
    if (!plans.length)
      container.append(
        el(
          "p",
          "vss-empty-public",
          "Tell us about your workload and we’ll discuss a tailored arrangement.",
        ),
      );
  }
}
export function renderPortfolio(items: PortfolioContent[], previous = DEFAULT_SITE_CONTENT.portfolio) {
  for (const container of document.querySelectorAll<HTMLElement>(
    "[data-public-portfolio]",
  )) {
    reconcilePublishedList(container, items.slice(0, Number(container.dataset.limit || 16)), "data-work-id", (item) => {
      const card = el("article", "vss-work-card");
      card.dataset.workId = item.id;
      const visual = el("div", "vss-work-image");
      visual.append(
        image(
          item.image,
          item.title +
            " — " +
            (item.kind === "example"
              ? "illustrative image"
              : "client-approved image"),
        ),
        el(
          "span",
          "",
          item.kind === "example"
            ? "ILLUSTRATIVE ENGAGEMENT"
            : "CLIENT CASE STUDY",
        ),
      );
      const copy = el("div", "vss-work-copy");
      copy.append(
        el("span", "vss-eyebrow", item.category),
        el("h3", "", item.title),
        el("p", "", item.description),
        el("p", "vss-work-outcome", item.outcome),
        link("Discuss similar support ↗", "/contact/"),
      );
      card.append(visual, copy);
      return card;
    }, previous);
    if (!items.length)
      container.append(
        el(
          "p",
          "vss-empty-public",
          "Tell us about your workflow and we’ll discuss what support could look like.",
        ),
      );
  }
}
export function renderTeam(items: TeamContent[], previous = DEFAULT_SITE_CONTENT.team) {
  for (const container of document.querySelectorAll<HTMLElement>(
    "[data-public-team]",
  )) {
    reconcilePublishedList(container, items, "data-member-id", (item) => {
      const card = el("article", "vss-person");
      const photo = el("div", "vss-person-image");
      const portrait = image(item.image, item.name, 640, 720);
      portrait.className = "vss-motion-loop";
      photo.append(portrait);
      const copy = el("div");
      copy.append(
        el("span", "vss-eyebrow", item.role),
        el("h3", "", item.name),
        el("p", "", item.bio),
      );
      card.append(photo, copy);
      return card;
    }, previous);
  }
}
export function renderFaqs(items: FaqContent[], previous = DEFAULT_SITE_CONTENT.faqs) {
  for (const container of document.querySelectorAll<HTMLElement>(
    "[data-public-faqs]",
  )) {
    const open = new Set(
      [...container.querySelectorAll<HTMLDetailsElement>("details[open]")].map(
        (x) => x.dataset.faqId,
      ),
    );
    reconcilePublishedList(container, items, "data-faq-id", (item) => {
      const row = el("details", "vss-faq");
      row.dataset.faqId = item.id;
      row.open = open.has(item.id);
      const summary = el("summary", "", item.question);
      const plus = el("span", "", "+");
      plus.setAttribute("aria-hidden", "true");
      summary.append(plus);
      row.append(summary, el("p", "", item.answer));
      return row;
    }, previous);
    const section = container.closest<HTMLElement>("[data-public-faq-section]");
    if (section) section.hidden = !items.length;
  }
}
export function reconcileFormChoices(content: PublicSiteContent) {
  const options = (select: HTMLSelectElement, values: Array<[string, string]>) => {
    const existing = [...select.options];
    if (existing.length === values.length && existing.every((option, index) =>
      option.value === values[index][0] && option.text.trim() === values[index][1])) return;
    select.replaceChildren(...values.map(([value, label]) => {
      const option = el("option", "", label);
      option.value = value;
      return option;
    }));
  };
  const params = new URLSearchParams(location.search);
  for (const form of document.querySelectorAll<HTMLFormElement>(
    '[data-form="inquiry"]',
  )) {
    const service = form.querySelector<HTMLSelectElement>(
      "[data-dynamic-services]",
    )!;
    const plan = form.querySelector<HTMLSelectElement>("[data-dynamic-plans]")!;
    const summary = form.querySelector<HTMLElement>("[data-plan-summary]")!;
    const alert = form.querySelector<HTMLElement>("[data-selection-alert]")!;
    const first = form.dataset.catalogReady !== "true";
    const oldService = service.value;
    const oldPlan = plan.value;
    let serviceNeedsReview = form.dataset.serviceNeedsReview === "true";
    let planNeedsReview = plan.dataset.needsReview === "true";
    options(service, [["", "Choose an area"], ...content.services.map((item): [string, string] => [item.title, item.title]), ["Not sure yet", "Not sure yet"]]);
    const serviceQuery = first ? params.get("service") : null;
    const desiredService = serviceQuery
      ? content.services.find(
          (x) => x.id === serviceQuery || x.title === serviceQuery,
        )?.title || ""
      : oldService;
    if ([...service.options].some((x) => x.value === desiredService))
      service.value = desiredService;
    if (
      (serviceQuery && !desiredService) ||
      (oldService &&
        !content.services.some((x) => x.title === oldService) &&
        oldService !== "Not sure yet")
    )
      serviceNeedsReview = true;
    options(plan, [["", "Not sure yet — help me choose"], ...content.plans.map((item): [string, string] => [item.id, `${item.name} · ${item.price} ${item.period}`.trim()])]);
    const desiredPlan = first ? params.get("plan") || oldPlan : oldPlan;
    if (content.plans.some((x) => x.id === desiredPlan))
      plan.value = desiredPlan;
    else if (desiredPlan) planNeedsReview = true;
    const update = () => {
      const item = content.plans.find((x) => x.id === plan.value);
      summary.textContent = item
        ? `${item.name}: ${item.price} ${item.period}. Final scope and fees are confirmed in writing.`
        : "Optional. We confirm the scope and fees before any work begins.";
      const notices = [];
      if (serviceNeedsReview)
        notices.push(
          "That service has changed. Choose an available service to continue.",
        );
      if (planNeedsReview)
        notices.push(
          "That package is no longer available. Choose another package or “Not sure yet”.",
        );
      alert.textContent = notices.join(" ");
      alert.hidden = !notices.length;
      plan.setCustomValidity(
        planNeedsReview ? "Please review your package selection." : "",
      );
      plan.dataset.needsReview = String(planNeedsReview);
      form.dataset.serviceNeedsReview = String(serviceNeedsReview);
    };
    update();
    plan.onchange = () => {
      planNeedsReview = false;
      update();
    };
    service.onchange = () => {
      serviceNeedsReview = false;
      update();
    };
    form.onreset = () => {
      queueMicrotask(() => {
        planNeedsReview = false;
        serviceNeedsReview = false;
        update();
      });
    };
    form.dataset.catalogReady = "true";
  }
}
