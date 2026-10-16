import { DEFAULT_SITE_CONTENT, type PublicSiteContent } from "../../shared/site-content/defaults";
import { publicSiteContentSchema } from "../../shared/site-content/validation";
import {
  renderServices, renderPlans, renderPortfolio, renderTeam, renderFaqs,
  reconcileFormChoices,
} from "./public-catalog";

export type ContentSection = keyof PublicSiteContent;
export function publishedContent(content: PublicSiteContent): PublicSiteContent {
  return {
    settings: content.settings,
    services: content.services.filter((x) => x.published),
    plans: content.plans.filter((x) => x.published),
    portfolio: content.portfolio.filter((x) => x.published && (x.kind === "example" || x.approved)),
    team: content.team.filter((x) => x.published),
    faqs: content.faqs.filter((x) => x.published),
  };
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function createPublicContentController(root: Document = document) {
  // Astro already rendered this catalog. A response containing the same content
  // must leave the initial HTML, photos and focused controls in place.
  let current = publishedContent(DEFAULT_SITE_CONTENT);
  let appliedRevision = -1;
  reconcileFormChoices(current);
  return {
    get revision() { return appliedRevision; },
    apply(value: unknown) {
      const result = value as { content?: unknown; revision?: unknown } | null;
      if (!result || !Number.isSafeInteger(result.revision) || Number(result.revision) < 0)
        throw new Error("invalid_content_revision");
      if (Number(result.revision) <= appliedRevision) return false;
      const parsed = publicSiteContentSchema.safeParse(result.content);
      if (!parsed.success) throw new Error("invalid_public_content");
      const next = publishedContent(parsed.data);
      const changed = (Object.keys(next) as ContentSection[])
        .filter((key) => !equal(current[key], next[key]));
      if (changed.includes("settings")) {
        for (const node of root.querySelectorAll<HTMLElement>("[data-site-content]")) {
          const key = node.dataset.siteContent as keyof PublicSiteContent["settings"];
          const value = next.settings[key];
          if (typeof value === "string" && node.textContent?.trim() !== value)
            node.textContent = value;
        }
        for (const node of root.querySelectorAll<HTMLAnchorElement>("[data-site-email]")) {
          const value = node.dataset.siteEmail === "privacy" ? next.settings.privacyEmail : next.settings.email;
          node.hidden = !value;
          if (node.textContent?.trim() !== value) node.textContent = value;
          if (value) node.setAttribute("href", "mailto:" + value);
          else node.removeAttribute("href");
        }
        for (const node of root.querySelectorAll<HTMLElement>("[data-site-email-fallback]"))
          node.hidden = Boolean(next.settings.email);
        for (const node of root.querySelectorAll<HTMLElement>("[data-site-email-group]"))
          node.hidden = !(node.dataset.siteEmailGroup === "privacy" ? next.settings.privacyEmail : next.settings.email);
        for (const node of root.querySelectorAll<HTMLElement>("[data-site-aria]"))
          node.setAttribute("aria-label", next.settings.businessName + " home");
        for (const node of root.querySelectorAll<HTMLElement>("[data-site-page-title]")) {
          const page = node.getAttribute("data-site-page-title");
          const title = page ? `${page} — ${next.settings.businessName}` : `${next.settings.businessName} — Filipino Virtual Assistant Services`;
          if (node.tagName === "META") node.setAttribute("content", title);
          else if (node.textContent !== title) node.textContent = title;
        }
      }
      if (changed.includes("services")) renderServices(next.services, current.services);
      if (changed.includes("plans")) renderPlans(next.plans, current.plans);
      if (changed.includes("portfolio")) renderPortfolio(next.portfolio, current.portfolio);
      if (changed.includes("team")) renderTeam(next.team, current.team);
      if (changed.includes("faqs")) renderFaqs(next.faqs, current.faqs);
      if (changed.includes("services") || changed.includes("plans")) reconcileFormChoices(next);
      current = next;
      appliedRevision = Number(result.revision);
      root.documentElement.dataset.siteContentReady = "true";
      if (changed.length)
        root.dispatchEvent(new CustomEvent("vss:content-updated", {
          detail: { content: current, revision: appliedRevision, changed },
        }));
      return changed.length > 0;
    },
  };
}
