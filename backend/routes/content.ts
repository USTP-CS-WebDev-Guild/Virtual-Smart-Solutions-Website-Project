import { json, parseBody, resultError } from '../http/responses';
import { readSiteContent } from '../services/site-content';
import { saveSiteContentSchema } from '../../shared/site-content/validation';
import type { StaffRouteContext } from '../http/context';

export async function contentRoutes(route: StaffRouteContext): Promise<Response | null> {
  const { request, path, method, requestId, db, actor } = route;
  if (method === 'GET' && path === '/api/admin/site-content') {
    const record = await readSiteContent(db);
    return json(
      { content: record.content, revision: record.revision, updatedAt: record.updatedAt },
      200,
      requestId,
    );
  }
  if (method === 'GET' && path === '/api/admin/site-content/history') {
    const { data, error } = await db
      .from('site_content_events')
      .select('id,revision,actor_email,action,created_at')
      .order('revision', { ascending: false })
      .limit(20);
    if (error) throw new Error('site_content_history_failed');
    return json(
      {
        history: (data || []).map((item) => ({
          id: item.id,
          revision: item.revision,
          actorEmail: item.actor_email,
          action: item.action,
          createdAt: Number(item.created_at),
        })),
      },
      200,
      requestId,
    );
  }
  const revisionMatch = path.match(/^\/api\/admin\/site-content\/history\/(\d+)$/);
  if (method === 'GET' && revisionMatch) {
    const { data, error } = await db
      .from('site_content_events')
      .select('after_content')
      .eq('revision', Number(revisionMatch[1]))
      .maybeSingle();
    if (error) throw new Error('site_content_revision_read_failed');
    if (!data) return json({ error: 'not_found' }, 404, requestId);
    return json({ content: data.after_content }, 200, requestId);
  }
  if (method === 'PUT' && path === '/api/admin/site-content') {
    const parsedBody = await parseBody(request, 80_000);
    if (parsedBody instanceof Response) return parsedBody;
    const parsed = saveSiteContentSchema.safeParse(parsedBody.value);
    if (!parsed.success)
      return json(
        {
          error: 'invalid_site_content',
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        },
        422,
        requestId,
      );
    const { data, error } = await db.rpc('publish_site_content', {
      p_expected_revision: parsed.data.revision,
      p_content: parsed.data.content,
      p_actor_email: actor.email,
      p_now: Date.now(),
    });
    if (error) throw new Error('site_content_save_failed');
    const failed = resultError(data);
    return failed || json(data, 200, requestId);
  }
  return null;
}
