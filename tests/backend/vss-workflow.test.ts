import { afterAll, beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import app from '../../backend/app';
import { createDatabase } from '../../backend/lib/database';
import { createTestDatabase } from '../helpers/database';
import { postgresTransport } from '../helpers/postgres';
import { DEFAULT_SITE_CONTENT } from '../../shared/site-content/defaults';
import { publicSiteContentSchema } from '../../shared/site-content/validation';
vi.mock('../../backend/lib/database', () => ({ createDatabase: vi.fn() }));
const base = 'https://vss.example';
const headers = {
  Origin: base,
  'Content-Type': 'application/json',
  'X-Requested-With': 'VSSDashboard',
  Authorization: 'Bearer synthetic-owner-token',
};
const request = (path: string, method = 'GET', body?: unknown) =>
  app(
    new Request(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    { ip: '192.0.2.89' },
  );
const inquiry = (extra = {}) => ({
  idempotencyKey: crypto.randomUUID(),
  name: 'VSS Package Contact',
  email: 'package@example.test',
  company: 'Example Company',
  phone: '',
  service: 'Virtual Assistant',
  message: 'Please discuss a package for my recurring calendar work.',
  requestedPlan: 'starter',
  privacyAcknowledged: true,
  website: '',
  ...extra,
});

describe('VSS package and catalog workflows', () => {
  let db: PGlite;
  let savedId: string;
  let firstPayload: ReturnType<typeof inquiry>;
  beforeAll(async () => {
    db = await createTestDatabase();
    await db.exec("insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','owner@example.test')");
    await db.query(
      "insert into public.staff_users(email,role,active,created_at) values('owner@example.test','owner',true,0)",
    );
  }, 30_000);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', base);
    vi.stubEnv('RATE_LIMIT_SECRET', 'synthetic-test-secret-32-characters-or-more');
    vi.stubEnv('TEST_EMAIL_MODE', 'capture');
    vi.mocked(createDatabase).mockReturnValue(postgresTransport(db) as any);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await db?.close();
  });
  it('stores a server-generated package snapshot and ignores a forged browser price', async () => {
    const payload = (firstPayload = inquiry({ price: '₱1', requestedPlanName: 'Fake name' }));
    const response = await request('/api/inquiries', 'POST', payload);
    expect(response.status).toBe(202);
    savedId = (await response.json()).inquiryId;
    const row = (
      await db.query<{ requested_plan: Record<string, unknown> }>(
        'select requested_plan from public.inquiries where id=$1::uuid',
        [savedId],
      )
    ).rows[0]!;
    expect(row.requested_plan).toMatchObject({
      id: 'starter',
      name: 'Starter',
      price: '₱8,000',
      contentRevision: 0,
    });
    expect((await request('/api/inquiries', 'POST', payload)).status).toBe(200);
    const owner = await request('/api/admin/inquiries/' + savedId);
    expect((await owner.json()).inquiry.requestedPlan.price).toBe('₱8,000');
  });
  it('rejects missing package IDs without saving a partial inquiry or notification', async () => {
    const before = (await db.query('select count(*)::int as n from public.inquiries')).rows[0];
    expect(
      (await request('/api/inquiries', 'POST', inquiry({ requestedPlan: 'not-published' }))).status,
    ).toBe(422);
    expect((await db.query('select count(*)::int as n from public.inquiries')).rows[0]).toEqual(
      before,
    );
  });
  it('publishes extended owner content, filters drafts, protects revisions and preserves the inquiry quote', async () => {
    const content = structuredClone(DEFAULT_SITE_CONTENT);
    content.plans[0]!.price = '₱9,000';
    content.plans.push({
      ...content.plans[0]!,
      id: 'private-draft',
      name: 'Private draft package',
      featured: false,
      published: false,
    });
    content.portfolio.push({
      ...content.portfolio[0]!,
      id: 'draft-case',
      title: 'Unpublished client permission review',
      kind: 'case-study',
      approved: false,
      published: false,
    });
    content.team.push({
      ...content.team[0]!,
      id: 'draft-member',
      name: 'Private draft person',
      published: false,
    });
    const response = await request('/api/admin/site-content', 'PUT', { revision: 0, content });
    expect(response.status).toBe(200);
    expect((await request('/api/admin/site-content', 'PUT', { revision: 0, content })).status).toBe(
      409,
    );
    const publicResponse = await request('/api/public/content');
    const publicText = await publicResponse.text();
    expect(publicText).toContain('₱9,000');
    expect(publicText).not.toContain('Private draft');
    expect(publicText).not.toContain('Unpublished client');
    expect(
      (
        await db.query<{ requested_plan: { price: string } }>(
          'select requested_plan from public.inquiries where id=$1::uuid',
          [savedId],
        )
      ).rows[0]!.requested_plan.price,
    ).toBe('₱8,000');
    expect(
      (await request('/api/inquiries', 'POST', inquiry({ requestedPlan: 'private-draft' }))).status,
    ).toBe(422);
  });
  it('recovers a saved receipt even after its service and package are withdrawn', async () => {
    const current = await (await request('/api/admin/site-content')).json();
    current.content.plans[0].published = false;
    current.content.services[0].published = false;
    expect((await request('/api/admin/site-content', 'PUT', current)).status).toBe(200);
    const response = await request('/api/inquiries', 'POST', firstPayload);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ inquiryId: savedId, repeated: true });
    expect(
      (await db.query<{ n: number }>('select count(*)::int as n from public.inquiries')).rows[0]!.n,
    ).toBe(1);
  });
  it('will not publish unapproved client results or executable/external image paths', () => {
    const content = structuredClone(DEFAULT_SITE_CONTENT);
    content.portfolio[0]!.kind = 'case-study';
    content.portfolio[0]!.approved = false;
    expect(publicSiteContentSchema.safeParse(content).success).toBe(false);
    content.portfolio[0]!.approved = true;
    expect(publicSiteContentSchema.safeParse(content).success).toBe(true);
    for (const path of [
      'javascript:alert(1)',
      '//tracker.example/image.jpg',
      '/images/../../secrets.jpg',
      'https://external.example/photo.jpg',
    ]) {
      content.team[0]!.image = path;
      expect(publicSiteContentSchema.safeParse(content).success).toBe(false);
    }
  });
  it('clears package context when the inquiry is anonymized', async () => {
    await db.query('update public.inquiries set anonymized_at=$1 where id=$2::uuid', [
      Date.now(),
      savedId,
    ]);
    expect(
      (
        await db.query<{ requested_plan: unknown }>(
          'select requested_plan from public.inquiries where id=$1::uuid',
          [savedId],
        )
      ).rows[0]!.requested_plan,
    ).toBeNull();
  });
  it('keeps package data server-only and the new function invoker-scoped', async () => {
    const result = await db.query<{ anon: boolean; service: boolean; definer: boolean }>(`select
      has_function_privilege('anon','public.submit_inquiry(jsonb,bigint)','execute') as anon,
      has_function_privilege('service_role','public.submit_inquiry(jsonb,bigint)','execute') as service,
      (select prosecdef from pg_proc where oid='public.submit_inquiry(jsonb,bigint)'::regprocedure) as definer`);
    expect(result.rows[0]).toEqual({ anon: false, service: true, definer: false });
    await db.exec('set role anon');
    await expect(db.query('select requested_plan from public.inquiries')).rejects.toThrow();
    await db.exec('reset role');
  });
});
