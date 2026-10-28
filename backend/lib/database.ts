import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Database = SupabaseClient;

export function createDatabase(): Database {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('server_database_not_configured');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      // Bound provider/network stalls for every Auth and database call.
      fetch: (input, init = {}) => fetch(input, {
        ...init, redirect: 'error',
        signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) :
          AbortSignal.timeout(10_000),
      }),
    },
  });
}
