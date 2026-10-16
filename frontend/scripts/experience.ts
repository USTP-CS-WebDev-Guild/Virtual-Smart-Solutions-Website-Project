import { setupExperience, checkServiceHealth } from "../lib/experience";
import { setupMotion } from "../lib/motion";

setupExperience();
setupMotion();
const health = document.querySelector<HTMLElement>("[data-service-status]");
if (health) void checkServiceHealth(health);
// Check again when a visitor returns online. No background status polling.
window.addEventListener("online", () => {
  if (health) void checkServiceHealth(health);
});
