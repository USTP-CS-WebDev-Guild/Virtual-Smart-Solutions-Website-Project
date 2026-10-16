// TEST ONLY: real application/API/SQL with synthetic Supabase transport.
// This module is never imported by backend/functions or the public website.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { build } from 'astro';
import app from '../../backend/app';
import { createTestDatabase } from '../helpers/database';
import { postgresTransport } from '../helpers/postgres';

export const users = [
  { id: '20000000-0000-4000-8000-000000000001', email: 'owner@example.test', role: 'owner' },
  { id: '20000000-0000-4000-8000-000000000002', email: 'staff@example.test', role: 'staff' },
];
const serverKey = 'sb_secret_SYNTHETIC_E2E_SERVER_NOT_A_REAL_KEY';
const browserKey = 'sb_publishable_SYNTHETIC_E2E_BROWSER_KEY';
export function identity(token: string) {
  try {
    const claim = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString());
    return users.find((user) => user.id === claim.sub);
  } catch {
    return undefined;
  }
}
function userResponse(user: (typeof users)[number]) {
  return {
    id: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
  };
}
function session(user: (typeof users)[number]) {
  const jwt = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        aud: 'authenticated',
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url'),
    'synthetic-signature',
  ].join('.');
  return {
    access_token: jwt,
    refresh_token: 'synthetic-refresh-' + user.id,
    expires_in: 3600,
    token_type: 'bearer',
    user: userResponse(user),
  };
}
export async function startTestServer() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const output = resolve(root, '.e2e-dist');
  const db = await createTestDatabase();
  for (const user of users) {
    await db.query('insert into auth.users(id,email) values($1::uuid,$2)', [user.id, user.email]);
    await db.query(
      'insert into public.staff_users(email,role,active,created_at) values($1,$2,true,0)',
      [user.email, user.role],
    );
  }
  const listeners = new Set<(rows: any[]) => Promise<void>>();
  let known: Record<string, number> = {};
  const changed = async () => {
    const result = await db.query<{ scope: string; revision: number; changed_at: number }>(
      'select * from public.change_signals',
    );
    const rows = result.rows.filter((row) => Number(row.revision) !== known[row.scope]);
    result.rows.forEach((row) => {
      known[row.scope] = Number(row.revision);
    });
    if (rows.length) await Promise.all([...listeners].map((listener) => listener(rows)));
  };
  const readSignals = (token: string) =>
    db.transaction(async (tx) => {
      const user = identity(token);
      await tx.exec('set local role ' + (user ? 'authenticated' : 'anon'));
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user?.id || '']);
      return (
        await tx.query<{ scope: string; revision: number }>(
          'select scope,revision from public.change_signals',
        )
      ).rows;
    });
  let base = '';
  const headersFile = await readFile(resolve(root, 'frontend/public/_headers'), 'utf8');
  const csp = headersFile.match(/Content-Security-Policy: (.+)/)![1]!;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url || '/', base);
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      const method = incoming.method || 'GET';
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers))
        if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
      let response: Response;
      if (url.pathname.startsWith('/supabase/auth/v1/')) {
        const token = headers.get('authorization')?.replace(/^Bearer /i, '') || '';
        if (url.pathname.endsWith('/token')) {
          const body = JSON.parse(bytes.toString());
          const user = users.find(
            (item) =>
              item.email === body.email || body.refresh_token === 'synthetic-refresh-' + item.id,
          );
          response =
            user && (body.password === 'Synthetic-password-1234' || body.refresh_token)
              ? Response.json(session(user))
              : Response.json(
                  { code: 'invalid_credentials', msg: 'Invalid login credentials' },
                  { status: 400 },
                );
        } else if (url.pathname.endsWith('/logout')) response = new Response(null, { status: 204 });
        else {
          const user = identity(token);
          response = user
            ? Response.json(userResponse(user))
            : Response.json({ error: 'invalid_token' }, { status: 401 });
        }
      } else if (url.pathname.startsWith('/supabase/rest/v1/')) {
        const key = headers.get('apikey') || '';
        const token = headers.get('authorization')?.replace(/^Bearer /i, '') || '';
        const isServer = key === serverKey;
        const user = identity(token);
        const result = await db.transaction(async (tx) => {
          await tx.exec(
            'set local role ' + (isServer ? 'service_role' : user ? 'authenticated' : 'anon'),
          );
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user?.id || '']);
          const transport = postgresTransport(tx as any);
          const path = url.pathname.replace('/supabase/rest/v1/', '');
          if (path.startsWith('rpc/')) {
            if (!isServer) throw new Error('permission denied');
            return transport.rpc(path.slice(4), bytes.length ? JSON.parse(bytes.toString()) : {});
          }
          let query = transport.from(path);
          if (method === 'PATCH') query = query.update(JSON.parse(bytes.toString()));
          query = query.select(url.searchParams.get('select') || '*');
          for (const [name, value] of url.searchParams) {
            if (['select', 'order', 'limit'].includes(name)) continue;
            if (name === 'or') query = query.or(value.replace(/^\(|\)$/g, ''));
            else if (value.startsWith('eq.')) query = query.eq(name, value.slice(3));
            else if (value.startsWith('in.('))
              query = query.in(name, value.slice(4, -1).split(','));
          }
          for (const order of (url.searchParams.get('order') || '').split(',').filter(Boolean)) {
            const [key, direction] = order.split('.');
            query = query.order(key!, { ascending: direction !== 'desc' });
          }
          if (url.searchParams.has('limit'))
            query = query.limit(Number(url.searchParams.get('limit')));
          if (headers.get('accept')?.includes('vnd.pgrst.object')) query = query.maybeSingle();
          return await query;
        });
        response = Response.json(result.data);
        if (method !== 'GET') await changed();
      } else if (url.pathname.startsWith('/api/')) {
        response = await app(
          new Request(url, {
            method,
            headers,
            body: ['GET', 'HEAD'].includes(method) ? undefined : bytes,
          }),
          { ip: '192.0.2.90' },
        );
      } else {
        const path = resolve(
          output,
          '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname),
        );
        if (!path.startsWith(output + '/')) throw new Error('invalid path');
        const mime: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.jpg': 'image/jpeg',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml',
          '.xml': 'application/xml',
        };
        response = new Response(await readFile(path), {
          headers: {
            'Content-Type': mime[extname(path)] || 'application/octet-stream',
            'Content-Security-Policy': csp,
          },
        });
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(400, { 'Content-Type': 'application/json' });
      outgoing.end(
        JSON.stringify({
          code: 'TEST_TRANSPORT_ERROR',
          message: error instanceof Error ? error.message : 'test transport failed',
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test address missing');
  base = 'http://127.0.0.1:' + address.port;
  Object.assign(process.env, {
    SUPABASE_URL: base + '/supabase',
    PUBLIC_SUPABASE_URL: base + '/supabase',
    PUBLIC_SUPABASE_ANON_KEY: browserKey,
    SUPABASE_SERVICE_ROLE_KEY: serverKey,
    APP_ORIGIN: base,
    RATE_LIMIT_SECRET: 'synthetic-e2e-rate-limit-secret-32-characters',
    TEST_EMAIL_MODE: 'capture',
    PUBLIC_TEST_ENVIRONMENT: 'true',
    CONTEXT: 'production',
  });
  await changed();
  await build({ root, outDir: output, logLevel: 'error' });
  return {
    base,
    db,
    readSignals,
    subscribe: (callback: (rows: any[]) => Promise<void>) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    },
  };
}
