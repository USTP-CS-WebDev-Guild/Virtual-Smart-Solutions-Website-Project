import { createClient } from '@supabase/supabase-js';
import { createClassroomClient } from './classroom-client';
import { tabAuthStorage } from './auth-storage';
const url = import.meta.env.PUBLIC_SUPABASE_URL || '';
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
// Remove the previous release's persistent credential for this project only.
try {
  if (url) localStorage.removeItem('sb-' + new URL(url).hostname.split('.')[0] + '-auth-token');
} catch { /* Restricted browser storage does not prevent signing in. */ }
// Classroom mode exists only in Astro development. Production builds cannot
// activate local accounts, even if someone changes a browser URL or storage.
export const classroomMode =
  import.meta.env.DEV && import.meta.env.PUBLIC_CLASSROOM_MODE === 'true';
export const supabase = classroomMode
  ? createClassroomClient()
  : url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
          storage: tabAuthStorage(), storageKey: 'vss-staff-session' },
      })
    : null;
