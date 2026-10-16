import { supabase } from "../lib/supabase";
import { connectLiveUpdates } from "../lib/live-updates";
import { createPublicContentController } from "../lib/public-content";

const content = createPublicContentController();
async function loadPublicContent() {
  const response = await fetch("/api/public/content", {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("content_unavailable");
  content.apply(await response.json());
}
void loadPublicContent().catch(() => {});
let stopPublic: (() => void) | null = null;
function startPublicLive() {
  stopPublic?.();
  if (supabase)
    stopPublic = connectLiveUpdates(supabase, ["public"], {
      changed: loadPublicContent,
      state: (state) => {
        document.documentElement.dataset.contentConnection = state;
      },
    });
}
startPublicLive();
window.addEventListener("pagehide", () => {
  stopPublic?.();
  stopPublic = null;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) startPublicLive();
});
