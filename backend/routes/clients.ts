import type { StaffRouteContext } from '../http/context';
import { json, parseBody, resultError } from '../http/responses';
import { clientStatusSchema } from '../validation/forms';
import { PAGE_SIZE, pageCursor, beforeCursor, nextCursor } from '../lib/pagination';

export async function clientRoutes(route: StaffRouteContext): Promise<Response | null> {
  const { path, method, request, url, db, actor, requestId } = route;
  if (path === '/api/admin/clients' && method === 'GET') {
    const cursor = pageCursor(url);
    if (cursor instanceof Response) return cursor;
    let query = db
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (cursor) query = query.or(beforeCursor(cursor));
    const { data, error } = await query;
    if (error) throw new Error('clients_read_failed');
    return json(
      {
        clients: (data || []).slice(0, PAGE_SIZE).map((row) => ({
          id: row.id,
          sourceInquiryId: row.source_inquiry_id,
          contactName: row.contact_name,
          email: row.email,
          company: row.company,
          status: row.status,
          createdAt: Number(row.created_at),
        })),
        nextCursor: nextCursor(data || []),
      },
      200,
      requestId,
    );
  }
  const match = path.match(/^\/api\/admin\/clients\/([0-9a-f-]{36})\/status$/i);
  if (match && method === 'PATCH') {
    const body = await parseBody(request, 2_000);
    if (body instanceof Response) return body;
    const parsed = clientStatusSchema.safeParse(body.value);
    if (!parsed.success) return json({ error: 'invalid_status' }, 422, requestId);
    const { data, error } = await db.rpc('change_client_status', {
      p_client_id: match[1],
      p_status: parsed.data.status,
      p_actor_email: actor.email,
      p_now: Date.now(),
    });
    if (error) throw new Error('client_status_update_failed');
    return resultError(data) || json(data, 200, requestId);
  }
  return null;
}
