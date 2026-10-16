import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetSubmissionKey,
  submissionKey,
  submitPublicForm,
} from '../../frontend/scripts/submission';

const id = '3b031e8f-9a2c-4764-a601-f1db9e1c01c0';
const payload = { name: 'Website Test', idempotencyKey: id };
afterEach(() => {
  vi.unstubAllGlobals();
});
const respond = (body: unknown, status = 202, headers: Record<string, string> = {}) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers })),
  );
};

describe('public form receipts', () => {
  it('only confirms the ID returned by the backend after a successful save', async () => {
    respond({ ok: true, inquiryId: id, repeated: false });
    expect(await submitPublicForm('/api/inquiries', payload, 'inquiryId')).toEqual({
      id,
      repeated: false,
    });
    respond({ ok: true, inquiryId: id, repeated: true }, 200);
    expect(await submitPublicForm('/api/inquiries', payload, 'inquiryId')).toEqual({
      id,
      repeated: true,
    });
  });
  it('does not announce a saved inquiry for the honeypot reply or an empty/malformed 2xx response', async () => {
    for (const body of [{ ok: true }, {}, null, { ok: true, inquiryId: 'not-an-id' }]) {
      respond(body);
      await expect(submitPublicForm('/api/inquiries', payload, 'inquiryId')).rejects.toThrow(
        'Receipt could not be confirmed',
      );
    }
  });
  it('distinguishes hosting access from application failure, without displaying raw HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Netlify login redirect</html>', { status: 401 })),
    );
    await expect(submitPublicForm('/api/inquiries', payload, 'inquiryId')).rejects.toThrow(
      'visitor access',
    );
  });
  it('includes a safe support reference and retains the retry key after an outage', async () => {
    respond({ error: 'service_unavailable' }, 503, { 'X-Request-ID': 'support-test-123' });
    const key = submissionKey('outage-test');
    await expect(submitPublicForm('/api/inquiries', payload, 'inquiryId')).rejects.toThrow(
      'Reference: support-test-123',
    );
    expect(submissionKey('outage-test')).toBe(key);
    forgetSubmissionKey('outage-test');
    expect(submissionKey('outage-test')).not.toBe(key);
    forgetSubmissionKey('outage-test');
  });
  it('uses the actual rate-limit wait instead of promising a one-minute retry', async () => {
    respond({ error: 'too_many_requests' }, 429, { 'Retry-After': '480' });
    await expect(submitPublicForm('/api/inquiries', payload, 'inquiryId')).rejects.toThrow(
      '8 minute',
    );
  });
  it('still supports idempotent retries when browser storage is blocked', () => {
    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    });
    const key = submissionKey('blocked-storage');
    expect(submissionKey('blocked-storage')).toBe(key);
    forgetSubmissionKey('blocked-storage');
    expect(submissionKey('blocked-storage')).not.toBe(key);
    forgetSubmissionKey('blocked-storage');
  });
  it('requires a privacy receipt too', async () => {
    respond({ ok: true });
    await expect(
      submitPublicForm('/api/privacy-requests', payload, 'privacyRequestId'),
    ).rejects.toThrow('Receipt could not be confirmed');
    respond({ ok: true, privacyRequestId: id });
    expect((await submitPublicForm('/api/privacy-requests', payload, 'privacyRequestId')).id).toBe(
      id,
    );
  });
});
