// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupNavigation } from '../../frontend/lib/navigation';
import { installNavigationObserver, type NavigationSnapshot } from '../e2e/navigation-observer';

let cleanup: (() => void) | undefined;
let recorded: NavigationSnapshot[];
const sink = window as typeof window & {
  __vssRecordNavigation?: (snapshot: NavigationSnapshot) => Promise<unknown>;
};
beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.motion = 'off';
  document.body.innerHTML = `<header class="vss-header"><button id="mobile-menu-toggle" aria-expanded="false"></button><div data-menu-backdrop hidden></div><nav id="mobile-menu" style="opacity:1" hidden><a href="/portfolio/">Our work</a></nav></header><main id="main">Content</main>`;
  const bounds = new DOMRect(12, 70, 380, 420);
  // DOM-unit environments do not lay out boxes. Native browser coverage still
  // supplies actual geometry; these regressions exercise lifecycle observation.
  document.querySelector<HTMLElement>('#mobile-menu')!.getBoundingClientRect = () => bounds;
  document.querySelector<HTMLElement>('#main')!.getBoundingClientRect = () => new DOMRect(0, 64, 811, 800);
  recorded = [];
  sink.__vssRecordNavigation = async (snapshot) => { recorded.push(snapshot); };
  cleanup = setupNavigation();
  document.querySelector<HTMLButtonElement>('#mobile-menu-toggle')!.click();
});
afterEach(() => {
  // Runs the observer's once-only cleanup even if a test assertion fails.
  window.dispatchEvent(new Event('beforeunload'));
  cleanup?.();
  delete sink.__vssRecordNavigation;
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

it('records real navigation state after app handlers and at departure without blocking either event', () => {
  // page.evaluate serializes the function, so imported module closures must
  // not be needed by the observer installed into the page.
  const install = new Function('return (' + installNavigationObserver.toString() + ')')();
  install();
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  const link = document.querySelector<HTMLAnchorElement>('#mobile-menu a')!;
  expect(link.dispatchEvent(click)).toBe(true);
  const departure = new Event('beforeunload', { cancelable: true });
  expect(window.dispatchEvent(departure)).toBe(true);
  expect(click.defaultPrevented).toBe(false);
  expect(departure.defaultPrevented).toBe(false);
  expect(recorded.map((snapshot) => snapshot.phase)).toEqual(['click', 'beforeunload']);
  for (const snapshot of recorded) {
    expect(snapshot.visible).toBe(true);
    expect(snapshot.inert).toBe(false);
    expect(snapshot.navigationOpen).toBe('true');
    expect(snapshot.expanded).toBe('true');
  }
  expect(link.getAttribute('href')).toBe('/portfolio/');
});

it('reports early closure as a failure state rather than restoring or masking the menu', () => {
  // Simulate the regression the native acceptance check must catch.
  window.addEventListener('click', () => {
    const menu = document.querySelector<HTMLElement>('#mobile-menu')!;
    menu.hidden = true;
    menu.inert = true;
    document.documentElement.dataset.navigationOpen = 'false';
    document.querySelector('#mobile-menu-toggle')!.setAttribute('aria-expanded', 'false');
  }, { once: true });
  installNavigationObserver();
  document.querySelector('#mobile-menu a')!.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true,
  }));
  window.dispatchEvent(new Event('beforeunload'));
  expect(recorded.map((snapshot) => snapshot.phase)).toEqual(['click', 'beforeunload']);
  for (const snapshot of recorded) {
    expect(snapshot.visible).toBe(false);
    expect(snapshot.inert).toBe(true);
    expect(snapshot.navigationOpen).toBe('false');
    expect(snapshot.expanded).toBe('false');
  }
  expect(document.querySelector<HTMLElement>('#mobile-menu')!.hidden).toBe(true);
});
