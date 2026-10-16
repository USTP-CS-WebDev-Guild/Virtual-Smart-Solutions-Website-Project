import {
  DEFAULT_SITE_CONTENT,
  type PublicSiteContent,
  type PortfolioContent,
} from "../../shared/site-content/defaults";
import { el } from "./public-catalog";
import { reconcilePublishedList } from "./published-list";
import { setupAccordions } from "./accordions";
import { navigationMotionAllowed } from "./navigation";

export function setupExperience(root: Document = document) {
  const stopAccordions = setupAccordions(root);
  let dialogAnimation: Animation | null = null;
  let closingDialog = false;
  let content = DEFAULT_SITE_CONTENT;
  let selectedService = "";
  let category = "All";
  let opener: HTMLButtonElement | null = null;
  const dialog = root.createElement("dialog");
  dialog.className = "vss-work-dialog";
  dialog.setAttribute("aria-labelledby", "work-dialog-title");
  root.body.append(dialog);
  const close = (immediate = false) => {
    dialogAnimation?.cancel();
    dialogAnimation = null;
    closingDialog = false;
    if (!dialog.open) return;
    if (
      immediate ||
      !navigationMotionAllowed(root) ||
      typeof dialog.animate !== "function"
    ) {
      dialog.close();
      if (opener?.isConnected) opener.focus();
      return;
    }
    const effect = dialog.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 150, easing: "ease-out" },
    );
    closingDialog = true;
    dialogAnimation = effect;
    void effect.finished.then(
      () => {
        if (dialogAnimation !== effect) return;
        closingDialog = false;
        dialogAnimation = null;
        dialog.close();
        if (opener?.isConnected) opener.focus();
      },
      () => {},
    );
  };
  const cancelDialog = (event: Event) => {
    event.preventDefault();
    close();
  };
  dialog.addEventListener("cancel", cancelDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("close", () => {
    if (opener?.isConnected) opener.focus();
  });
  const showWork = (item: PortfolioContent, button: HTMLButtonElement) => {
    opener = button;
    const body = el("div", "vss-dialog-body");
    const dismiss = el("button", "vss-dialog-close", "Close ×");
    dismiss.type = "button";
    dismiss.addEventListener("click", () => close());
    const heading = el("h2", "", item.title);
    heading.id = "work-dialog-title";
    const image = el("img");
    image.src = item.image;
    image.alt = "";
    image.width = 1000;
    image.height = 670;
    const link = el(
      "a",
      "vss-button vss-button-blue",
      "Discuss similar support ↗",
    );
    link.href = "/contact/";
    body.append(
      dismiss,
      el(
        "span",
        "vss-eyebrow",
        item.kind === "example"
          ? "ILLUSTRATIVE ENGAGEMENT"
          : "APPROVED CLIENT CASE STUDY",
      ),
      heading,
      image,
      el("p", "", item.description),
      el("p", "vss-dialog-outcome", item.outcome),
      link,
    );
    dialog.replaceChildren(body);
    dialog.showModal();
    dialogAnimation?.cancel();
    dialogAnimation = null;
    if (navigationMotionAllowed(root) && typeof dialog.animate === "function") {
      dialogAnimation = dialog.animate(
        [
          { opacity: 0.8 },
          { opacity: 1 },
        ],
        { duration: 180, easing: "cubic-bezier(.2,.75,.25,1)" },
      );
      void dialogAnimation.finished.catch(() => {});
    }
    dismiss.focus();
  };
  const explorer = (animate = false) => {
    const choices = root.querySelector<HTMLElement>("[data-explorer-choices]");
    const panel = root.querySelector<HTMLElement>("[data-explorer-panel]");
    if (!choices || !panel) return;
    const items = content.services.filter((item) => item.published);
    const item = items.find((x) => x.id === selectedService) || items[0];
    if (!item) return;
    selectedService = item.id;
    choices.hidden = false;
    reconcilePublishedList(choices, items.map(({ id, title }) => ({ id, title })), "data-service-choice", (service, index) => {
      const button = el("button", "vss-choice");
      const number = el("span", "vss-choice-index", String(index + 1).padStart(2, "0"));
      number.setAttribute("aria-hidden", "true");
      const arrow = el("span", "", "↗");
      arrow.setAttribute("aria-hidden", "true");
      button.append(number, el("span", "vss-choice-name", service.title), arrow);
      button.type = "button";
      return button;
    }, DEFAULT_SITE_CONTENT.services.map(({ id, title }) => ({ id, title })));
    for (const [index, button] of [...choices.querySelectorAll<HTMLButtonElement>("button")].entries()) {
      button.id = "service-choice-" + button.dataset.serviceChoice;
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.serviceChoice === selectedService));
      button.setAttribute("aria-controls", "service-panel-" + button.dataset.serviceChoice);
      const number = button.querySelector(".vss-choice-index");
      const text = String(index + 1).padStart(2, "0");
      if (number && number.textContent !== text) number.textContent = text;
    }
    // All panels share one CSS grid cell. The tallest published service defines
    // the height, so selecting a shorter description cannot move the controls.
    reconcilePublishedList(panel, items, "data-explorer-item", (service) => {
      const detail = el("div", "vss-explorer-detail");
      const photo = el("img", "vss-explorer-image");
      photo.src = service.image;
      photo.alt = "";
      photo.width = 1000;
      photo.height = 670;
      photo.loading = "lazy";
      const copy = el("div", "vss-explorer-copy");
      const list = el("ul");
      service.examples.forEach((text) => list.append(el("li", "", text)));
      const link = el("a", "vss-text-link", "Discuss this service ↗");
      link.href = "/contact/?service=" + encodeURIComponent(service.id);
      copy.append(el("span", "vss-eyebrow", "YOUR NEXT HELPING HAND"), el("h3", "", service.title), el("p", "", service.description), list, link);
      detail.append(photo, copy);
      return detail;
    }, DEFAULT_SITE_CONTENT.services);
    for (const detail of panel.querySelectorAll<HTMLElement>("[data-explorer-item]")) {
      const active = detail.dataset.explorerItem === selectedService;
      detail.id = "service-panel-" + detail.dataset.explorerItem;
      detail.setAttribute("role", "region");
      detail.setAttribute("aria-labelledby", "service-choice-" + detail.dataset.explorerItem);
      detail.dataset.active = String(active);
      detail.setAttribute("aria-hidden", String(!active));
      detail.inert = !active;
    }
    if (animate) {
      const current = panel.querySelector<HTMLElement>('[data-active="true"] .vss-explorer-copy');
      root.dispatchEvent(new CustomEvent("vss:ui-change", { detail: { targets: current ? [current] : [] } }));
      const status = root.querySelector<HTMLElement>("[data-explorer-status]");
      if (status) status.textContent = "Showing " + item.title + " support.";
    }
  };
  const work = (animate = false) => {
    const tools = root.querySelector<HTMLElement>("[data-work-tools]");
    const filters = root.querySelector<HTMLElement>("[data-work-filters]");
    const grid = root.querySelector<HTMLElement>("[data-public-portfolio]");
    if (!tools || !filters || !grid) return;
    const items = content.portfolio.filter((item) => item.published && (item.kind === "example" || item.approved))
      .slice(0, Number(grid.dataset.limit || 16));
    const categories = ["All", ...new Set(items.map((item) => item.category))];
    if (!categories.includes(category)) category = "All";
    tools.hidden = !items.length;
    const initialCategories = ["All", ...new Set(DEFAULT_SITE_CONTENT.portfolio.map((item) => item.category))];
    reconcilePublishedList(filters, categories.map((id) => ({ id })), "data-work-category", ({ id }) => {
      const button = el("button", "vss-filter", id);
      button.type = "button";
      return button;
    }, initialCategories.map((id) => ({ id })));
    for (const button of filters.querySelectorAll<HTMLButtonElement>("button")) {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(category === button.dataset.workCategory));
    }
    let visible = 0;
    grid.dataset.filterReady = "true";
    grid.querySelectorAll<HTMLElement>("[data-work-id]").forEach((card) => {
      const item = items.find((x) => x.id === card.dataset.workId);
      card.hidden = !item || (category !== "All" && item.category !== category);
      card.classList.toggle("is-work-featured", !card.hidden && visible === 0);
      if (!card.hidden) visible++;
      if (!item) return;
      let button = card.querySelector<HTMLButtonElement>("[data-work-open]");
      if (typeof dialog.showModal !== "function") {
        if (button) button.hidden = true;
        if (!card.querySelector(".vss-work-copy > a")) {
          const link = el("a", "vss-text-link", "Discuss similar support ↗");
          link.href = "/contact/";
          card.querySelector(".vss-work-copy")?.append(link);
        }
        return;
      }
      if (!button) {
        button = el("button", "vss-text-link vss-work-open", "View the details ↗");
        button.type = "button";
        button.dataset.workOpen = item.id;
        card.querySelector(".vss-work-copy")?.append(button);
      }
      button.disabled = false;
    });
    if (animate)
      root.dispatchEvent(new CustomEvent("vss:ui-change", { detail: { targets: [grid] } }));
    const count = root.querySelector<HTMLElement>("[data-work-count]");
    const text = `${visible} ${visible === 1 ? "engagement" : "engagements"} shown`;
    if (count && count.textContent !== text) count.textContent = text;
  };
  const choose = (event: Event) => {
    const target = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!target) return;
    if (target.hasAttribute("data-service-choice")) {
      const next = target.dataset.serviceChoice!;
      if (selectedService === next) return;
      selectedService = next;
      explorer(true);
      target.focus({ preventScroll: true });
    } else if (target.hasAttribute("data-work-category")) {
      const next = target.dataset.workCategory!;
      if (category === next) return;
      category = next;
      work(true);
      target.focus({ preventScroll: true });
    } else if (target.hasAttribute("data-work-open")) {
      const current = content.portfolio.find((x) => x.id === target.dataset.workOpen && x.published && (x.kind === "example" || x.approved));
      if (current) showWork(current, target);
    }
  };
  const faqs = () => {
    const input = root.querySelector<HTMLInputElement>("[data-faq-search]");
    const wrap = root.querySelector<HTMLElement>("[data-faq-search-wrap]");
    if (!input || !wrap) return;
    input.disabled = false;
    const query = input.value.trim().toLowerCase();
    const rows = [
      ...root.querySelectorAll<HTMLDetailsElement>(
        "[data-public-faqs] details",
      ),
    ];
    wrap.hidden = !rows.length;
    let count = 0;
    rows.forEach((row) => {
      row.hidden = !row.textContent?.toLowerCase().includes(query);
      if (!row.hidden) count++;
    });
    const status = root.querySelector<HTMLElement>("[data-faq-count]");
    if (status)
      status.textContent = query
        ? `${count} ${count === 1 ? "answer" : "answers"} found`
        : "Browse below or search by topic.";
  };
  const comparison = () => {
    const table = root.querySelector<HTMLTableElement>(
      "[data-plan-comparison]",
    );
    if (!table) return;
    const plans = content.plans.filter((p) => p.published);
    const wrapper = table.closest<HTMLElement>(".vss-comparison");
    if (wrapper) wrapper.hidden = !plans.length;
    const caption = el(
      "caption",
      "",
      "Published starting packages. Final scope and fees are confirmed in writing.",
    );
    const head = el("thead");
    const header = el("tr");
    ["At a glance", ...plans.map((p) => p.name)].forEach((text) => {
      const cell = el("th", "", text);
      cell.scope = "col";
      header.append(cell);
    });
    head.append(header);
    const body = el("tbody");
    ["Starting fee", "Good fit", "Included support"].forEach((text, index) => {
      const row = el("tr");
      const label = el("th", "", text);
      label.scope = "row";
      row.append(label);
      plans.forEach((p) => {
        const cell = el("td");
        if (index === 2) {
          const list = el("ul");
          p.features.forEach((f) => list.append(el("li", "", f)));
          cell.append(list);
        } else
          cell.textContent =
            index === 0 ? `${p.price} ${p.period}` : p.description;
        row.append(cell);
      });
      body.append(row);
    });
    table.replaceChildren(caption, head, body);
  };
  const footer = () => {
    const links = root.querySelector<HTMLElement>("[data-footer-services]");
    if (!links) return;
    reconcilePublishedList(links, content.services.filter((x) => x.published).map(({ id, title }) => ({ id, title })), "data-footer-service", (service) => {
      const link = el("a", "", service.title);
      link.href = "/services/#" + encodeURIComponent(service.id);
      return link;
    }, DEFAULT_SITE_CONTENT.services.map(({ id, title }) => ({ id, title })));
  };
  const refresh = (event?: Event) => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    if (detail?.content) content = detail.content as PublicSiteContent;
    const changed = detail?.changed as string[] | undefined;
    const needs = (key: string) => !changed || changed.includes(key);
    if (needs("portfolio")) {
      if (dialog.open && event) close(true);
      work();
    }
    if (needs("services")) { explorer(); footer(); }
    if (needs("faqs")) faqs();
    const table = root.querySelector("[data-plan-comparison]");
    if (needs("plans") && (event || !table?.querySelector("tbody"))) comparison();
  };
  const settleDialog = () => {
    if (closingDialog) close(true);
    else {
      dialogAnimation?.cancel();
      dialogAnimation = null;
    }
  };
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  root.addEventListener("click", choose);
  root.addEventListener("vss:motion-change", settleDialog);
  motionMedia.addEventListener("change", settleDialog);
  root.querySelector("[data-faq-search]")?.addEventListener("input", faqs);
  root.addEventListener("vss:content-updated", refresh);
  refresh();
  return () => {
    root.querySelector("[data-faq-search]")?.removeEventListener("input", faqs);
    root.removeEventListener("click", choose);
    root.removeEventListener("vss:content-updated", refresh);
    root.removeEventListener("vss:motion-change", settleDialog);
    motionMedia.removeEventListener("change", settleDialog);
    dialogAnimation?.cancel();
    dialogAnimation = null;
    stopAccordions();
    dialog.remove();
  };
}

export async function checkServiceHealth(
  node: HTMLElement,
  fetcher: typeof fetch = fetch,
) {
  node.dataset.state = "checking";
  node.textContent = "Checking website services…";
  try {
    const options = {
      cache: "no-store" as const,
      signal: AbortSignal.timeout(6000),
    };
    const [ready, notifications] = await Promise.all([
      fetcher("/api/health/ready", options),
      fetcher("/api/health/notifications", options),
    ]);
    const [a, b] = await Promise.all([ready.json(), notifications.json()]);
    if (
      !ready.ok ||
      !notifications.ok ||
      a.status !== "ready" ||
      b.status !== "ok"
    )
      throw new Error("not_ready");
    node.dataset.state = "ready";
    node.textContent = "All systems operational";
  } catch {
    node.dataset.state = "unavailable";
    node.textContent = "Service status unavailable";
  }
}
