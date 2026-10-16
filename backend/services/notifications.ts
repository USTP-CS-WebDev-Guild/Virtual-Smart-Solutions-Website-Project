import type { Database } from '../lib/database';
import { LEAD_RETENTION_MS, MAX_ATTEMPTS, retryDelayMs, safeErrorCode } from '../domain/rules';

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500);
}

async function updateOutbox(db: Database, id: string, values: Record<string, unknown>) {
  const { error } = await db.from('outbox').update(values).eq('id', id);
  if (error) throw new Error('outbox_update_failed');
}

export async function drainOutbox(
  db: Database,
  limit = 5,
): Promise<{ processed: number; captured: number }> {
  const now = Date.now();
  const { data, error } = await db.rpc('claim_outbox_batch', { p_now: now, p_limit: limit });
  if (error || !Array.isArray(data)) throw new Error('outbox_claim_failed');
  const items = data || [];
  let captured = 0;

  for (const item of items) {
    const attempt = Number(item.attempts || 1);
    if (process.env.TEST_EMAIL_MODE === 'capture') {
      await updateOutbox(db, item.id, {
        status: 'sent',
        delivery_status: 'test_captured',
        provider_message_id: `test-captured:${item.id}`,
        locked_until: null,
        last_error: null,
        updated_at: Date.now(),
      });
      captured += 1;
      continue;
    }

    if (
      !process.env.RESEND_API_KEY ||
      !process.env.OWNER_NOTIFY_EMAIL ||
      !process.env.RESEND_FROM
    ) {
      await updateOutbox(db, item.id, {
        status: 'dead',
        locked_until: null,
        last_error: 'email_provider_not_configured',
        updated_at: Date.now(),
      });
      continue;
    }

    const { data: inquiry, error: inquiryError } = await db
      .from('inquiries')
      .select('name,email,company,service,message,anonymized_at')
      .eq('id', item.inquiry_id)
      .maybeSingle();
    if (inquiryError || !inquiry || inquiry.anonymized_at) {
      await updateOutbox(db, item.id, {
        status: 'dead',
        locked_until: null,
        last_error: 'inquiry_unavailable',
        updated_at: Date.now(),
      });
      continue;
    }

    const text = [
      'A new website inquiry has arrived.',
      '',
      `Name: ${clean(inquiry.name)}`,
      `Email: ${clean(inquiry.email)}`,
      `Company: ${clean(inquiry.company)}`,
      `Service: ${clean(inquiry.service)}`,
      '',
      'Message:',
      clean(inquiry.message),
      '',
      'Open the staff inbox to review and respond.',
    ].join('\n');

    try {
      const response = await fetch('https://api.resend.com/emails', {
        signal: AbortSignal.timeout(8_000),
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': item.id,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM,
          to: [process.env.OWNER_NOTIFY_EMAIL],
          reply_to: inquiry.email,
          subject: `New website inquiry: ${clean(inquiry.name)}`,
          text,
        }),
      });
      if (response.ok) {
        const result = (await response.json()) as { id?: string };
        await updateOutbox(db, item.id, {
          status: 'sent',
          delivery_status: 'accepted',
          provider_message_id: result.id || null,
          locked_until: null,
          last_error: null,
          updated_at: Date.now(),
        });
        continue;
      }
      const retryable =
        response.status === 408 || response.status === 429 || response.status >= 500;
      const values =
        retryable && attempt < MAX_ATTEMPTS
          ? {
              status: 'pending',
              next_attempt_at: Date.now() + retryDelayMs(attempt),
              locked_until: null,
              last_error: safeErrorCode(response.status),
              updated_at: Date.now(),
            }
          : {
              status: 'dead',
              locked_until: null,
              last_error: safeErrorCode(response.status),
              updated_at: Date.now(),
            };
      await updateOutbox(db, item.id, values);
    } catch (failure) {
      // An accepted provider response must not be disguised as a network
      // failure if persisting its delivery state failed. The lease is retried.
      if (failure instanceof Error && failure.message === 'outbox_update_failed') throw failure;
      const values =
        attempt < MAX_ATTEMPTS
          ? {
              status: 'pending',
              next_attempt_at: Date.now() + retryDelayMs(attempt),
              locked_until: null,
              last_error: 'provider_network_error',
              updated_at: Date.now(),
            }
          : {
              status: 'dead',
              locked_until: null,
              last_error: 'provider_network_error',
              updated_at: Date.now(),
            };
      await updateOutbox(db, item.id, values);
    }
  }
  return { processed: items.length, captured };
}

export async function runMaintenance(db: Database) {
  const [email, privacy] = await Promise.all([
    drainOutbox(db),
    db.rpc('anonymize_expired_data', { p_now: Date.now(), p_retention_ms: LEAD_RETENTION_MS }),
  ]);
  if (privacy.error) throw new Error('privacy_retention_failed');
  return { email, privacy: privacy.data };
}
