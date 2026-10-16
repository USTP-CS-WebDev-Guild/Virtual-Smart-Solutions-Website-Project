/* Deferred preference boot. No page-transition listeners or render blocking. */
(function () {
  var root = document.documentElement;
  var enabled = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    enabled = enabled && localStorage.getItem("vss-motion") !== "off";
  } catch (_) {}
  root.dataset.motion = enabled ? "on" : "off";
  root.dataset.pageVisible = String(document.visibilityState !== "hidden");
})();
