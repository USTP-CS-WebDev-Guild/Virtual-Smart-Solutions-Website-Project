import { isIP } from 'node:net';
import { json } from '../http/responses';
import { productionMode, captchaConfigurationReady, canonicalOrigin } from './environment';

export async function verifyCaptcha(
  token: string | undefined,
  ip: string,
  action: 'inquiry' | 'privacy_request',
): Promise<Response | null> {
  const sitekey = process.env.PUBLIC_TURNSTILE_SITE_KEY || '';
  const secret = process.env.TURNSTILE_SECRET_KEY || '';
  // Zero-key classroom/staging mode remains available. Partial configuration
  // fails closed instead of silently dropping verification.
  if (!productionMode() && !sitekey && !secret) return null;
  if (!captchaConfigurationReady())
    return json({ error: 'security_configuration_required' }, 503);
  if (!token || token.length > 2048) return json({ error: 'verification_required' }, 403);
  try {
    // The widget secret binds verification to its site key. Turnstile does not
    // accept hCaptcha's sitekey request parameter.
    const body = new URLSearchParams({ secret, response: token });
    if (isIP(ip)) body.set('remoteip', ip);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    if (!response.ok) return json({ error: 'verification_unavailable' }, 503);
    const data = await response.json() as {
      success?: boolean; hostname?: string; action?: string; 'error-codes'?: string[];
    } | null;
    if (data?.success !== true) {
      const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'] : [];
      const unavailable = codes.some((code) =>
        ['internal-error', 'missing-input-secret', 'invalid-input-secret', 'bad-request'].includes(code));
      return json({ error: unavailable ? 'verification_unavailable' : 'verification_required' }, unavailable ? 503 : 403);
    }
    // Trust the configured origin, not visitor-controlled headers or fields.
    const expectedHostname = new URL(canonicalOrigin()!).hostname;
    return data.hostname === expectedHostname && data.action === action
      ? null : json({ error: 'verification_required' }, 403);
  } catch { return json({ error: 'verification_unavailable' }, 503); }
}
