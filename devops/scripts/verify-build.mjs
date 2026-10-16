import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { checkFooterContrast } from './check-footer-contrast.mjs';

// Inspect emitted HTML without executing scripts or contacting a website.
// This protects the non-JavaScript fallback; it is not a visual browser test.
const release = JSON.parse(await readFile('package.json', 'utf8')).version;
const pages = [
  '/',
  '/services/',
  '/portfolio/',
  '/about/',
  '/approach/',
  '/contact/',
  '/privacy/',
  '/admin/',
];
let assetChecks = 0;
let contrastChecks = 0;
let minimumContrast = 21;
let menuChecks = 0;
for (const page of pages) {
  const html = await readFile(resolve('dist', '.' + page, 'index.html'), 'utf8');
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
    },
  });
  try {
    const doc = new window.DOMParser().parseFromString(html, 'text/html');
    if (doc.querySelector('.test-environment-banner'))
      throw new Error('The removed public test banner returned.');
    if (doc.querySelector('meta[name="app-release"]')?.getAttribute('content') !== release)
      throw new Error(`Wrong release metadata on ${page}`);
    if ([...doc.querySelectorAll('h1')].filter((node) => !node.closest('[hidden]')).length !== 1)
      throw new Error(`Expected one page heading on ${page}`);
    for (const form of doc.querySelectorAll('form')) {
      // Local-only workspace search fields have no name, so the browser cannot
      // serialize them into a URL. The signed-out workspace is hidden above.
      if (
        form.getAttribute('role') === 'search' &&
        form.closest('#admin-app') &&
        !form.querySelector('[name]')
      )
        continue;
      // A native confirmation dialog returns a local button value; it never
      // submits credentials or a network request.
      if (
        form.getAttribute('method') === 'dialog' &&
        form.closest('#workspace-confirm') &&
        !form.querySelector('input,textarea,select')
      )
        continue;
      if (form.method.toLowerCase() !== 'post')
        throw new Error(`A form could expose fields in a URL on ${page}`);
      if (!form.querySelector('button[type="submit"][disabled]') || !form.querySelector('noscript'))
        throw new Error(`The secure form fallback is missing on ${page}`);
    }
    for (const card of doc.querySelectorAll('[data-public-services] article'))
      if (!card.querySelector('h3')?.textContent.trim())
        throw new Error(`Service heading missing from HTML on ${page}`);
    for (const node of doc.querySelectorAll(
      'img[src],script[src],link[rel="stylesheet"][href],link[rel="preload"][href],link[rel="icon"][href]',
    )) {
      const value = node.getAttribute('src') || node.getAttribute('href');
      if (!value?.startsWith('/')) continue;
      const path = new URL(value, 'https://build.invalid').pathname;
      await access(resolve('dist', '.' + path));
      assetChecks++;
    }
    const workspace = doc.getElementById('admin-app');
    if (workspace && !workspace.hidden)
      throw new Error('Private workspace must start hidden in the public HTML.');
    if (doc.body.classList.contains('public-page')) {
      const menu = doc.getElementById('mobile-menu');
      const toggle = doc.getElementById('mobile-menu-toggle');
      if (
        !menu?.hidden ||
        !menu.hasAttribute('inert') ||
        toggle?.getAttribute('aria-expanded') !== 'false'
      )
        throw new Error(`Navigation must start closed and inert on ${page}`);
      if (!doc.querySelector('[data-menu-backdrop][hidden]'))
        throw new Error(`Closed navigation backdrop missing on ${page}`);
      if (['/', '/services/', '/portfolio/', '/about/', '/approach/', '/contact/'].includes(page)) {
        const selected = menu.querySelector('a[aria-current="page"]');
        if (selected?.getAttribute('href') !== page)
          throw new Error(`Mobile navigation has the wrong selected page on ${page}`);
      }
      for (const font of ['bricolage', 'dm-sans'])
        if (!doc.querySelector(`link[rel="preload"][href="/fonts/${font}.woff2"][as="font"]`))
          throw new Error(`Missing ${font} font preload on ${page}`);
      menuChecks++;
    }
    const chooser = doc.querySelector('[data-explorer-choices]');
    if (chooser) {
      if (chooser.hidden || !chooser.children.length)
        throw new Error('Service choices must occupy their layout before JavaScript runs.');
      const panels = doc.querySelectorAll('[data-explorer-item]');
      if (
        panels.length !== chooser.children.length ||
        doc.querySelectorAll('[data-explorer-item][data-active="true"]').length !== 1
      )
        throw new Error('Service panels must be pre-rendered with exactly one active region.');
      for (const button of chooser.querySelectorAll('button'))
        if (!doc.getElementById(button.getAttribute('aria-controls')))
          throw new Error('A service choice does not point to its rendered panel.');
      for (const panel of panels)
        if (
          panel.getAttribute('data-active') === 'false' &&
          (!panel.hasAttribute('inert') || panel.getAttribute('aria-hidden') !== 'true')
        )
          throw new Error(
            'Inactive service regions must be inert and hidden from assistive technology.',
          );
    }
    const work = doc.querySelector('[data-public-portfolio]');
    if (work?.querySelector('article')) {
      if (
        !doc.querySelector('[data-work-filters] button') ||
        doc.querySelector('[data-work-tools]')?.hidden
      )
        throw new Error('Work filters must occupy their layout before JavaScript runs.');
      if (work.querySelectorAll('.is-work-featured').length !== 1)
        throw new Error(
          'Work must render its initial featured-card layout before JavaScript runs.',
        );
    }
    const contrast = await checkFooterContrast(window, doc, async (href) =>
      readFile(resolve('dist', '.' + new URL(href, 'https://build.invalid').pathname), 'utf8'),
    );
    contrastChecks += contrast.checks;
    minimumContrast = Math.min(minimumContrast, contrast.minimum);
  } finally {
    await window.happyDOM.abort();
  }
}
console.log(
  `PASS built HTML: ${pages.length} routes, ${assetChecks} local asset references, protected workspace and fail-closed POST forms.`,
);
console.log(
  `PASS footer contrast: ${contrastChecks} text checks, minimum ${minimumContrast.toFixed(2)}:1 (required 4.5:1). No public test banner.`,
);
console.log(
  `PASS initial public state: ${menuChecks} closed menus with selected-page state and both font preloads; pre-rendered service panels and work filters.`,
);
