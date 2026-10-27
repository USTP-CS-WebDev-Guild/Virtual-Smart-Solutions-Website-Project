import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '../helpers/database';
import { allowSubmission, allowSubmissionBudget } from '../../backend/security/rate-limit';

describe('production abuse budgets against real PostgreSQL counters', () => {
  let sql: PGlite;
  let db: any;
  beforeAll(async () => {
    sql = await createTestDatabase();
    db = { rpc: async (_name: string, p: any) => {
      const result = await sql.query<{ accepted: boolean }>(
        'select public.consume_rate_limit($1,$2::bigint,$3::bigint,$4::integer) as accepted',
        [p.p_bucket_key,p.p_window_start,p.p_now,p.p_limit],
      );
      return { data: result.rows[0]!.accepted, error: null };
    } };
  }, 30000);
  afterAll(async () => { await sql?.close(); });
  beforeEach(async () => {
    vi.stubEnv('APP_ENV','production');
    vi.stubEnv('RATE_LIMIT_SECRET','SYNTHETIC_LOCAL_TEST_SECRET_32_CHARACTERS');
    vi.spyOn(Date,'now').mockReturnValue(Date.UTC(2026,9,27,12,0));
    await sql.exec('delete from public.rate_limit_buckets');
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('limits the same normalized address to three attempts and renews after its window', async () => {
    for(let i=0;i<3;i++) expect(await allowSubmissionBudget(db,'inquiry','ALEX@example.test')).toBe(true);
    expect(await allowSubmissionBudget(db,'inquiry',' alex@EXAMPLE.test ')).toBe(false);
    expect(await allowSubmissionBudget(db,'privacy','alex@example.test')).toBe(true);
    vi.spyOn(Date,'now').mockReturnValue(Date.UTC(2026,9,27,13,0));
    expect(await allowSubmissionBudget(db,'inquiry','alex@example.test')).toBe(true);
    const buckets = (await sql.query<{ bucket_key: string }>('select bucket_key from public.rate_limit_buckets')).rows;
    expect(buckets.every(row=>/^[0-9a-f]{64}$/.test(row.bucket_key))).toBe(true);
  });

  it('shares the daily ceiling across form types and concurrent requests', async () => {
    const accepted = await Promise.all(Array.from({length:200},(_,i)=>allowSubmissionBudget(db,i%2?'inquiry':'privacy',`synthetic-${i}@example.test`)));
    expect(accepted.every(Boolean)).toBe(true);
    expect(await allowSubmissionBudget(db,'privacy','extra@example.test')).toBe(false);
    expect(await allowSubmissionBudget(db,'inquiry','another@example.test')).toBe(false);
  });

  it('never expands production IP limits because test/capture flags are accidentally present', async () => {
    vi.stubEnv('PUBLIC_TEST_ENVIRONMENT','true'); vi.stubEnv('TEST_EMAIL_MODE','capture');
    for(let i=0;i<5;i++) expect(await allowSubmission('192.0.2.1',db,'inquiry')).toBe(true);
    expect(await allowSubmission('192.0.2.1',db,'inquiry')).toBe(false);
    await expect(allowSubmission('untrusted',db,'inquiry')).rejects.toThrow('trusted_ip_unavailable');
  });
});
