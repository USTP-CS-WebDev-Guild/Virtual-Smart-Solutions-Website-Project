// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
let captcha: typeof import('../../frontend/lib/captcha');
function form(action = 'inquiry') {
  const element = document.createElement('form');
  element.innerHTML = `<div data-captcha data-sitekey="0x4SYNTHETIC_SITEKEY_123456" data-captcha-action="${action}"><div data-captcha-widget></div><p data-captcha-status></p></div>`;
  document.body.append(element); return element;
}
function provider() {
  const options: Array<Record<string, any>> = [];
  const api = {
    ready: (callback: () => void) => callback(),
    render: vi.fn((_element: HTMLElement, config: Record<string, any>) => { options.push(config); return 'widget-' + options.length; }),
    getResponse: vi.fn(() => 'synthetic-one-use-token'), isExpired: vi.fn(() => false), reset: vi.fn(),
  };
  window.turnstile = api;
  return { api, options };
}
beforeEach(async () => { vi.resetModules(); document.body.replaceChildren(); delete window.turnstile; captcha = await import('../../frontend/lib/captcha'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete window.turnstile; document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((script) => script.remove()); });
describe('Turnstile form lifecycle', () => {
  it('leaves no-key classroom forms independent of the provider', async () => {
    const element = document.createElement('form'); document.body.append(element);
    await captcha.attachCaptcha(element); expect(captcha.captchaToken(element)).toBe('');
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });
  it('shares script readiness and renders each form once, with separate actions and a narrow-screen widget', async () => {
    const { api, options } = provider(); const contact = form(); const privacy = form('privacy_request');
    await Promise.all([captcha.attachCaptcha(contact), captcha.attachCaptcha(contact), captcha.attachCaptcha(privacy)]);
    expect(api.render).toHaveBeenCalledTimes(2);
    expect(options.map((option) => option.action)).toEqual(['inquiry', 'privacy_request']);
    expect(options[0]).toMatchObject({ size: 'compact', theme: 'light', 'response-field': false });
    expect(() => captcha.captchaToken(contact)).toThrow('complete the verification');
    options[0].callback(); expect(captcha.captchaToken(contact)).toBe('synthetic-one-use-token');
    expect(() => captcha.captchaToken(privacy)).toThrow();
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
