import { json, parseBody, resultError } from '../http/responses';
import { privacyCompletionSchema } from '../validation/forms';
import type { StaffRouteContext } from '../http/context';
import { PAGE_SIZE, pageCursor, beforeCursor, nextCursor } from '../lib/pagination';
import { searchTerm, searchFilter } from '../lib/search';

function mapPrivacyRequest(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    requestType: row.request_type,
    message: row.message,
    status: row.status,
    createdAt: Number(row.created_at),
    completedAt: row.completed_at == null ? null : Number(row.completed_at),
    completedBy: row.completed_by,
    identityVerifiedAt: row.identity_verified_at == null ? null : Number(row.identity_verified_at),
    completionAction: row.completion_action,
    completionNote: row.completion_note,
  };
}

export async function privacyRoutes(route: StaffRouteContext): Promise<Response | null> {
  const { request, path, method, requestId, db, actor, url } = route;
  if (method === 'GET' && path === '/api/admin/privacy-requests') {
    const search = searchTerm(url);
    if (search instanceof Response) return search;
    const cursor = pageCursor(url);
    if (cursor instanceof Response) return cursor;
    const status = url.searchParams.get('status');
    if (status && !['open', 'completed'].includes(status))
      return json({ error: 'invalid_status' }, 422, requestId);
    let query = db
      .from('privacy_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(searchFilter(search, ['name', 'email']));
    if (cursor) query = query.or(beforeCursor(cursor));
    const { data, error } = await query;
    if (error) throw new Error('privacy_requests_read_failed');
    return json(
      {
        requests: (data || []).slice(0, PAGE_SIZE).map(mapPrivacyRequest),
        nextCursor: nextCursor(data || []),
      },
      200,
      requestId,
    );
  }

  const privacyComplete = path.match(/^\/api\/admin\/privacy-requests\/([0-9a-f-]+)\/complete$/i);
  if (method === 'PATCH' && privacyComplete) {
    const parsedBody = await parseBody(request, 4_000);
    if (parsedBody instanceof Response) return parsedBody;
    const parsed = privacyCompletionSchema.safeParse(parsedBody.value);
    if (!parsed.success) return json({ error: 'completion_details_required' }, 422, requestId);
    const { data, error } = await db.rpc('complete_privacy_request', {
      p_request_id: privacyComplete[1],
      p_actor_email: actor.email,
      p_action: parsed.data.action,
      p_note: parsed.data.note,
      p_now: Date.now(),
    });
    if (error) throw new Error('privacy_request_completion_failed');
    const failed = resultError(data);
    return failed || json({ ok: true }, 200, requestId);
  }
  return null;
}
