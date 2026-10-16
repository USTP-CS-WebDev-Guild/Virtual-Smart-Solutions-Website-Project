import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '../helpers/database';

describe('Supabase PostgreSQL migration', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await database?.close();
  });

  it('applies the full schema and keeps inquiry, audit, and notification writes atomic and idempotent', async () => {
    const payload = {
      idempotencyKey: '3b031e8f-9a2c-4764-a601-f1db9e1c01c0',
      name: 'Test Contact',
      email: '  Test@Example.com ',
      company: 'Example Co',
      phone: '',
      service: 'Virtual Assistant',
      message: 'Please contact me.',
      privacyNoticeVersion: '2026-01',
    };
    const first = await database.query<{ result: { inquiryId: string; repeated: boolean } }>(
      'select public.submit_inquiry($1::jsonb, $2::bigint) as result',
      [JSON.stringify(payload), 1_800_000_000_000],
    );
    expect(first.rows[0].result.repeated).toBe(false);
    const inquiryId = first.rows[0].result.inquiryId;

    const retry = await database.query<{ result: { inquiryId: string; repeated: boolean } }>(
      'select public.submit_inquiry($1::jsonb, $2::bigint) as result',
      [JSON.stringify(payload), 1_800_000_000_001],
    );
    expect(retry.rows[0].result).toEqual({ ok: true, inquiryId, repeated: true });

    const counts = await database.query<{ inquiries: number; events: number; outbox: number }>(
      `select
        (select count(*)::int from public.inquiries) as inquiries,
        (select count(*)::int from public.inquiry_events) as events,
        (select count(*)::int from public.outbox) as outbox`,
    );
    expect(counts.rows[0]).toEqual({ inquiries: 1, events: 1, outbox: 1 });

    const secondPayload = { ...payload, idempotencyKey: 'b7fe57d4-9d25-491e-92a4-1fc6e4f37ca2' };
    const second = await database.query<{ result: { inquiryId: string } }>(
      'select public.submit_inquiry($1::jsonb, $2::bigint) as result',
      [JSON.stringify(secondPayload), 1_800_000_000_002],
    );
    const duplicate = await database.query<{
      possible_duplicate: boolean;
      normalized_email: string;
    }>('select possible_duplicate, normalized_email from public.inquiries where id = $1::uuid', [
      second.rows[0].result.inquiryId,
    ]);
    expect(duplicate.rows[0]).toEqual({
      possible_duplicate: true,
      normalized_email: 'test@example.com',
    });

    const converted = await database.query<{ result: { client: { id: string } } }>(
      'select public.convert_inquiry($1::uuid, $2::text, $3::bigint) as result',
      [inquiryId, 'owner@example.test', 1_800_000_000_003],
    );
    const convertedAgain = await database.query<{ result: { client: { id: string } } }>(
      'select public.convert_inquiry($1::uuid, $2::text, $3::bigint) as result',
      [inquiryId, 'owner@example.test', 1_800_000_000_004],
    );
    expect(convertedAgain.rows[0].result.client.id).toBe(converted.rows[0].result.client.id);
    const clientCount = await database.query<{ count: number }>(
      'select count(*)::int as count from public.clients',
    );
    expect(clientCount.rows[0].count).toBe(1);
  });

  it('publishes content revisions with optimistic concurrency and records each revision', async () => {
    const first = await database.query<{ result: { revision: number } }>(
      'select public.publish_site_content($1::int, $2::jsonb, $3::text, $4::bigint) as result',
      [0, JSON.stringify({ hero: { title: 'First draft' } }), 'owner@example.test', 10],
    );
    expect(first.rows[0].result.revision).toBe(1);

    const stale = await database.query<{ result: { error: string } }>(
      'select public.publish_site_content($1::int, $2::jsonb, $3::text, $4::bigint) as result',
      [0, JSON.stringify({ hero: { title: 'Stale draft' } }), 'owner@example.test', 11],
    );
    expect(stale.rows[0].result.error).toBe('content_revision_conflict');

    const history = await database.query<{ count: number }>(
      'select count(*)::int as count from public.site_content_events',
    );
    expect(history.rows[0].count).toBe(1);
  });
});
