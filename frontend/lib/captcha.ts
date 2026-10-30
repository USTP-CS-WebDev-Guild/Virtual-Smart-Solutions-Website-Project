type Turnstile = {
  ready(callback: () => void): void;
  render(element: HTMLElement, options: Record<string, unknown>): string | undefined;
  getResponse(id: string): string | undefined;
  isExpired(id: string): boolean;
  reset(id: string): void;
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
    const ready = () => {
      if (settled) return;
      const service = window.turnstile;
      if (!service) return fail();
      try {
        service.ready(() => {
          if (settled) return;
          settled = true; window.clearTimeout(timeout); resolve(service);
        });
      } catch { fail(); }
    };
    if (window.turnstile) ready();
    else {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true;
      script.onload = ready;
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
    const invalid = (message: string) => { widget.verified = false; status.textContent = message; };
    const id = service.render(target, {
      sitekey: container.dataset.sitekey,
      action: container.dataset.captchaAction,
      size: 'compact', theme: 'light', 'response-field': false,
      'refresh-expired': 'auto', 'refresh-timeout': 'auto',
      callback: () => { widget.verified = true; status.textContent = 'Verification complete.'; },
      'expired-callback': () => invalid('Verification expired. Refreshing verification…'),
      'timeout-callback': () => invalid('Verification timed out. Please try the check again.'),
      'error-callback': () => invalid('Verification is unavailable. Check your connection or reload.'),
      'unsupported-callback': () => invalid('Please use an up-to-date browser to complete verification.'),
    });
    if (!id) throw new Error('verification_unavailable');
    widget.id = id;
    widgets.set(form, widget);
  } catch { status.textContent = 'Verification could not load. Check your connection and reload.'; }
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
