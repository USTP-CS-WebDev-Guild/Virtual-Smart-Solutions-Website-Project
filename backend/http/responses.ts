import { readBodyText } from "./body";
import { canonicalOrigin } from '../security/environment';

export function json(
  value: unknown,
  status = 200,
  requestId?: string,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
    "Netlify-CDN-Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  if (requestId) headers.set("X-Request-ID", requestId);
  return new Response(JSON.stringify(value), { status, headers });
}

export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; status: number }> {
  const body = await readBodyText(request, maxBytes);
  if (!body.ok) return body;
  try {
    return { ok: true, value: JSON.parse(body.text) };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return process.env.CONTEXT === "dev" &&
    request.headers.get('Sec-Fetch-Site') !== 'cross-site';
  try {
    const requestOrigin = new URL(request.url).origin;
    const parsedOrigin = new URL(origin);
    // Origin is one serialized origin, not a URL with a path or credentials.
    if (origin !== parsedOrigin.origin) return false;
    const suppliedOrigin = parsedOrigin.origin;
    if (suppliedOrigin !== requestOrigin) return false;
    const configuredOrigin = canonicalOrigin();
    return process.env.CONTEXT === 'dev'
      ? !configuredOrigin || suppliedOrigin === configuredOrigin
      : Boolean(configuredOrigin && suppliedOrigin === configuredOrigin);
  } catch {
    return false;
  }
}

export async function parseBody(
  request: Request,
  limit: number,
): Promise<{ value: any } | Response> {
  const type = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (type !== "application/json")
    return json({ error: "json_content_type_required" }, 415);
  const result = await readJson(request, limit);
  if (!result.ok)
    return json(
      {
        error:
          result.status === 413
            ? "request_too_large"
            : result.status === 408
              ? "request_timeout"
              : "invalid_json",
      },
      result.status,
    );
  return { value: result.value };
}

export function csrfOkay(request: Request): boolean {
  return (
    sameOrigin(request) &&
    request.headers.get("X-Requested-With") === "VSSDashboard"
  );
}

export function resultError(result: any): Response | null {
  if (!result?.error) return null;
  const status =
    result.error === "not_found"
      ? 404
      : [
            "content_revision_conflict",
            "already_completed",
            "converted_inquiry_is_locked",
            "record_anonymized",
            "note_key_conflict",
          ].includes(result.error)
        ? 409
        : result.error === "action_does_not_match_request"
          ? 422
          : 400;
  return json({ error: result.error }, status);
}
