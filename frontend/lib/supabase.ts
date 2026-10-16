import { createClient } from '@supabase/supabase-js';
import { createClassroomClient } from './classroom-client';
const url = import.meta.env.PUBLIC_SUPABASE_URL || '';
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
// Classroom mode exists only in Astro development. Production builds cannot
// activate local accounts, even if someone changes a browser URL or storage.
export const classroomMode =
  import.meta.env.DEV && import.meta.env.PUBLIC_CLASSROOM_MODE === 'true';
export const supabase = classroomMode
  ? createClassroomClient()
  : url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
