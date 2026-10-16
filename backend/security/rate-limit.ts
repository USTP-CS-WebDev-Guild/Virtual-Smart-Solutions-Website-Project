import type { Database } from '../lib/database';

export async function allowSubmission(
  contextIp: string,
  db: Database,
  action: string,
): Promise<boolean> {
  const secret = process.env.RATE_LIMIT_SECRET;
  // A broken server setting is an outage, not evidence that the visitor is a bot.
  if (!secret || secret.trim().length < 24) {
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
    process.env.PUBLIC_TEST_ENVIRONMENT === 'true' && process.env.TEST_EMAIL_MODE === 'capture'
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
