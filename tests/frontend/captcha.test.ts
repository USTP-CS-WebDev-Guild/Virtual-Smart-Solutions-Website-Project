// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
let captcha: typeof import('../../frontend/lib/captcha');
const observers: Array<{ notify: () => void; disconnect: ReturnType<typeof vi.fn> }> = [];
function setWidth(element: HTMLFormElement, width: number) {
  vi.spyOn(element.querySelector<HTMLElement>('[data-captcha]')!, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
}
function form(action = 'inquiry', width = 600) {
  const element = document.createElement('form');
  element.innerHTML = `<div data-captcha data-sitekey="0x4SYNTHETIC_SITEKEY_123456" data-captcha-action="${action}"><div data-captcha-widget></div><p data-captcha-status></p></div>`;
  document.body.append(element); setWidth(element, width); return element;
}
function provider() {
  const options: Array<Record<string, any>> = [];
  const api = {
    ready: (callback: () => void) => callback(),
    render: vi.fn((_element: HTMLElement, config: Record<string, any>) => { options.push(config); return 'widget-' + options.length; }),
    getResponse: vi.fn(() => 'synthetic-one-use-token'), isExpired: vi.fn(() => false), reset: vi.fn(), remove: vi.fn(),
  };
  window.turnstile = api;
  return { api, options };
}
beforeEach(async () => {
  vi.resetModules(); document.body.replaceChildren(); delete window.turnstile; observers.length = 0;
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    constructor(public notify: () => void) { observers.push(this); }
    observe = vi.fn();
  });
  captcha = await import('../../frontend/lib/captcha');
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete window.turnstile; document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((script) => script.remove()); });
describe('Turnstile form lifecycle', () => {
  it('leaves no-key classroom forms independent of the provider', async () => {
    const element = document.createElement('form'); document.body.append(element);
    await captcha.attachCaptcha(element); expect(captcha.captchaToken(element)).toBe('');
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });
  it('shares script readiness and renders each form once, with separate actions', async () => {
    const { api, options } = provider(); const contact = form(); const privacy = form('privacy_request');
    await Promise.all([captcha.attachCaptcha(contact), captcha.attachCaptcha(contact), captcha.attachCaptcha(privacy)]);
    expect(api.render).toHaveBeenCalledTimes(2);
    expect(options.map((option) => option.action)).toEqual(['inquiry', 'privacy_request']);
    expect(options[0]).toMatchObject({ size: 'flexible', theme: 'light', 'response-field': false });
    expect(() => captcha.captchaToken(contact)).toThrow('complete the verification');
    options[0].callback(); expect(captcha.captchaToken(contact)).toBe('synthetic-one-use-token');
    expect(() => captcha.captchaToken(privacy)).toThrow();
  });
  it.each([[299, 'compact'], [300, 'flexible'], [600, 'flexible']])('fits the actual %ipx container using %s size', async (width, size) => {
    const { options } = provider(); await captcha.attachCaptcha(form('inquiry', Number(width)));
    expect(options[0].size).toBe(size);
  });
  it('replaces a widget only across its size boundary, preserves drafts and rejects callbacks from the old widget', async () => {
    const { api, options } = provider(); const element = form('inquiry', 600);
    const draft = document.createElement('input'); draft.value = 'Visitor draft'; element.append(draft);
    await captcha.attachCaptcha(element); options[0].callback();
    setWidth(element, 450); observers[0].notify();
    expect(api.render).toHaveBeenCalledTimes(1); expect(captcha.captchaToken(element)).toBe('synthetic-one-use-token');
    setWidth(element, 250); observers[0].notify();
    expect(api.remove).toHaveBeenCalledWith('widget-1'); expect(options[1].size).toBe('compact');
    expect(draft.value).toBe('Visitor draft'); expect(() => captcha.captchaToken(element)).toThrow();
    options[0].callback(); expect(() => captcha.captchaToken(element)).toThrow();
    options[1].callback(); options[0]['error-callback']();
    expect(captcha.captchaToken(element)).toBe('synthetic-one-use-token');
    expect(api.getResponse).toHaveBeenLastCalledWith('widget-2');
    setWidth(element, 600); observers[0].notify();
    expect(api.remove).toHaveBeenLastCalledWith('widget-2'); expect(options[2].size).toBe('flexible');
    expect(() => captcha.captchaToken(element)).toThrow();
  });
  it('ignores a temporarily hidden form and releases its observer when it leaves the document', async () => {
    const { api } = provider(); const element = form(); await captcha.attachCaptcha(element);
    setWidth(element, 0); observers[0].notify(); expect(api.render).toHaveBeenCalledTimes(1);
    element.remove(); observers[0].notify();
    expect(observers[0].disconnect).toHaveBeenCalledOnce(); expect(api.remove).toHaveBeenCalledWith('widget-1');
  });
  it('fails closed if the provider cannot replace a resized widget', async () => {
    const { api, options } = provider(); const element = form(); await captcha.attachCaptcha(element); options[0].callback();
    api.remove.mockImplementation(() => { throw new Error('private provider detail'); });
    setWidth(element, 250); observers[0].notify(); options[0].callback();
    expect(() => captcha.captchaToken(element)).toThrow(); expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('could not load'); expect(element.textContent).not.toContain('private provider detail');
  });
  it.each(['expired-callback', 'timeout-callback', 'error-callback', 'unsupported-callback'])('rejects stale tokens after %s even if the provider getter still returns a token', async (callback) => {
    const { options } = provider(); const element = form(); await captcha.attachCaptcha(element);
    options[0].callback(); expect(captcha.captchaToken(element)).toBe('synthetic-one-use-token');
    options[0][callback](); expect(() => captcha.captchaToken(element)).toThrow();
  });
  it('resets only the submitted form and refuses an expired provider token', async () => {
    const { api, options } = provider(); const element = form(); await captcha.attachCaptcha(element); options[0].callback();
    api.isExpired.mockReturnValue(true); expect(() => captcha.captchaToken(element)).toThrow();
    api.isExpired.mockReturnValue(false); captcha.resetCaptcha(element);
    expect(api.reset).toHaveBeenCalledWith('widget-1'); expect(() => captcha.captchaToken(element)).toThrow();
  });
  it('handles provider reset errors without interrupting form cleanup or showing provider details', async () => {
    const { api, options } = provider(); const element = form(); await captcha.attachCaptcha(element); options[0].callback();
    api.reset.mockImplementation(() => { throw new Error('private provider detail'); });
    expect(() => captcha.resetCaptcha(element)).not.toThrow();
    expect(element.textContent).toContain('could not refresh'); expect(element.textContent).not.toContain('private provider detail');
  });
  it('renders an async/defer-loaded provider without calling its blocking-script ready method', async () => {
    let script!: HTMLScriptElement;
    vi.spyOn(document.head, 'append').mockImplementation((node) => { script = node as HTMLScriptElement; });
    const element = form(); const attempt = captcha.attachCaptcha(element);
    expect(script.async).toBe(true); expect(script.defer).toBe(true);
    const { api, options } = provider();
    // Cloudflare's real api.js rejects ready() after an async/defer load (3857).
    const ready = vi.spyOn(api, 'ready').mockImplementation(() => { throw new Error('TurnstileError 3857: async/defer ready is unsupported'); });
    script.dispatchEvent(new Event('load')); await attempt;
    expect(ready).not.toHaveBeenCalled(); expect(api.render).toHaveBeenCalledTimes(1);
    options[0].callback(); expect(captcha.captchaToken(element)).toBe('synthetic-one-use-token');
  });
  it('reuses an already-loaded async provider without calling ready', async () => {
    const { api } = provider();
    const ready = vi.spyOn(api, 'ready').mockImplementation(() => { throw new Error('TurnstileError 3857'); });
    await captcha.attachCaptcha(form());
    expect(ready).not.toHaveBeenCalled(); expect(api.render).toHaveBeenCalledTimes(1);
  });
  it('can retry loading after a network failure without attaching a duplicate widget', async () => {
    let script!: HTMLScriptElement;
    vi.spyOn(document.head, 'append').mockImplementation((node) => { script = node as HTMLScriptElement; });
    const element = form(); const attempt = captcha.attachCaptcha(element);
    expect(script.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    script.dispatchEvent(new Event('error')); await attempt;
    expect(element.textContent).toContain('could not load'); expect(() => captcha.captchaToken(element)).toThrow();
    const { api } = provider(); await captcha.attachCaptcha(element); expect(api.render).toHaveBeenCalledTimes(1);
  });
  it('bounds the wait for a blocked verification script and reports an accessible error', async () => {
    vi.useFakeTimers();
    vi.spyOn(document.head, 'append').mockImplementation(() => {});
    const element = form(); const attempt = captcha.attachCaptcha(element);
    await vi.advanceTimersByTimeAsync(12_001); await attempt;
    expect(element.querySelector('[data-captcha-status]')?.textContent).toContain('could not load');
    expect(() => captcha.captchaToken(element)).toThrow();
  });
});
