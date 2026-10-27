import { json, parseBody } from '../http/responses';
import { LEAD_RETENTION_MS } from '../domain/rules';
import { drainOutbox } from '../services/notifications';
import type { StaffRouteContext } from '../http/context';
import { productionMode } from '../security/environment';

export async function notificationRoutes(route: StaffRouteContext): Promise<Response | null> {
  const { request, path, method, requestId, db, actor } = route;
  if (path.startsWith('/api/admin/test/') &&
      (productionMode() || process.env.PUBLIC_TEST_ENVIRONMENT !== 'true' || process.env.TEST_EMAIL_MODE !== 'capture'))
    return json({ error: 'test_environment_required' }, 404, requestId);
  if (method === 'POST' && path === '/api/admin/test/live-check') {
    if (process.env.PUBLIC_TEST_ENVIRONMENT !== 'true' || process.env.TEST_EMAIL_MODE !== 'capture')
      return json({ error: 'test_environment_required' }, 404, requestId);
    const { data, error } = await db.rpc('probe_realtime');
    if (error) throw new Error('realtime_probe_failed');
    return json(data, 200, requestId);
  }
  if (method === 'POST' && path === '/api/admin/test/run-jobs') {
    if (actor.role !== 'owner') return json({ error: 'owner_access_required' }, 403, requestId);
    const [email, privacy] = await Promise.all([
      drainOutbox(db),
      db.rpc('anonymize_expired_data', { p_now: Date.now(), p_retention_ms: LEAD_RETENTION_MS }),
    ]);
    if (privacy.error) throw new Error('privacy_retention_failed');
    return json(
      {
        ok: true,
        jobs: ['notification_outbox', 'privacy_retention'],
        email,
        privacy: privacy.data,
        completedAt: Date.now(),
      },
      200,
      requestId,
    );
  }

  if (method === 'POST' && path === '/api/admin/outbox/retry') {
    if (actor.role !== 'owner') return json({ error: 'owner_access_required' }, 403, requestId);
    const parsedBody = await parseBody(request, 4_000);
    if (parsedBody instanceof Response) return parsedBody;
    const id = String(parsedBody.value?.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'invalid_outbox_id' }, 422, requestId);
    const { data, error } = await db
      .from('outbox')
      .update({
        status: 'pending',
        attempts: 0,
        next_attempt_at: Date.now(),
        locked_until: null,
        last_error: null,
        updated_at: Date.now(),
      })
      .eq('id', id)
      .eq('status', 'dead')
      .select('id')
      .maybeSingle();
    if (error) throw new Error('outbox_retry_failed');
    return data
      ? json({ ok: true }, 200, requestId)
      : json({ error: 'not_found_or_not_failed' }, 404, requestId);
  }
  return null;
}
