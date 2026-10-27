// APP_ENV is a server setting, never a browser flag or request parameter.
export function productionMode(): boolean {
  return process.env.APP_ENV === 'production' ||
    (process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production' &&
      process.env.PUBLIC_TEST_ENVIRONMENT === 'false');
}

export function canonicalOrigin(value = process.env.APP_ORIGIN): string | null {
  try {
    const url = new URL(value || '');
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      return null;
    if (url.protocol !== 'https:' && !(process.env.CONTEXT === 'dev' &&
      url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
      return null;
    return url.origin;
  } catch { return null; }
}

export function captchaConfigurationReady(): boolean {
  const sitekey = process.env.PUBLIC_HCAPTCHA_SITE_KEY || '';
  const secret = process.env.HCAPTCHA_SECRET_KEY || '';
  return Boolean(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sitekey) && !/-ffff-ffff-ffff-/i.test(sitekey) &&
    secret.length >= 16 && !/^0x0+$/.test(secret));
}

export function productionConfigurationReady(): boolean {
  return Boolean(canonicalOrigin() && process.env.PUBLIC_TEST_ENVIRONMENT === 'false' &&
    (process.env.RATE_LIMIT_SECRET || '').trim().length >= 32 && captchaConfigurationReady());
}
