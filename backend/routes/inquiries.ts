import { json, parseBody, resultError } from '../http/responses';
import { statusSchema, inquiryNoteSchema } from '../validation/forms';
import { PAGE_SIZE, pageCursor, beforeCursor, nextCursor } from '../lib/pagination';
import type { StaffRouteContext } from '../http/context';

function mapInquiry(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    phone: row.phone,
    service: row.service,
    message: row.message,
    requestedPlan: row.requested_plan || null,
    status: row.status,
    possibleDuplicate: row.possible_duplicate,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    anonymizedAt: row.anonymized_at ? Number(row.anonymized_at) : null,
  };
}

export async function inquiryRoutes(route: StaffRouteContext): Promise<Response | null> {
  const { request, url, path, method, requestId, db, actor } = route;
  if (method === 'GET' && path === '/api/admin/summary') {
    const { data, error } = await db.rpc('get_dashboard_counts');
    if (error) throw new Error('summary_read_failed');
    return json(
      { actorRole: actor.role, inquiries: data.inquiries, notifications: data.notifications },
      200,
      requestId,
    );
  }

  if (method === 'GET' && path === '/api/admin/inquiries') {
    const status = url.searchParams.get('status');
    const cursor = pageCursor(url);
    if (cursor instanceof Response) return cursor;
    if (status && !['new', 'in_progress', 'waiting', 'converted', 'closed'].includes(status))
      return json({ error: 'invalid_status' }, 422, requestId);
    let query = db
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (status) query = query.eq('status', status);
    if (cursor) query = query.or(beforeCursor(cursor));
    const { data: rows, error } = await query;
    if (error) throw new Error('inquiries_read_failed');
    const page = (rows || []).slice(0, PAGE_SIZE);
    const ids = page.map((item) => item.id);
    const { data: notices, error: noticeError } = ids.length
      ? await db
          .from('outbox')
          .select('id,inquiry_id,status,delivery_status,attempts,last_error')
          .in('inquiry_id', ids)
      : { data: [], error: null };
    if (noticeError) throw new Error('notification_read_failed');
    const notificationById = new Map((notices || []).map((item) => [item.inquiry_id, item]));
    return json(
      {
        inquiries: page.map((item) => ({
          ...mapInquiry(item),
          notification: notificationById.get(item.id) || null,
        })),
        nextCursor: nextCursor(rows || []),
      },
      200,
      requestId,
    );
  }

  const detailMatch = path.match(/^\/api\/admin\/inquiries\/([0-9a-f-]{36})$/i);
  if (method === 'GET' && detailMatch) {
    const { data, error } = await db
      .from('inquiries')
      .select('*')
      .eq('id', detailMatch[1])
      .maybeSingle();
    if (error) throw new Error('inquiry_read_failed');
    if (!data) return json({ error: 'not_found' }, 404, requestId);
    const { data: notification, error: noticeError } = await db
      .from('outbox')
      .select('id,status,delivery_status,attempts,last_error')
      .eq('inquiry_id', data.id)
      .maybeSingle();
    if (noticeError) throw new Error('notification_read_failed');
    return json({ inquiry: { ...mapInquiry(data), notification } }, 200, requestId);
  }

  const notesMatch = path.match(/^\/api\/admin\/inquiries\/([0-9a-f-]{36})\/notes$/i);
  if (notesMatch && method === 'GET') {
    const { data, error } = await db
      .from('inquiry_notes')
      .select('id,body,created_by,created_at')
      .eq('inquiry_id', notesMatch[1])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error('notes_read_failed');
    return json(
      {
        notes: (data || [])
          .filter((row) => row.body)
          .map((row) => ({
            id: row.id,
            body: row.body,
            createdBy: row.created_by,
            createdAt: Number(row.created_at),
          })),
      },
      200,
      requestId,
    );
  }
  if (notesMatch && method === 'POST') {
    const body = await parseBody(request, 5_000);
    if (body instanceof Response) return body;
    const parsed = inquiryNoteSchema.safeParse(body.value);
    if (!parsed.success) return json({ error: 'invalid_note' }, 422, requestId);
    const { data, error } = await db.rpc('add_inquiry_note', {
      p_id: parsed.data.idempotencyKey,
      p_inquiry_id: notesMatch[1],
      p_body: parsed.data.body,
      p_actor_email: actor.email,
      p_now: Date.now(),
    });
    if (error) throw new Error('note_save_failed');
    return resultError(data) || json(data, data.repeated ? 200 : 201, requestId);
  }

  const eventsMatch = path.match(/^\/api\/admin\/inquiries\/([0-9a-f-]+)\/events$/i);
  if (method === 'GET' && eventsMatch) {
    const { data, error } = await db
      .from('inquiry_events')
      .select('*')
      .eq('inquiry_id', eventsMatch[1])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error('inquiry_events_read_failed');
    return json(
      {
        events: (data || []).map((item) => ({
          id: item.id,
          inquiryId: item.inquiry_id,
          eventType: item.event_type,
          actorType: item.actor_type,
          actorId: item.actor_id,
          detailsJson: item.details_json,
          createdAt: Number(item.created_at),
        })),
      },
      200,
      requestId,
    );
  }

  const statusMatch = path.match(/^\/api\/admin\/inquiries\/([0-9a-f-]+)\/status$/i);
  if (method === 'PATCH' && statusMatch) {
    const parsedBody = await parseBody(request, 4_000);
    if (parsedBody instanceof Response) return parsedBody;
    const parsed = statusSchema.safeParse(parsedBody.value);
    if (!parsed.success) return json({ error: 'invalid_status' }, 422, requestId);
    const { data, error } = await db.rpc('change_inquiry_status', {
      p_inquiry_id: statusMatch[1],
      p_status: parsed.data.status,
      p_actor_email: actor.email,
      p_now: Date.now(),
    });
    if (error) throw new Error('inquiry_status_update_failed');
    const failed = resultError(data);
    return failed || json({ ok: true }, 200, requestId);
  }

  const convertMatch = path.match(/^\/api\/admin\/inquiries\/([0-9a-f-]+)\/convert$/i);
  if (method === 'POST' && convertMatch) {
    const { data, error } = await db.rpc('convert_inquiry', {
      p_inquiry_id: convertMatch[1],
      p_actor_email: actor.email,
      p_now: Date.now(),
    });
    if (error) throw new Error('inquiry_conversion_failed');
    const failed = resultError(data);
    return failed || json(data, 200, requestId);
  }
  return null;
}
