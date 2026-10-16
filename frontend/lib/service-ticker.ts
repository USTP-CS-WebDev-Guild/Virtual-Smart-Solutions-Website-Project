import type { ServiceContent } from "../../shared/site-content/defaults";

// The duplicate is visual only. Screen readers receive the service list once.
export function renderServiceTicker(services: ServiceContent[]) {
  for (const track of document.querySelectorAll<HTMLElement>(
    "[data-public-service-strip]",
  )) {
    const titles = services.filter((item) => item.published).map((item) => item.title);
    const groups = [...track.querySelectorAll<HTMLElement>(".vss-ticker-group")];
    if (groups.length === 2 && groups.every((group) => JSON.stringify([...group.querySelectorAll("span")].map((node) => node.textContent?.trim())) === JSON.stringify(titles)))
      continue;
    track.replaceChildren();
    for (const duplicate of [false, true]) {
      const group = document.createElement("div");
      group.className = "vss-ticker-group";
      if (duplicate) group.setAttribute("aria-hidden", "true");
      for (const service of services.filter((item) => item.published)) {
        const text = document.createElement("span");
        text.textContent = service.title;
        const decoration = document.createElement("i");
        decoration.textContent = "·";
        decoration.className = "vss-motion-loop";
        decoration.setAttribute("aria-hidden", "true");
        group.append(text, decoration);
      }
      track.append(group);
    }
  }
}
