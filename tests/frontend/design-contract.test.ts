import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The client's explicit palette constraint covers presentation colors, not photos
// or the shared legacy owner/form foundations.
const files = ["vss.css", "experience.css", "motion.css", "brand.css", "navigation.css"];
const hue = (hex: string) => {
  let value = hex.slice(1);
  if (value.length === 3 || value.length === 4)
    value = [...value].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(value.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (d < 0.03) return -1;
  const sat = d / (1 - Math.abs(max + min - 1));
  if (sat < 0.12) return -1;
  let h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
describe("client presentation constraints", () => {
  it("uses neutral/blue public colors without green, mint or teal surfaces", () => {
    const unexpected: string[] = [];
    for (const file of files) {
      const css = readFileSync("frontend/styles/" + file, "utf8");
      for (const [value] of css.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
        const h = hue(value);
        if (h >= 70 && h <= 190) unexpected.push(file + ": " + value);
      }
    }
    expect(unexpected).toEqual([]);
  });
  it("does not opt navigation into page-sized snapshots or render-blocking motion code", () => {
    const css = readFileSync("frontend/styles/motion.css", "utf8");
    expect(css).not.toMatch(
      /@view-transition|view-transition-name|::view-transition-/,
    );
    const layout = readFileSync("frontend/layouts/BaseLayout.astro", "utf8");
    expect(layout).toMatch(
      /<script\s+is:inline\s+defer\s+src="\/motion-init\.js"/,
    );
  });
});
