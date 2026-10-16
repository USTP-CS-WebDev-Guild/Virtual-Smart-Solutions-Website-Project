import { describe, expect, it, vi } from 'vitest';
import { requireActor, isResponse } from '../../backend/lib/auth';

function fakeDatabase(role: string, active = true) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { email: 'owner@example.test' } },
        error: null,
      })),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { email: 'owner@example.test', role, active },
            error: null,
          }),
        }),
      }),
    }),
  } as any;
}

describe('server authorization', () => {
  it('requires a Supabase bearer token before staff operations', async () => {
    const response = await requireActor(
      new Request('https://site.example/api/admin/inquiries'),
      fakeDatabase('owner'),
    );
    expect(isResponse(response)).toBe(true);
    if (response instanceof Response) expect(response.status).toBe(401);
  });
  it('allows active staff and blocks staff from owner-only operations', async () => {
    const request = new Request('https://site.example/api/admin/inquiries', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const staff = await requireActor(request, fakeDatabase('staff'));
    expect(staff).toEqual({ email: 'owner@example.test', role: 'staff' });
    const ownerOnly = await requireActor(request, fakeDatabase('staff'), true);
    expect(ownerOnly instanceof Response).toBe(true);
    if (ownerOnly instanceof Response) expect(ownerOnly.status).toBe(403);
  });
  it('blocks inactive accounts', async () => {
    const request = new Request('https://site.example/api/admin/inquiries', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const response = await requireActor(request, fakeDatabase('owner', false));
    expect(response instanceof Response).toBe(true);
    if (response instanceof Response) expect(response.status).toBe(401);
  });
});
