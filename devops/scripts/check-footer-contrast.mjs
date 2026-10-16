// Read the emitted styles, including the real cascade. No screenshot or browser
// rendering is implied: this check catches unreadable foreground/background pairs.
function rgb(value) {
  if (!value || value === "transparent") return null;
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4)
      hex = [...hex].map((n) => n + n).join("");
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const parts = value.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3 || parts[3] === 0) return null;
  return parts.slice(0, 3);
}
function luminance(color) {
  const channels = color.map((n) => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export async function checkFooterContrast(window, doc, loadStylesheet) {
  const footer = doc.querySelector(".vss-footer");
  if (!footer) return { checks: 0, minimum: 21 };
  for (const link of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
    const style = doc.createElement("style");
    style.textContent = await loadStylesheet(link.getAttribute("href"));
    doc.head.append(style);
  }
  let checks = 0;
  let minimum = 21;
  for (const node of footer.querySelectorAll(
    "a,h3,p,span,strong,small,button",
  )) {
    if (!node.textContent.trim() || node.closest('[aria-hidden="true"]'))
      continue;
    const foreground = rgb(window.getComputedStyle(node).color);
    let background = null;
    for (
      let parent = node;
      parent && !background;
      parent = parent.parentElement
    )
      background = rgb(window.getComputedStyle(parent).backgroundColor);
    if (!foreground || !background)
      throw new Error("Could not verify a footer text color.");
    const a = luminance(foreground);
    const b = luminance(background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5)
      throw new Error(
        `Footer contrast ${ratio.toFixed(2)}:1 is below 4.5:1: ${node.textContent.trim().slice(0, 45)}`,
      );
    minimum = Math.min(minimum, ratio);
    checks++;
  }
  return { checks, minimum };
}
