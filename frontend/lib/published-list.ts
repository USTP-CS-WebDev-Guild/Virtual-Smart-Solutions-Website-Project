/* Update only changed CMS rows. Reusing a node keeps its decoded photo,
   keyboard focus, open state and ongoing animation intact. */
const versions = new WeakMap<Element, string>();
export function reconcilePublishedList<T extends { id: string }>(
  container: HTMLElement,
  items: T[],
  attribute: string,
  build: (item: T, index: number) => HTMLElement,
  previous: T[] = [],
) {
  const doc = container.ownerDocument;
  const focused = container.contains(doc.activeElement) ? doc.activeElement as HTMLElement : null;
  const old = new Map(
    [...container.children].map((node) => [node.getAttribute(attribute), node]),
  );
  const baseline = new Map(previous.map((item) => [item.id, item]));
  const wanted = new Set<Element>();
  items.forEach((item, index) => {
    let node = old.get(item.id);
    const version = JSON.stringify(item);
    const prior = node && (versions.get(node) ?? JSON.stringify(baseline.get(item.id)));
    if (!node || version !== prior) {
      const replacement = build(item, index);
      if (node instanceof HTMLDetailsElement && replacement instanceof HTMLDetailsElement)
        replacement.open = node.open;
      node?.replaceWith(replacement);
      node = replacement;
    }
    node.setAttribute(attribute, item.id);
    versions.set(node, version);
    wanted.add(node);
    if (container.children[index] !== node)
      container.insertBefore(node, container.children[index] ?? null);
  });
  for (const child of [...container.children])
    if (!wanted.has(child)) child.remove();
  if (focused?.isConnected && doc.activeElement !== focused)
    focused.focus({ preventScroll: true });
}
