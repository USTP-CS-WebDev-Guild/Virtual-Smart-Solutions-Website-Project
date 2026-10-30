import { json, parseBody, sameOrigin } from '../http/responses';
import { allowSubmission, allowSubmissionBudget } from '../security/rate-limit';
import { inquirySchema, privacyRequestSchema } from '../validation/forms';
import { normalizeEmail } from '../domain/rules';
import { readSiteContent, publicContent } from '../services/site-content';
import type { RouteContext } from '../http/context';
import { APP_RELEASE } from '../../shared/release';
import { isPublishableKey } from '../lib/public-config';
import { verifyCaptcha } from '../security/captcha';

export async function publicRoutes(route: RouteContext): Promise<Response | null> {
  const { request, path, method, requestId, ip } = route;
  if (method === 'GET' && path === '/api/public/runtime') {
    const key = process.env.PUBLIC_SUPABASE_ANON_KEY || '';
    const url = process.env.PUBLIC_SUPABASE_URL || '';
    if (
      !url ||
      !isPublishableKey(key) ||
      url.replace(/\/$/, '') !== process.env.SUPABASE_URL?.replace(/\/$/, '')
    ) {
      return json({ error: 'public_configuration_unavailable' }, 503, requestId);
    }
    return json(
      {
        release: APP_RELEASE,
        supabaseUrl: url,
        publishableKey: key,
        testEnvironment: process.env.PUBLIC_TEST_ENVIRONMENT === 'true',
      },
      200,
      requestId,
    );
  }
  if (method === 'GET' && path === '/api/public/content') {
    const db = route.database();
    return json(publicContent(await readSiteContent(db)), 200, requestId);
  }

  if (method === 'POST' && (path === '/api/inquiries' || path === '/api/privacy-requests')) {
    if (!sameOrigin(request)) return json({ error: 'invalid_origin' }, 403, requestId);
    const isInquiry = path === '/api/inquiries';
    const parsedBody = await parseBody(request, isInquiry ? 12_000 : 8_000);
    if (parsedBody instanceof Response) return parsedBody;
    const db = route.database();
    if (isInquiry) {
      const parsed = inquirySchema.safeParse(parsedBody.value);
      if (!parsed.success)
        return json(
          {
            error: 'invalid_form',
            fields: parsed.error.issues.map((issue) => ({
              path: issue.path,
              message: issue.message,
            })),
          },
          422,
          requestId,
        );
      const body = parsed.data;
      if (body.website) return json({ ok: true }, 202, requestId);
      const allowed = await allowSubmission(ip, db, 'inquiry');
      if (!allowed) return rateLimited(requestId);
      const captcha = await verifyCaptcha(body.captchaToken, ip, 'inquiry');
      if (captcha) return captcha;
      if (!(await allowSubmissionBudget(db, 'inquiry', body.email))) return budgetLimited(requestId);
      // A retry must still recover its saved receipt if the catalog changed
      // after a response was lost. Never create a second row for the same key.
      const existing = await db
        .from('inquiries')
        .select('id')
        .eq('idempotency_key', body.idempotencyKey)
        .maybeSingle();
      if (existing.error) throw new Error('inquiry_receipt_lookup_failed');
      if (existing.data)
        return json({ ok: true, inquiryId: existing.data.id, repeated: true }, 200, requestId);
      const record = await readSiteContent(db);
      const serviceIsPublished = record.content.services.some(
        (service) => service.published && service.title === body.service,
      );
      if (!serviceIsPublished && body.service !== 'Not sure yet')
        return json({ error: 'invalid_service' }, 422, requestId);
      const plan = body.requestedPlan
        ? record.content.plans.find((item) => item.id === body.requestedPlan && item.published)
        : null;
      if (body.requestedPlan && !plan)
        return json(
          {
            error: 'plan_unavailable',
            message: 'That package has changed. Choose an available package and try again.',
          },
          422,
          requestId,
        );
      // Price/name come from current published content, never client-supplied fields.
      const requestedPlan = plan
        ? {
            id: plan.id,
            name: plan.name,
            price: plan.price,
            period: plan.period,
            contentRevision: record.revision,
          }
        : null;
      const { data, error } = await db.rpc('submit_inquiry', {
        p_payload: {
          idempotencyKey: body.idempotencyKey,
          name: body.name,
          email: normalizeEmail(body.email),
          company: body.company,
          phone: body.phone,
          service: body.service,
          message: body.message,
          privacyNoticeVersion: record.content.settings.privacyNoticeVersion,
          requestedPlan,
        },
        p_now: Date.now(),
      });
      if (error) throw new Error('inquiry_save_failed');
      if (
        data?.ok !== true ||
        typeof data.inquiryId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(data.inquiryId)
      ) {
        throw new Error('inquiry_receipt_missing');
      }
      return json(data, data?.repeated ? 200 : 202, requestId);
    }
    const parsed = privacyRequestSchema.safeParse(parsedBody.value);
    if (!parsed.success)
      return json(
        {
          error: 'invalid_form',
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        },
        422,
        requestId,
      );
    const body = parsed.data;
    if (body.website) return json({ ok: true }, 202, requestId);
    const allowed = await allowSubmission(ip, db, 'privacy');
    if (!allowed) return rateLimited(requestId);
    const captcha = await verifyCaptcha(body.captchaToken, ip, 'privacy_request');
    if (captcha) return captcha;
    if (!(await allowSubmissionBudget(db, 'privacy', body.email))) return budgetLimited(requestId);
    const { data, error } = await db.rpc('submit_privacy_request', {
      p_payload: { ...body, email: normalizeEmail(body.email) },
      p_now: Date.now(),
    });
    if (error) throw new Error('privacy_request_save_failed');
    if (data?.ok !== true) throw new Error('privacy_request_receipt_missing');
    return json({ ...data, privacyRequestId: body.idempotencyKey }, 202, requestId);
  }
  return null;
}

function budgetLimited(requestId: string) {
  const response = json({ error: 'submission_budget_reached',
    message: 'The form has reached a submission limit. Please contact the company directly.' }, 429, requestId);
  response.headers.set('Retry-After', '3600');
  return response;
}

function rateLimited(requestId: string) {
  const windowMs = 10 * 60 * 1000;
  const retryAfter = Math.max(1, Math.ceil((windowMs - (Date.now() % windowMs)) / 1000));
  const response = json({ error: 'too_many_requests', retryAfter }, 429, requestId);
  response.headers.set('Retry-After', String(retryAfter));
  return response;
}
