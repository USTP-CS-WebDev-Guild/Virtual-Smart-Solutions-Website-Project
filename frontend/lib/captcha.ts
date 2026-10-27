type HCaptcha = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  getResponse(id: string): string;
  reset(id: string): void;
};
declare global { interface Window { hcaptcha?: HCaptcha; } }
let loading: Promise<HCaptcha> | undefined;
const widgets = new WeakMap<HTMLFormElement, string>();
function load(): Promise<HCaptcha> {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
  return loading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('verification_unavailable')), 12000);
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true; script.defer = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.hcaptcha) resolve(window.hcaptcha);
      else reject(new Error('verification_unavailable'));
    };
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error('verification_unavailable')); };
    document.head.append(script);
  });
}
export async function attachCaptcha(form: HTMLFormElement) {
  const container = form.querySelector<HTMLElement>('[data-captcha]');
  if (!container) return;
  const status = container.querySelector<HTMLElement>('[data-captcha-status]')!;
  try {
    const service = await load();
    const widget = service.render(container.querySelector<HTMLElement>('[data-captcha-widget]')!, {
      sitekey: container.dataset.sitekey, size: 'compact',
      callback: () => { status.textContent = 'Verification complete.'; },
      'expired-callback': () => { status.textContent = 'Complete verification again before sending.'; },
      'error-callback': () => { status.textContent = 'Verification is unavailable. Reload and try again.'; },
    });
    widgets.set(form, widget); status.textContent = 'Complete the verification before continuing.';
  } catch { status.textContent = 'Verification could not load. Check your connection and reload.'; }
}
export function captchaToken(form: HTMLFormElement): string {
  if (!form.querySelector('[data-captcha]')) return '';
  const id = widgets.get(form);
  const token = id === undefined ? '' : window.hcaptcha?.getResponse(id) || '';
  if (!token) throw new Error('Please complete the verification before continuing.');
  return token;
}
export function resetCaptcha(form: HTMLFormElement) {
  const id = widgets.get(form);
  if (id !== undefined) window.hcaptcha?.reset(id);
}
