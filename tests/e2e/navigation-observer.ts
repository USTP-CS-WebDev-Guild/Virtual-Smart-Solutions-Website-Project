// Test-only instrumentation. Installed before the real click. Nothing here
// prevents navigation, changes the DOM or queries a page after it starts leaving.
export type NavigationSnapshot = {
  phase: 'click' | 'beforeunload';
  path: string;
  defaultPrevented: boolean;
  visible: boolean;
  inert: boolean | undefined;
  navigationOpen: string | undefined;
  expanded: string | null | undefined;
  menu: { x: number; y: number; width: number; height: number } | undefined;
  main: { x: number; y: number; width: number; height: number } | undefined;
};

// Keep this function self-contained: Playwright serializes it into the browser.
export function installNavigationObserver() {
  const sink = window as typeof window & {
    __vssRecordNavigation: (snapshot: NavigationSnapshot) => Promise<unknown>;
  };
  const record = (phase: NavigationSnapshot['phase'], defaultPrevented = false) => {
    const menu = document.querySelector<HTMLElement>('#mobile-menu');
    const main = document.querySelector<HTMLElement>('#main');
    const style = menu ? getComputedStyle(menu) : null;
    const menuBounds = menu?.getBoundingClientRect();
    const mainBounds = main?.getBoundingClientRect();
    const snapshot: NavigationSnapshot = {
      phase,
      path: location.pathname,
      defaultPrevented,
      visible: Boolean(menu?.isConnected && !menu.hidden &&
        style?.display !== 'none' && style?.visibility !== 'hidden' &&
        style?.visibility !== 'collapse' && Number(style?.opacity) > 0 &&
        menuBounds && menuBounds.width > 0 && menuBounds.height > 0),
      inert: menu?.inert,
      navigationOpen: document.documentElement.dataset.navigationOpen,
      expanded: document.querySelector('#mobile-menu-toggle')?.getAttribute('aria-expanded'),
      menu: menuBounds && {
        x: menuBounds.x, y: menuBounds.y, width: menuBounds.width, height: menuBounds.height,
      },
      main: mainBounds && {
        x: mainBounds.x, y: mainBounds.y, width: mainBounds.width, height: mainBounds.height,
      },
    };
    // Send synchronously; do not await a reply in a document that is unloading.
    // The binding's reply can be abandoned when the real navigation commits.
    void sink.__vssRecordNavigation(snapshot).catch(() => {});
  };
  const click = (event: MouseEvent) => {
    const link = event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>('#mobile-menu a[href]') : null;
    if (link) record('click', event.defaultPrevented);
  };
  const departure = () => {
    record('beforeunload');
    window.removeEventListener('click', click);
  };
  // Window bubbling runs after the app's menu/document click handlers.
  window.addEventListener('click', click);
  window.addEventListener('beforeunload', departure, { once: true });
}
