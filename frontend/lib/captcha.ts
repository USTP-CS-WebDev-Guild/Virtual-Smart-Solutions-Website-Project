type Turnstile = {
  render(element: HTMLElement, options: Record<string, unknown>): string | undefined;
  getResponse(id: string): string | undefined;
  isExpired(id: string): boolean;
  reset(id: string): void;
  remove(id: string): void;
};
declare global { interface Window { turnstile?: Turnstile; } }
let loading: Promise<Turnstile> | undefined;
const widgets = new WeakMap<HTMLFormElement, { id: string; verified: boolean }>();
const attaching = new WeakSet<HTMLFormElement>();

function load(): Promise<Turnstile> {
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    let script: HTMLScriptElement | undefined;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script?.remove();
      reject(new Error('verification_unavailable'));
    };
    const timeout = window.setTimeout(fail, 12000);
    const loaded = () => {
      if (settled) return;
      const service = window.turnstile;
      if (!service || typeof service.render !== 'function') return fail();
      // The load event runs after api.js has initialized its public API.
      // ready() is only supported for blocking scripts: Cloudflare throws
      // error 3857 when it is called after an async/defer load.
      settled = true; window.clearTimeout(timeout); resolve(service);
    };
    if (window.turnstile) loaded();
    else {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true;
      script.onload = loaded;
      script.onerror = fail;
      document.head.append(script);
    }
  }).catch((error: unknown) => { loading = undefined; throw error; });
  return loading;
}

export async function attachCaptcha(form: HTMLFormElement) {
  const container = form.querySelector<HTMLElement>('[data-captcha]');
  if (!container || widgets.has(form) || attaching.has(form)) return;
  const status = container.querySelector<HTMLElement>('[data-captcha-status]')!;
  const target = container.querySelector<HTMLElement>('[data-captcha-widget]')!;
  attaching.add(form);
  status.textContent = 'Verifying your browser…';
  try {
    const service = await load();
    if (!form.isConnected) return;
    const widget = { id: '', verified: false };
    let renderedSize: 'compact' | 'flexible' | undefined;
    let generation = 0;
    const render = (width: number) => {
      // Flexible Turnstile is at least 300px wide. Measure the actual form
      // space, including narrow cards inside otherwise wide viewports.
      const size = width >= 300 ? 'flexible' : 'compact';
      if (size === renderedSize) return;
      const current = ++generation;
      widget.verified = false;
      status.textContent = 'Verifying your browser…';
      if (widget.id) {
        const previous = widget.id; widget.id = '';
        service.remove(previous);
      }
      target.dataset.captchaSize = size;
      // Removed widgets must not verify or invalidate their replacement.
      const active = () => current === generation && form.isConnected;
      const invalid = (message: string) => { if (active()) { widget.verified = false; status.textContent = message; } };
      const id = service.render(target, {
        sitekey: container.dataset.sitekey,
        action: container.dataset.captchaAction,
        size, theme: 'light', 'response-field': false,
        'refresh-expired': 'auto', 'refresh-timeout': 'auto',
        callback: () => { if (active()) { widget.verified = true; status.textContent = 'Verification complete.'; } },
        'expired-callback': () => invalid('Verification expired. Refreshing verification…'),
        'timeout-callback': () => invalid('Verification timed out. Please try the check again.'),
        'error-callback': () => invalid('Verification is unavailable. Reload this page to try again.'),
        'unsupported-callback': () => invalid('Please use an up-to-date browser to complete verification.'),
      });
      if (!id) throw new Error('verification_unavailable');
      widget.id = id; renderedSize = size;
    };
    render(container.getBoundingClientRect().width);
    widgets.set(form, widget);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (!form.isConnected) {
          observer.disconnect(); ++generation; widget.verified = false;
          try { service.remove(widget.id); } catch { /* The form has already left the page. */ }
          widgets.delete(form); return;
        }
        const width = container.getBoundingClientRect().width;
        // Hiding the login form after sign-in must not start another challenge.
        if (width <= 0) return;
        try { render(width); }
        catch {
          observer.disconnect(); ++generation; widget.verified = false;
          status.textContent = 'Verification could not load. Reload this page to try again.';
        }
      });
      observer.observe(container);
    }
  } catch { status.textContent = 'Verification could not load. Reload this page to try again.'; }
  finally { attaching.delete(form); }
}

export function captchaToken(form: HTMLFormElement): string {
  if (!form.querySelector('[data-captcha]')) return '';
  const widget = widgets.get(form);
  try {
    const service = window.turnstile;
    if (widget?.verified && service && !service.isExpired(widget.id)) {
      const token = service.getResponse(widget.id);
      if (token && token.length <= 2048) return token;
    }
  } catch { /* Provider details must not appear in visitor error messages. */ }
  throw new Error('Please complete the verification before continuing.');
}

export function resetCaptcha(form: HTMLFormElement) {
  const widget = widgets.get(form);
  if (!widget) return;
  widget.verified = false;
  const status = form.querySelector<HTMLElement>('[data-captcha-status]');
  if (status) status.textContent = 'Verifying your browser…';
  try { window.turnstile?.reset(widget.id); }
  catch { if (status) status.textContent = 'Verification could not refresh. Reload and try again.'; }
}
