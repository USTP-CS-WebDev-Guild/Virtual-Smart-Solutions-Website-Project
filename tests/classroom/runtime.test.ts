import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startClassroomServer } from '../../devops/local/server';

// Full local runtime, real passwords, actual HTTP and PostgreSQL transactions.
// No hosted account or network provider is replaced inside the feature routes.
describe('complete classroom system', () => {
  let root: string;
  let server: Awaited<ReturnType<typeof startClassroomServer>>;
  let base: string;
  let owner: string;
  let staff: string;
  let inquiryId: string;
  let guide: string;
  const origin = 'http://127.0.0.1:4321';
  const environment = { ...process.env };

  const call = (path: string, method = 'GET', body?: unknown, token = '') =>
    fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Requested-With': 'VSSDashboard',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async (email: string) => {
    const password = guide.match(
      new RegExp('Email: ' + email.replace('.', '\\.') + '\\nPassword: (\\S+)'),
    )![1]!;
    const response = await call('/api/classroom/login', 'POST', { email, password });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
    return (await response.json()).session.access_token as string;
  };

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'student-classroom-'));
    await cp(
      new URL('../../backend/database/migrations', import.meta.url),
      join(root, 'backend/database/migrations'),
      { recursive: true },
    );
    server = await startClassroomServer(root, 0, origin);
    base = 'http://127.0.0.1:' + server.port;
    guide = await readFile(join(root, '.local/LOCAL-ACCESS.md'), 'utf8');
    owner = await login('owner@classroom.test');
    staff = await login('staff@classroom.test');
  }, 30_000);
  afterAll(async () => {
    await server?.close();
    await rm(root, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
    Object.assign(process.env, environment);
  });

  it('starts with zero business data and enforces owner/staff/anonymous boundaries', async () => {
    expect((await call('/api/admin/inquiries')).status).toBe(401);
    expect((await call('/api/admin/site-content', 'GET', undefined, staff)).status).toBe(403);
    expect((await call('/api/admin/privacy-requests', 'GET', undefined, staff)).status).toBe(403);
    expect(
      (await (await call('/api/admin/inquiries', 'GET', undefined, owner)).json()).inquiries,
    ).toEqual([]);
    expect(
      (await (await call('/api/admin/clients', 'GET', undefined, owner)).json()).clients,
    ).toEqual([]);
    expect(
      (await (await call('/api/admin/privacy-requests', 'GET', undefined, owner)).json()).requests,
    ).toEqual([]);
    expect((await server.readSignals('')).map((row) => row.scope)).toEqual(['public']);
    expect((await server.readSignals(staff)).map((row) => row.scope)).toEqual(['public', 'staff']);
    expect((await server.readSignals(owner)).map((row) => row.scope)).toEqual([
      'owner',
      'public',
      'staff',
    ]);
  });

  it('rejects cross-site requests and invalid login JSON without resetting data', async () => {
    expect(
      (
        await fetch(base + '/api/classroom/login', {
          method: 'POST',
          headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(base + '/api/classroom/login', {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call('/api/classroom/login', 'POST', {
          email: 'owner@classroom.test',
          password: 'wrong',
        })
      ).status,
    ).toBe(400);
  });

  it('saves an inquiry and pushes a private metadata event immediately after commit', async () => {
    const controller = new AbortController();
    const stream = await fetch(base + '/api/classroom/events', {
      headers: { Authorization: 'Bearer ' + owner },
      signal: controller.signal,
    });
    const reader = stream.body!.getReader();
    await reader.read(); // protocol ready; no business data sent
    const key = crypto.randomUUID();
    const payload = {
      idempotencyKey: key,
      name: 'Classroom Contact',
      email: 'contact@example.test',
      company: '',
      phone: '',
      service: 'Not sure yet',
      message: 'A real saved local test inquiry.',
      privacyAcknowledged: true,
      website: '',
    };
    const saved = await call('/api/inquiries', 'POST', payload);
    expect(saved.status).toBe(202);
    inquiryId = (await saved.json()).inquiryId;
    const event = await reader.read();
    const text = new TextDecoder().decode(event.value);
    expect(text).toContain('"scope":"staff"');
    expect(text).not.toContain('Classroom Contact');
    expect(text).not.toContain('contact@example.test');
    controller.abort();
    expect((await call('/api/inquiries', 'POST', payload)).status).toBe(200);
    const rows = await (await call('/api/admin/inquiries', 'GET', undefined, owner)).json();
    expect(rows.inquiries).toHaveLength(1);
    expect(rows.inquiries[0].id).toBe(inquiryId);
  });

  it('runs notes, repeat-safe client conversion, audit and captured outbox through feature routes', async () => {
    expect(
      (
        await call(
          `/api/admin/inquiries/${inquiryId}/notes`,
          'POST',
          { idempotencyKey: crypto.randomUUID(), body: 'Agreed a weekly handoff.' },
          staff,
        )
      ).status,
    ).toBe(201);
    expect(
      (await call(`/api/admin/inquiries/${inquiryId}/convert`, 'POST', {}, owner)).status,
    ).toBe(200);
    expect(
      (await call(`/api/admin/inquiries/${inquiryId}/convert`, 'POST', {}, owner)).status,
    ).toBe(200);
    expect(
      (await (await call('/api/admin/clients', 'GET', undefined, staff)).json()).clients,
    ).toHaveLength(1);
    expect((await call('/api/admin/test/run-jobs', 'POST', {}, owner)).status).toBe(200);
    const notice = (
      await server.db.query<{ delivery_status: string }>(
        'select delivery_status from public.outbox',
      )
    ).rows[0]!;
    expect(notice.delivery_status).toBe('test_captured');
    const events = await (
      await call(`/api/admin/inquiries/${inquiryId}/events`, 'GET', undefined, owner)
    ).json();
    expect(
      events.events.some((row: { actorId: string }) => row.actorId === 'staff@classroom.test'),
    ).toBe(true);
  });

  it('publishes content with conflict protection and handles privacy requests separately', async () => {
    const record = await (await call('/api/admin/site-content', 'GET', undefined, owner)).json();
    record.content.settings.homeHeadline = 'My own student project';
    expect((await call('/api/admin/site-content', 'PUT', record, owner)).status).toBe(200);
    expect((await call('/api/admin/site-content', 'PUT', record, owner)).status).toBe(409);
    expect((await (await call('/api/public/content')).json()).content.settings.homeHeadline).toBe(
      'My own student project',
    );
    expect(
      (
        await call('/api/privacy-requests', 'POST', {
          idempotencyKey: crypto.randomUUID(),
          name: 'Classroom Requester',
          email: 'requester@example.test',
          requestType: 'export',
          message: 'Please export my synthetic records.',
          privacyAcknowledged: true,
          website: '',
        })
      ).status,
    ).toBe(202);
    expect(
      (await (await call('/api/admin/privacy-requests', 'GET', undefined, owner)).json()).requests,
    ).toHaveLength(1);
  });

  it('offboarding removes both API access and private stream permissions', async () => {
    await server.db.query(
      "update public.staff_users set active=false where email='staff@classroom.test'",
    );
    expect((await call('/api/admin/inquiries', 'GET', undefined, staff)).status).toBe(401);
    expect((await server.readSignals(staff)).map((row) => row.scope)).toEqual(['public']);
    expect((await call('/api/classroom/logout', 'POST', {}, owner)).status).toBe(200);
    expect((await call('/api/admin/inquiries', 'GET', undefined, owner)).status).toBe(401);
  });

  it('retains data and accounts on restart while expiring old sessions', async () => {
    await server.close();
    server = await startClassroomServer(root, 0, origin);
    base = 'http://127.0.0.1:' + server.port;
    expect(await readFile(join(root, '.local/LOCAL-ACCESS.md'), 'utf8')).toBe(guide);
    owner = await login('owner@classroom.test');
    expect(
      (await (await call('/api/admin/clients', 'GET', undefined, owner)).json()).clients,
    ).toHaveLength(1);
    expect((await (await call('/api/public/content')).json()).content.settings.homeHeadline).toBe(
      'My own student project',
    );
  }, 30_000);

  it('refuses to open a classroom runtime on a hosting build', async () => {
    process.env.NETLIFY = 'true';
    await expect(startClassroomServer(root, 0, origin)).rejects.toThrow('local only');
    if (environment.NETLIFY === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = environment.NETLIFY;
  });
});
