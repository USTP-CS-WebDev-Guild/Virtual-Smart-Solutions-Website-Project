// Local classroom infrastructure only. Public deployments use Supabase Auth,
// Postgres and Realtime; backend/functions never imports this module.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createApplication } from '../../backend/app';
import type { Database } from '../../backend/lib/database';
import { runMaintenance } from '../../backend/services/notifications';
import { openClassroomDatabase } from './database';
import { localPostgres } from './postgres';
import { localSessions } from './auth';
import { APP_RELEASE } from '../../shared/release';
export async function startClassroomServer(
  root: string,
  port = 8787,
  appOrigin = 'http://127.0.0.1:4321',
) {
  if (process.env.NETLIFY === 'true' || process.env.NODE_ENV === 'production')
    throw new Error(
      'Classroom runtime is local only. Use dev:cloud for Supabase and the Netlify functions for deployment.',
    );
  const allowedHosts = new Set(['127.0.0.1', 'localhost']);
  if (!allowedHosts.has(new URL(appOrigin).hostname))
    throw new Error('Classroom origin must be loopback.');
  const opened = await openClassroomDatabase(root);
  const { db, settings } = opened;
  Object.assign(process.env, {
    APP_ORIGIN: appOrigin,
    APP_ENV: 'development',
    CONTEXT: 'dev',
    TEST_EMAIL_MODE: 'capture',
    PUBLIC_TEST_ENVIRONMENT: 'true',
    RATE_LIMIT_SECRET: settings.rateLimitSecret,
  });
  const sessions = localSessions(settings.accounts);
  const database = localPostgres(db, sessions.getUser) as unknown as Database;
  const app = createApplication(() => database);
  type Signal = {
    scope: string;
    revision: number;
    changed_at: number;
  };
  const streams = new Map<ServerResponse, string>();
  let known: Record<string, number> = {};
  const readSignals = (token: string) =>
    db.transaction(async (tx) => {
      const account = sessions.lookup(token);
      await tx.exec('set local role ' + (account ? 'authenticated' : 'anon'));
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [account?.id || '']);
      return (
        await tx.query<Signal>(
          'select scope,revision,changed_at from public.change_signals order by scope',
        )
      ).rows;
    });
  const broadcast = async () => {
    const rows = (await db.query<Signal>('select * from public.change_signals')).rows;
    const changed = rows.filter((row) => Number(row.revision) !== known[row.scope]);
    rows.forEach((row) => {
      known[row.scope] = Number(row.revision);
    });
    if (!changed.length) return;
    for (const [stream, token] of streams) {
      if (stream.destroyed) {
        streams.delete(stream);
        continue;
      }
      const allowed = new Set((await readSignals(token)).map((row) => row.scope));
      for (const row of changed)
        if (allowed.has(row.scope)) stream.write('data: ' + JSON.stringify({ new: row }) + '\n\n');
    }
  };
  await broadcast();
  const tokenFor = (request: IncomingMessage) =>
    request.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    /(?:^|;\s*)classroom_session=([A-Za-z0-9_-]+)/.exec(request.headers.cookie || '')?.[1] ||
    '';
  const server = createServer(async (incoming, outgoing) => {
    try {
      const host = new URL('http://' + incoming.headers.host).hostname;
      const origin = incoming.headers.origin;
      if (
        !allowedHosts.has(host) ||
        (origin && origin !== appOrigin) ||
        incoming.headers['sec-fetch-site'] === 'cross-site'
      ) {
        outgoing.writeHead(403);
        outgoing.end('Local classroom access only.');
        return;
      }
      const url = new URL(incoming.url || '/', appOrigin);
      const method = incoming.method || 'GET';
      const token = tokenFor(incoming);
      if (url.pathname === '/api/classroom/events' && method === 'GET') {
        outgoing.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'X-Content-Type-Options': 'nosniff',
        });
        outgoing.write('retry: 1000\n: ready\n\n');
        streams.set(outgoing, token);
        outgoing.on('close', () => {
          streams.delete(outgoing);
        });
        return;
      }
      const parts: Buffer[] = [];
      let size = 0;
      for await (const part of incoming) {
        const bytes = Buffer.from(part);
        size += bytes.byteLength;
        if (size > 100000) {
          outgoing.writeHead(413);
          outgoing.end();
          return;
        }
        parts.push(bytes);
      }
      const body = Buffer.concat(parts);
      let response: Response;
      if (url.pathname === '/api/classroom/signals' && method === 'GET')
        response = Response.json({ data: await readSignals(token) });
      else if (url.pathname === '/api/classroom/login' && method === 'POST') {
        if (!incoming.headers['content-type']?.includes('application/json')) {
          outgoing.writeHead(415);
          outgoing.end();
          return;
        }
        let input;
        try {
          input = JSON.parse(body.toString());
          if (!input || typeof input !== 'object') throw new Error();
        } catch {
          outgoing.writeHead(400, { 'Content-Type': 'application/json' });
          outgoing.end('{"error":"invalid_json"}');
          return;
        }
        const result = sessions.login(
          String(input.email || ''),
          String(input.password || ''),
          incoming.socket.remoteAddress || 'local',
        );
        if ('error' in result)
          response = Response.json(
            { error: result.error },
            { status: result.error === 'too_many_attempts' ? 429 : 400 },
          );
        else
          response = Response.json(
            { session: result },
            {
              headers: {
                'Set-Cookie': `classroom_session=${result.access_token}; HttpOnly; SameSite=Strict; Path=/api/classroom/; Max-Age=28800`,
              },
            },
          );
      } else if (url.pathname === '/api/classroom/logout' && method === 'POST') {
        sessions.logout(token);
        response = Response.json(
          { ok: true },
          {
            headers: {
              'Set-Cookie':
                'classroom_session=; HttpOnly; SameSite=Strict; Path=/api/classroom/; Max-Age=0',
            },
          },
        );
      } else if (url.pathname === '/api/public/runtime' && method === 'GET')
        response = Response.json({
          release: APP_RELEASE,
          mode: 'classroom',
          testEnvironment: true,
        });
      else if (url.pathname.startsWith('/api/classroom/'))
        response = Response.json({ error: 'not_found' }, { status: 404 });
      else {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers))
          if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
        response = await app(
          new Request(url, {
            method,
            headers,
            body: ['GET', 'HEAD'].includes(method) ? undefined : body,
          }),
          { ip: incoming.socket.remoteAddress || 'local' },
        );
      }
      outgoing.writeHead(response.status, {
        'Cache-Control': 'no-store',
        ...Object.fromEntries(response.headers),
      });
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      if (!['GET', 'HEAD'].includes(method)) await broadcast();
    } catch (error) {
      console.error(
        'Classroom request failed:',
        error instanceof Error ? error.message : 'unknown',
      );
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'application/json' });
      outgoing.end('{"error":"local_request_failed"}');
    }
  });
  // Protocol heartbeat only; data is sent after commits, never polled.
  const heartbeat = setInterval(() => {
    for (const stream of streams.keys()) stream.write(': heartbeat\n\n');
  }, 20000);
  const maintenance = setInterval(() => {
    void runMaintenance(database)
      .then(broadcast)
      .catch(() => console.error('Local maintenance failed.'));
  }, 5 * 60000);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    clearInterval(heartbeat);
    clearInterval(maintenance);
    await opened.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Classroom address unavailable.');
  return {
    port: address.port,
    db,
    readSignals,
    close: async () => {
      clearInterval(heartbeat);
      clearInterval(maintenance);
      for (const stream of streams.keys()) stream.end();
      streams.clear();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await opened.close();
    },
  };
}
