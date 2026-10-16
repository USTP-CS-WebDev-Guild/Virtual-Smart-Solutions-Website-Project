import { defineConfig } from 'astro/config';

// Static pages are served by Netlify's CDN. Runtime endpoints live in
// backend/functions and share the same site origin under /api/*.
export default defineConfig({
  output: 'static',
  publicDir: './frontend/public',
  srcDir: './frontend',
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    server: {
      strictPort: true,
      proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } }
    }
  }
});
