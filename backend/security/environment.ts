import { isRealTurnstileSiteKey, isRealTurnstileSecretKey } from '../../shared/turnstile-config.mjs';

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
  return Boolean(canonicalOrigin() &&
    isRealTurnstileSiteKey(process.env.PUBLIC_TURNSTILE_SITE_KEY) &&
    isRealTurnstileSecretKey(process.env.TURNSTILE_SECRET_KEY));
}

export function productionConfigurationReady(): boolean {
  return Boolean(canonicalOrigin() && process.env.PUBLIC_TEST_ENVIRONMENT === 'false' &&
    (process.env.RATE_LIMIT_SECRET || '').trim().length >= 32 && captchaConfigurationReady());
}
