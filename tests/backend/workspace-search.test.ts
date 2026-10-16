import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createApplication } from '../../backend/app';
import { localPostgres } from '../../devops/local/postgres';
import { createTestDatabase } from '../helpers/database';
import { searchFilter } from '../../backend/lib/search';

// Real PostgreSQL, feature routes, and authorization. Search + cursor are ANDed.
describe('workspace search across stored records', () => {
  let db: PGlite;
  let app: ReturnType<typeof createApplication>;
  const call = (path: string, role = 'owner') =>
    app(
      new Request('https://vss.example' + path, {
        headers: role ? { Authorization: 'Bearer ' + role } : {},
      }),
    );
  beforeAll(async () => {
    db = await createTestDatabase();
    await db.exec(
      "insert into staff_users(email,role,active,created_at) values('owner@example.test','owner',true,0),('staff@example.test','staff',true,0)",
    );
    const adapter = localPostgres(db, async (token) => ({
      data: {
        user: ['owner', 'staff'].includes(token) ? { email: token + '@example.test' } : null,
      },
      error: null,
    }));
    app = createApplication(() => adapter as any);
    for (let i = 0; i < 57; i++)
      await db.query(
        "insert into inquiries(id,name,email,normalized_email,company,service,message,privacy_notice_version,created_at,updated_at,status) values($1,$2,$3,$3,$4,'Virtual Assistant','Synthetic test inquiry','test-v1',$5,$5,$6)",
        [
          crypto.randomUUID(),
          i === 56 ? "Mañana & O'Brien (10%_literal)" : 'Search Contact ' + i,
          'contact-' + i + '@example.test',
          i === 55 ? 'Only-in-older-page' : 'Search Business',
          1000 - i,
          i % 2 ? 'waiting' : 'new',
        ],
      );
    const row = (
      await db.query<{ id: string }>('select id from inquiries order by created_at desc limit 1')
    ).rows[0];
    await db.query(
      "insert into clients(source_inquiry_id,contact_name,email,company,status,created_at) values($1,'A Client','client@example.test',$2,'paused',1234)",
      [row!.id, "Mañana & O'Brien"],
    );
    await db.query(
      "insert into privacy_requests(id,name,email,request_type,message,created_at) values($1,'A Requester','privacy@example.test','export','Synthetic export request',1234)",
      [crypto.randomUUID()],
    );
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });
  it('finds a record on an older page rather than filtering only loaded browser rows', async () => {
    const response = await call('/api/admin/inquiries?q=Only-in-older-page');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.inquiries).toHaveLength(1);
    expect(body.inquiries[0].company).toBe('Only-in-older-page');
  });
  it('combines status, search, and cursor pagination without duplicate or missing records', async () => {
    const first = await (await call('/api/admin/inquiries?q=Search')).json();
    expect(first.inquiries).toHaveLength(50);
    expect(first.nextCursor).toBeTruthy();
    const second = await (
      await call('/api/admin/inquiries?q=Search&cursor=' + encodeURIComponent(first.nextCursor))
    ).json();
    const ids = [...first.inquiries, ...second.inquiries].map((row: any) => row.id);
    expect(ids).toHaveLength(57);
    expect(new Set(ids).size).toBe(57);
    const waiting = await (await call('/api/admin/inquiries?q=Search&status=waiting')).json();
    expect(waiting.inquiries.length).toBeGreaterThan(0);
    expect(waiting.inquiries.every((row: any) => row.status === 'waiting')).toBe(true);
  });
  it('treats LIKE wildcards, apostrophes, parentheses, and Unicode as search text', async () => {
    for (const q of ['10%_literal', "O'Brien", 'Mañana', '(10%']) {
      const body = await (await call('/api/admin/inquiries?q=' + encodeURIComponent(q))).json();
      expect(body.inquiries, q).toHaveLength(1);
    }
    const star = await (
      await call('/api/admin/inquiries?q=' + encodeURIComponent('Search*Contact'))
    ).json();
    expect(star.inquiries).toEqual([]);
    const body = await (
      await call('/api/admin/inquiries?q=' + encodeURIComponent('"),status.eq.new,name.ilike."%'))
    ).json();
    expect(body.inquiries).toEqual([]);
    expect((await db.query('select count(*)::int as n from inquiries')).rows[0]).toEqual({ n: 57 });
  });
  it('supports client search and relationship status filters', async () => {
    const body = await (
      await call('/api/admin/clients?q=' + encodeURIComponent("O'Brien") + '&status=paused')
    ).json();
    expect(body.clients).toHaveLength(1);
    expect((await (await call('/api/admin/clients?status=active')).json()).clients).toEqual([]);
    expect((await call('/api/admin/clients?status=invalid')).status).toBe(422);
  });
  it('keeps privacy searches owner-only and all searches private', async () => {
    expect((await call('/api/admin/inquiries?q=Search', '')).status).toBe(401);
    expect((await call('/api/admin/privacy-requests?q=privacy', 'staff')).status).toBe(403);
    expect(
      (await (await call('/api/admin/privacy-requests?q=privacy')).json()).requests,
    ).toHaveLength(1);
  });
  it('rejects oversized or control-character searches before querying', async () => {
    expect((await call('/api/admin/inquiries?q=' + 'x'.repeat(101))).status).toBe(422);
    expect((await call('/api/admin/clients?q=x%00y')).status).toBe(422);
    expect((await call('/api/admin/privacy-requests?q=x%0Ay')).status).toBe(422);
    expect(() => searchFilter('test', ['name);delete'])).toThrow('invalid_search_column');
  });
});
