// Public forms share one rule: only acknowledge a saved database receipt.
// Never clear a visitor's input or retry key on a failed/unconfirmed request.
const memoryKeys = new Map<string, string>();

export function submissionKey(name: string): string {
  let key = memoryKeys.get(name);
  try {
    key ||= sessionStorage.getItem(name) || undefined;
  } catch {
    /* Storage can be disabled. */
  }
  key ||= crypto.randomUUID();
  memoryKeys.set(name, key);
  try {
    sessionStorage.setItem(name, key);
  } catch {
    /* In-memory retries still work. */
  }
  return key;
}

export function forgetSubmissionKey(name: string) {
  memoryKeys.delete(name);
  try {
    sessionStorage.removeItem(name);
  } catch {
    /* Saving already succeeded. */
  }
}

type ReceiptField = 'inquiryId' | 'privacyRequestId';
export type SubmissionReceipt = { id: string; repeated: boolean };

export async function submitPublicForm(
  path: string,
  payload: unknown,
  receiptField: ReceiptField,
): Promise<SubmissionReceipt> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(
      'We could not confirm receipt. Your details are still here. Check your connection and try again.',
    );
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const reference = response.headers.get('X-Request-ID');
  const suffix =
    reference && /^[a-z0-9-]{1,80}$/i.test(reference) ? ` Reference: ${reference}.` : '';
  if (!response.ok) {
    if (body?.error === 'submission_budget_reached')
      throw new Error('The form has reached a submission limit. Your details are still here. Please contact the company by email.');
    if (body?.error === 'verification_required' || body?.error === 'verification_unavailable')
      throw new Error(`Please complete verification again and retry. Your details are still here.${suffix}`);
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After') || body?.retryAfter || 600);
      const minutes = Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds / 60)) : 10;
      throw new Error(
        `Too many attempts. Please wait ${minutes} minute(s), then try again.${suffix}`,
      );
    }
    if (response.status === 401 && !body) {
      throw new Error(
        'Access to this website is restricted. Ask the site owner to check visitor access.',
      );
    }
    if (body?.error === 'plan_unavailable') {
      throw new Error(
        `That package has changed. Review the available packages and try again. Your details are still here.${suffix}`,
      );
    }
    if (body?.error === 'invalid_service') {
      throw new Error(
        `The available services have changed. Reload this page, choose a service, and try again.${suffix}`,
      );
    }
    if (body?.error === 'invalid_form') {
      throw new Error(
        `Please check the required fields and try again. Your details are still here.${suffix}`,
      );
    }
    throw new Error(
      `The form is unavailable right now. Your details are still here; please try again.${suffix}`,
    );
  }
  const id = body?.[receiptField];
  if (
    body?.ok !== true ||
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new Error(
      `Receipt could not be confirmed. Your details are still here. Please try again.${suffix}`,
    );
  }
  return { id, repeated: body.repeated === true };
}
