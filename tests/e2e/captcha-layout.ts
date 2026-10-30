// Read-only, closure-free snapshot: Playwright serializes this into the page.
// One synchronous read keeps every rectangle in the same layout state.
export function readCaptchaLayout(form: HTMLFormElement, expected: { viewport: number; draftSelector: string }) {
  const container = form.querySelector<HTMLElement>('[data-captcha]');
  const widget = container?.querySelector<HTMLElement>('[data-captcha-widget]');
  const frames = widget?.querySelectorAll('iframe');
  const frame = frames?.[0];
  const status = container?.querySelector<HTMLElement>('[data-captcha-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const draft = form.querySelector<HTMLInputElement>(expected.draftSelector);
  if (!container || !widget || !frame || !status || !button || !draft) return { ready: false };
  const bounds = container.getBoundingClientRect();
  const box = frame.getBoundingClientRect();
  const statusBox = status.getBoundingClientRect();
  const buttonBox = button.getBoundingClientRect();
  const viewport = window.innerWidth;
  const compact = bounds.width < 300;
  return {
    ready: true,
    viewportReady: viewport === expected.viewport,
    complete: status.textContent === 'Verification complete.',
    oneWidget: frames!.length === 1,
    sizeMatches: widget.dataset.captchaSize === (compact ? 'compact' : 'flexible'),
    widthMatches: Math.abs(box.width - (compact ? 150 : bounds.width)) < 0.5,
    heightMatches: box.height === (compact ? 140 : 65),
    insideContainer: box.left >= bounds.left && box.right <= bounds.right + 1,
    insideViewport: box.left >= 0 && box.right <= viewport + 1,
    statusBelowWidget: statusBox.top >= box.bottom,
    buttonBelowStatus: buttonBox.top >= statusBox.bottom,
    draftPreserved: draft.value === 'visitor@example.test',
    pageFits: document.documentElement.scrollWidth <= viewport,
    // Keep actual measurements in polling failures instead of a bare boolean.
    geometry: {
      viewport, containerWidth: bounds.width, size: widget.dataset.captchaSize,
      frameLeft: box.left, frameRight: box.right, frameWidth: box.width,
      frameHeight: box.height, frameBottom: box.bottom,
      statusTop: statusBox.top, statusBottom: statusBox.bottom, buttonTop: buttonBox.top,
    },
  };
}
