import { staffAuthentication } from '../lib/auth';
import { json } from '../http/responses';
import type { RouteContext, StaffRouteContext } from '../http/context';
import { productionMode, productionConfigurationReady, captchaConfigurationReady, canonicalOrigin } from '../security/environment';

export async function systemRoutes(route: RouteContext): Promise<Response | null> {
  const { request, path, method, requestId } = route;
  if (method === 'GET' && path === '/api/health/live')
    return json({ status: 'ok', service: 'vss-website-site' }, 200, requestId);
  if (method === 'GET' && path === '/api/health/ready') {
    const db = route.database();
    const { error } = await db.from('site_content').select('id').limit(1);
    if (productionMode()) {
      const security = await db.rpc('get_security_readiness');
      if (!productionConfigurationReady() || security.error || security.data?.enforceMfa !== true)
        return json({ status: 'not_ready' }, 503, requestId);
    }
    return error
      ? json({ status: 'not_ready' }, 503, requestId)
      : json({ status: 'ready' }, 200, requestId);
  }
  if (method === 'GET' && path === '/api/auth/session') {
    const db = route.database();
    const authentication = await staffAuthentication(request, db);
    const actor = authentication.actor;
    return json(
      {
        enabled: true,
        authenticated: Boolean(actor),
        eligible: authentication.eligible,
        mfaRequired: authentication.mfaRequired && !actor,
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
  const secretMinimum = productionMode() ? 32 : 24;
  const secretReady = (process.env.RATE_LIMIT_SECRET || '').trim().length >= secretMinimum;
  const originReady = canonicalOrigin() === route.url.origin;
  const { error } = await route.db.rpc('get_dashboard_counts');
  const checks = [
    {
      name: 'Submission protection',
      ok: secretReady,
      message: secretReady
        ? 'Configured.'
        : `Set RATE_LIMIT_SECRET to a private random value of at least ${secretMinimum} characters in Netlify environment variables, then redeploy. Include the Functions scope if scope selection is available.`,
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
  if (productionMode()) {
    const policy = await route.db.rpc('get_security_readiness');
    checks.push({ name: 'Staff security policy',
      ok: !policy.error && policy.data?.enforceMfa === true,
      message: policy.data?.enforceMfa === true
        ? 'Production MFA, active-session checks and idle limits are enabled.'
        : 'Apply the identity/session migration and SECURE-PRODUCTION.sql to this production project.' });
    const captchaReady = captchaConfigurationReady();
    checks.push({ name: 'Form verification', ok: captchaReady,
      message: captchaReady ? 'Verification keys are configured; test a real form submission before handoff.' :
        'Set the Turnstile site key and private secret, then redeploy. Select Turnstile in Supabase Auth too.' });
  }
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
