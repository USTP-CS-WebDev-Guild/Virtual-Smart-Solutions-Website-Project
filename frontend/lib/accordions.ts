import { navigationMotionAllowed } from "./navigation";

// Delegate to native <details>: keyboard, links and no-JS behavior stay intact.
// Closing keeps the row open only until its measured height animation finishes.
export function setupAccordions(root: Document = document) {
  const pending = new Map<
    HTMLDetailsElement,
    { animation: Animation; next: boolean }
  >();
  const settle = () => {
    for (const [row, task] of pending) {
      task.animation.cancel();
      row.open = task.next;
    }
    pending.clear();
  };
  const click = (event: Event) => {
    const summary = (event.target as Element).closest("summary");
    const row = summary?.parentElement;
    if (
      !(row instanceof HTMLDetailsElement) ||
      !row.matches(".vss-faq,.vss-comparison") ||
      !navigationMotionAllowed(root) ||
      typeof row.animate !== "function"
    )
      return;
    event.preventDefault();
    const previous = pending.get(row);
    const next = !(previous?.next ?? row.open);
    const from = row.getBoundingClientRect().height;
    previous?.animation.cancel();
    row.open = true;
    const to = next
      ? row.getBoundingClientRect().height
      : summary!.getBoundingClientRect().height;
    const animation = row.animate(
      [
        { height: `${from}px`, overflow: "clip" },
        { height: `${to}px`, overflow: "clip" },
      ],
      { duration: 260, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    pending.set(row, { animation, next });
    void animation.finished.then(
      () => {
        if (pending.get(row)?.animation !== animation) return;
        row.open = next;
        pending.delete(row);
      },
      () => {},
    );
  };
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  root.addEventListener("click", click, true);
  root.addEventListener("vss:motion-change", settle);
  root.addEventListener("vss:content-updated", settle);
  media.addEventListener("change", settle);
  window.addEventListener("pagehide", settle);
  return () => {
    settle();
    root.removeEventListener("click", click, true);
    root.removeEventListener("vss:motion-change", settle);
    root.removeEventListener("vss:content-updated", settle);
    media.removeEventListener("change", settle);
    window.removeEventListener("pagehide", settle);
  };
}
