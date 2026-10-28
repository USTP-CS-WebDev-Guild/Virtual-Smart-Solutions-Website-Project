import type { Database } from '../lib/database';
import { productionMode } from './environment';
import { isIP } from 'node:net';

export async function allowSubmission(
  contextIp: string,
  db: Database,
  action: string,
): Promise<boolean> {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (productionMode() && !isIP(contextIp)) throw new Error('trusted_ip_unavailable');
  // A broken server setting is an outage, not evidence that the visitor is a bot.
  if (!secret || secret.trim().length < (productionMode() ? 32 : 24)) {
    if (process.env.CONTEXT === 'dev' && !secret) return true;
    throw new Error('rate_limit_not_configured');
  }
  const { createHmac } = await import('node:crypto');
  const bucketKey = createHmac('sha256', secret)
    .update(`${action}:${contextIp || 'unknown'}`)
    .digest('hex');
  const windowMs = 10 * 60 * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  // A class can share one campus IP. The isolated capture-only test site has
  // room for the class; the production website keeps the stricter limit.
  const limit =
    !productionMode() && process.env.PUBLIC_TEST_ENVIRONMENT === 'true' && process.env.TEST_EMAIL_MODE === 'capture'
      ? 60
      : 5;
  const { data, error } = await db.rpc('consume_rate_limit', {
    p_bucket_key: bucketKey,
    p_window_start: windowStart,
    p_now: now,
    p_limit: limit,
  });
  if (error || typeof data !== 'boolean') throw new Error('rate_limit_unavailable');
  return data;
}

// Limit both a targeted address and total daily writes. HMACs keep addresses
// out of abuse-control records. These budgets supplement hosting-level limits.
export async function allowSubmissionBudget(
  db: Database, action: string, email: string,
): Promise<boolean> {
  if (!productionMode()) return true;
  const { createHmac } = await import('node:crypto');
  const secret = process.env.RATE_LIMIT_SECRET || '';
  if (secret.length < 32) throw new Error('rate_limit_not_configured');
  const now = Date.now();
  for (const [identity, windowMs, limit] of [
    [`${action}:email:${email.trim().toLowerCase()}`, 3600000, 3],
    ['public-form:daily', 86400000, 200],
  ] as const) {
    const key = createHmac('sha256', secret).update(identity).digest('hex');
    const result = await db.rpc('consume_rate_limit', { p_bucket_key: key,
      p_window_start: Math.floor(now / windowMs) * windowMs, p_now: now, p_limit: limit });
    if (result.error || typeof result.data !== 'boolean') throw new Error('rate_limit_unavailable');
    if (!result.data) return false;
  }
  return true;
}
