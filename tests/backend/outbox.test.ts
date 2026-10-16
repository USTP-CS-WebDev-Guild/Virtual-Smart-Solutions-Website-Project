import { afterEach, describe, expect, it, vi } from 'vitest';
import { drainOutbox } from '../../backend/services/notifications';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('notification outbox', () => {
  it('captures test messages without calling an email provider', async () => {
    vi.stubEnv('TEST_EMAIL_MODE', 'capture');
    const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
    const db = {
      rpc: vi.fn(async () => ({
        data: [{ id: 'queue-1', inquiry_id: 'inquiry-1', attempts: 1 }],
        error: null,
      })),
      from: vi.fn(() => ({
        update: (values: Record<string, unknown>) => ({
          eq: async (_key: string, id: string) => {
            updates.push({ id, values });
            return { error: null };
          },
        }),
      })),
    } as any;
    const result = await drainOutbox(db);
    expect(result).toEqual({ processed: 1, captured: 1 });
    expect(db.rpc).toHaveBeenCalledWith(
      'claim_outbox_batch',
      expect.objectContaining({ p_limit: 5 }),
    );
    expect(updates[0]?.values).toMatchObject({ status: 'sent', delivery_status: 'test_captured' });
  });
});
