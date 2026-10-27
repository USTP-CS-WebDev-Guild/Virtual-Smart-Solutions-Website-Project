import { isIP } from 'node:net';
import { json } from '../http/responses';
import { productionMode, captchaConfigurationReady } from './environment';

export async function verifyCaptcha(token: string | undefined, ip: string): Promise<Response | null> {
  const sitekey = process.env.PUBLIC_HCAPTCHA_SITE_KEY || '';
  if (!productionMode() && !sitekey) return null;
  const secret = process.env.HCAPTCHA_SECRET_KEY || '';
  if (!sitekey || !secret || (productionMode() && !captchaConfigurationReady()))
    return json({ error: 'security_configuration_required' }, 503);
  if (!token || token.length > 4096) return json({ error: 'verification_required' }, 403);
  try {
    const body = new URLSearchParams({ secret, sitekey, response: token });
    if (isIP(ip)) body.set('remoteip', ip);
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    if (!response.ok) return json({ error: 'verification_unavailable' }, 503);
    const data = await response.json() as { success?: boolean };
    return data.success === true ? null : json({ error: 'verification_required' }, 403);
  } catch { return json({ error: 'verification_unavailable' }, 503); }
}
