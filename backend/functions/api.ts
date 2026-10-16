import type { Config } from '@netlify/functions';
import app from '../app';

// Hosting adapter only. Application routes are in backend/routes/.
export const config: Config = { path: '/api/*' };
export default app;
