export const MAX_ATTEMPTS = 8;
export const LEAD_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
export const DUPLICATE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
export function retryDelayMs(attempt: number, randomValue = Math.random()): number {
  const safeAttempt = Math.max(1, Math.min(attempt, MAX_ATTEMPTS));
  const base = Math.min(60_000 * 2 ** (safeAttempt - 1), 24 * 60 * 60 * 1000);
  const jitter = 0.75 + Math.max(0, Math.min(randomValue, 1)) * 0.5;
  return Math.floor(base * jitter);
}
export function safeErrorCode(status: number): string {
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500) return 'provider_server_error';
  if (status >= 400) return 'provider_rejected_request';
  return 'provider_network_error';
}
