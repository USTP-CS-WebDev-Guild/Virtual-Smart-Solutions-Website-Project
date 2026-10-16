import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_WINDOW_MS,
  LEAD_RETENTION_MS,
  MAX_ATTEMPTS,
  normalizeEmail,
  retryDelayMs,
  safeErrorCode,
} from '../../backend/domain/rules';

describe('business rules', () => {
  it('normalizes emails for duplicate matching', () => {
    expect(normalizeEmail('  Jamie@Example.COM ')).toBe('jamie@example.com');
  });
  it('keeps duplicate and retention windows explicit', () => {
    expect(DUPLICATE_WINDOW_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(LEAD_RETENTION_MS).toBe(365 * 24 * 60 * 60 * 1000);
  });
  it('bounds notification retries and adds deterministic jitter', () => {
    expect(retryDelayMs(1, 0)).toBe(45_000);
    expect(retryDelayMs(1, 1)).toBe(75_000);
    expect(retryDelayMs(MAX_ATTEMPTS + 10, 0.5)).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
  it('keeps provider errors safe for operational logs', () => {
    expect(safeErrorCode(429)).toBe('provider_rate_limited');
    expect(safeErrorCode(503)).toBe('provider_server_error');
  });
});
