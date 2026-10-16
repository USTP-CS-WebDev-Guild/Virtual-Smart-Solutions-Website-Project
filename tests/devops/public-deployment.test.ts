import { describe, expect, it } from 'vitest';
import { inspectPublicDeployment } from '../../devops/scripts/verify-deployment.mjs';

describe('public deployment verification', () => {
  it('fails explicitly on the actual Netlify hosting login response', async () => {
    const fetcher = async () =>
      new Response('<title>Login Redirect</title><script>edge-access?domain=example</script>', {
        status: 401,
        headers: { 'content-type': 'text/html' },
      });
    await expect(inspectPublicDeployment('https://site.example', fetcher)).rejects.toThrow(
      'make production Public',
    );
  });
  it('requires public pages and runtime APIs while keeping private APIs protected', async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.startsWith('/api/admin/'))
        return Response.json({ error: 'staff_access_required' }, { status: 401 });
      if (url.pathname === '/api/health/ready') return Response.json({ status: 'ready' });
      if (url.pathname === '/api/public/content')
        return Response.json({ content: { services: [] } });
      if (url.pathname === '/api/public/runtime')
        return Response.json({
          release: '1.5.0',
          supabaseUrl: 'https://test.supabase.co',
          publishableKey: 'sb_publishable_synthetic_fixture',
          testEnvironment: true,
        });
      if (url.pathname === '/about/')
        return new Response(null, { status: 301, headers: { location: '/about' } });
      return new Response('<meta name="app-release" content="1.5.0">', {
        headers: { 'Content-Security-Policy': "connect-src 'self' wss://*.supabase.co" },
      });
    };
    expect(await inspectPublicDeployment('https://site.example', fetcher)).toMatchObject({
      publicPages: 8,
      protectedApis: 4,
    });
    await expect(
      inspectPublicDeployment('https://site.example', async (input, init) =>
        new URL(input instanceof Request ? input.url : input).pathname.startsWith('/api/admin/')
          ? Response.json({ inquiries: [] })
          : fetcher(input, init),
      ),
    ).rejects.toThrow('expected HTTP 401');
  });
});
