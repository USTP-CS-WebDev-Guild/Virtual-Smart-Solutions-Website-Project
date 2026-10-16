export const prerender = true;

const baseUrl = import.meta.env.PUBLIC_SITE_URL;
const paths = ['/', '/services/', '/portfolio/', '/approach/', '/about/', '/contact/', '/privacy/'];

export function GET() {
  const entries = baseUrl
    ? paths.map((path) => '<url><loc>' + baseUrl + path + '</loc></url>').join('')
    : '';
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entries +
    '</urlset>';
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
