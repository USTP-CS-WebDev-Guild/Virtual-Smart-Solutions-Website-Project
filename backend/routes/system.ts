import { findActor } from '../lib/auth';
import { json } from '../http/responses';
import type { RouteContext, StaffRouteContext } from '../http/context';

export async function systemRoutes(route: RouteContext): Promise<Response | null> {
  const { request, path, method, requestId } = route;
  if (method === 'GET' && path === '/api/health/live')
    return json({ status: 'ok', service: 'vss-website-site' }, 200, requestId);
  if (method === 'GET' && path === '/api/health/ready') {
    const db = route.database();
    const { error } = await db.from('site_content').select('id').limit(1);
    return error
      ? json({ status: 'not_ready' }, 503, requestId)
      : json({ status: 'ready' }, 200, requestId);
  }
  if (method === 'GET' && path === '/api/auth/session') {
    const db = route.database();
    const actor = await findActor(request, db);
    return json(
      {
        enabled: true,
        authenticated: Boolean(actor),
        user: actor ? { email: actor.email, role: actor.role } : null,
      },
      200,
      requestId,
    );
  }

  if (path === '/api/health/notifications' && method === 'GET') {
    const db = route.database();
    const { data, error } = await db.rpc('get_notification_health', { p_now: Date.now() });
    if (error) throw new Error('notification_health_failed');
    const stuck = data?.status === 'attention_required';
    return json(data, stuck ? 503 : 200, requestId);
  }
  return null;
}

// Owner-only diagnostics expose pass/fail and setting names, never key values.
export async function submissionChecks(route: StaffRouteContext): Promise<Response | null> {
  if (route.method !== 'GET' || route.path !== '/api/admin/submission-checks') return null;
  const secretReady = (process.env.RATE_LIMIT_SECRET || '').trim().length >= 24;
  let originReady = false;
  try {
    originReady = new URL(process.env.APP_ORIGIN || '').origin === route.url.origin;
  } catch {
    /* A missing or malformed value is a failed setup check. */
  }
  const { error } = await route.db.rpc('get_dashboard_counts');
  const checks = [
    {
      name: 'Submission protection',
      ok: secretReady,
      message: secretReady
        ? 'Configured.'
        : 'Set RATE_LIMIT_SECRET to a private random value of at least 24 characters in Netlify environment variables, then redeploy. Include the Functions scope if scope selection is available.',
    },
    {
      name: 'Website address',
      ok: originReady,
      message: originReady
        ? 'APP_ORIGIN matches this website.'
        : 'Set APP_ORIGIN to this website origin in Netlify and redeploy. For a Deploy Preview, use its approved preview address.',
    },
    {
      name: 'Database functions',
      ok: !error,
      message: error
        ? 'The database functions could not be read. Check the server project URL, private key, and applied migrations.'
        : 'The server can call the database functions.',
    },
  ];
  const realtime = await route.db.rpc('get_realtime_setup');
  const liveReady =
    !realtime.error &&
    realtime.data &&
    ['publication', 'signals', 'triggers', 'rls'].every((key) => realtime.data[key] === true);
  checks.push({
    name: 'Live updates',
    ok: Boolean(liveReady),
    message: liveReady
      ? 'Realtime publication, signal rows, triggers, and RLS are configured.'
      : 'Apply the new secure_realtime_workspace migration to this Supabase project. Do not rerun migration 0001.',
  });
  return json(
    { ok: checks.every((check) => check.ok), checks, checkedAt: Date.now() },
    200,
    route.requestId,
  );
}

export async function realtimeStatus(route: StaffRouteContext): Promise<Response | null> {
  if (route.method !== 'GET' || route.path !== '/api/admin/realtime-status') return null;
  const { data, error } = await route.db.rpc('get_realtime_setup');
  const ready =
    !error &&
    Boolean(data) &&
    ['publication', 'signals', 'triggers', 'rls'].every((key) => data[key] === true);
  return json({ ready }, 200, route.requestId);
}
