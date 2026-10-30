// @vitest-environment happy-dom
// Synthetic geometry checks validate the browser observer's acceptance rules;
// they are not evidence of native layout or browser-suite execution.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCaptchaLayout } from '../e2e/captcha-layout';

let form: HTMLFormElement;
function rect(selector: string, x: number, y: number, width: number, height: number) {
  vi.spyOn(form.querySelector(selector)!, 'getBoundingClientRect').mockReturnValue({
    x, y, left: x, top: y, width, height, right: x + width, bottom: y + height,
  } as DOMRect);
}
function snapshot() { return readCaptchaLayout(form, { viewport: 320, draftSelector: 'input' }); }
beforeEach(() => {
  form = document.createElement('form');
  form.innerHTML = '<input value="visitor@example.test"><div data-captcha><div data-captcha-widget data-captcha-size="compact"><iframe></iframe></div><p data-captcha-status>Verification complete.</p></div><button type="submit">Send</button>';
  // Keep the synthetic iframe detached; this test uses mocked rectangles and
  // must not start iframe transport in the DOM-only environment.
  document.body.replaceChildren();
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
  vi.spyOn(document.documentElement, 'scrollWidth', 'get').mockReturnValue(320);
  rect('[data-captcha]', 40, 200, 230, 180);
  rect('iframe', 40, 200, 150, 140);
  rect('[data-captcha-status]', 40, 348, 230, 20);
  rect('button', 40, 388, 230, 50);
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
describe('CAPTCHA browser layout snapshot', () => {
  it('accepts a complete compact widget, separated status/button and preserved draft', () => {
    expect(snapshot()).toMatchObject({
      ready: true, viewportReady: true, complete: true, oneWidget: true,
      sizeMatches: true, widthMatches: true, heightMatches: true,
      insideContainer: true, insideViewport: true, statusBelowWidget: true,
      buttonBelowStatus: true, draftPreserved: true, pageFits: true,
    });
  });
  it('rejects a horizontal widget that overflows a narrow form', () => {
    rect('iframe', 40, 200, 300, 65);
    expect(snapshot()).toMatchObject({ widthMatches: false, heightMatches: false, insideContainer: false, insideViewport: false });
  });
  it('accepts a complete flexible widget when at least 300px is available', () => {
    form.querySelector<HTMLElement>('[data-captcha-widget]')!.dataset.captchaSize = 'flexible';
    rect('[data-captcha]', 10, 200, 300, 105);
    rect('iframe', 10, 200, 300, 65);
    rect('[data-captcha-status]', 10, 273, 300, 20);
    expect(snapshot()).toMatchObject({ sizeMatches: true, widthMatches: true, heightMatches: true, insideViewport: true, statusBelowWidget: true });
  });
  it('rejects genuine status/widget overlap without increasing tolerance', () => {
    rect('[data-captcha-status]', 40, 339, 230, 20);
    expect(snapshot()).toMatchObject({ statusBelowWidget: false });
  });
  it('rejects an obsolete size selection and viewport before resize handling completes', () => {
    form.querySelector<HTMLElement>('[data-captcha-widget]')!.dataset.captchaSize = 'flexible';
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    expect(snapshot()).toMatchObject({ viewportReady: false, sizeMatches: false });
  });
  it('requires one widget and detects a lost draft', () => {
    form.querySelector('[data-captcha-widget]')!.append(document.createElement('iframe'));
    form.querySelector('input')!.value = '';
    expect(snapshot()).toMatchObject({ oneWidget: false, draftPreserved: false });
  });
  it('runs without the test module closure when serialized into a browser page', () => {
    const serialized = new Function(`return (${readCaptchaLayout.toString()})`)() as typeof readCaptchaLayout;
    expect(serialized(form, { viewport: 320, draftSelector: 'input' })).toEqual(snapshot());
  });
});
