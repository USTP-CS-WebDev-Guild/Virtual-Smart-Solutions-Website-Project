import { json } from '../http/responses';
import { canonicalOrigin, productionMode } from './environment';

// Network framing and volumetric DDoS protection still belong to the host.
export function requestGuard(request: Request, url: URL): Response | null {
  if (url.href.length > 4096) return json({ error: 'request_uri_too_long' }, 414);
  if (!['GET', 'POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
    const response = json({ error: 'method_not_allowed' }, 405);
    response.headers.set('Allow', 'GET, POST, PUT, PATCH');
    return response;
  }
  if (/[%](?:2f|5c|00)/i.test(url.pathname) || url.pathname.includes('\\') ||
      url.pathname.includes('//')) return json({ error: 'invalid_path' }, 400);
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) return json({ error: 'duplicate_query_parameter' }, 400);
    seen.add(key);
  }
  const encoding = request.headers.get('Content-Encoding');
  if (encoding && encoding.toLowerCase() !== 'identity')
    return json({ error: 'unsupported_content_encoding' }, 415);
  if (request.headers.has('Content-Length') && request.headers.has('Transfer-Encoding'))
    return json({ error: 'ambiguous_request_framing' }, 400);
  if (productionMode()) {
    const expected = canonicalOrigin();
    if (!expected) return json({ error: 'security_configuration_required' }, 503);
    if (url.protocol !== 'https:' || url.origin !== expected)
      return json({ error: 'invalid_origin' }, 403);
  }
  // Signed service-to-service webhooks do not use browser Origin headers.
  if (url.pathname !== '/api/webhooks/resend' &&
      request.headers.get('Sec-Fetch-Site') === 'cross-site')
    return json({ error: 'invalid_origin' }, 403);
  return null;
}
