import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../../backend/app';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('public API entry', () => {
  it('serves a liveness check without credentials or a database', async () => {
    const response = await api(new Request('https://site.example/api/health/live'), {
      ip: '127.0.0.1',
    } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
  it('does not let anonymous visitors read the staff inbox', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    const response = await api(new Request('https://site.example/api/admin/inquiries'), {
      ip: '127.0.0.1',
    } as any);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'staff_access_required' });
  });
});
