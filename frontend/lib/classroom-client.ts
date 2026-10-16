// Dev-only browser adapter. It uses real local sessions, PostgreSQL-backed API
// routes, and an event stream. Production builds select Supabase instead.
import type { SupabaseClient } from '@supabase/supabase-js';
type Session = {
  access_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
  };
};
export function createClassroomClient(): SupabaseClient {
  const key = 'vss-local-session';
  const listeners = new Set<(event: string, session: Session | null) => void>();
  let memory: Session | null = null;
  const current = () => {
    try {
      memory = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      /* In-memory use also works when storage is disabled. */
    }
    if (memory && memory.expires_at * 1000 < Date.now()) memory = null;
    return memory;
  };
  const emit = (event: string, session: Session | null) => {
    listeners.forEach((fn) => fn(event, session));
  };
  const save = (session: Session | null) => {
    memory = session;
    try {
      if (session) localStorage.setItem(key, JSON.stringify(session));
      else localStorage.removeItem(key);
    } catch {}
  };
  window.addEventListener('storage', (event) => {
    if (event.key === key) emit(current() ? 'SIGNED_IN' : 'SIGNED_OUT', current());
  });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: current() }, error: null }),
      signInWithPassword: async (credentials: { email: string; password: string }) => {
        const response = await fetch('/api/classroom/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        const result = await response.json();
        if (!response.ok)
          return { data: { session: null }, error: { code: result.error, message: result.error } };
        save(result.session);
        emit('SIGNED_IN', result.session);
        return { data: { session: result.session }, error: null };
      },
      signOut: async () => {
        const token = current()?.access_token;
        save(null);
        emit('SIGNED_OUT', null);
        try {
          await fetch('/api/classroom/logout', {
            method: 'POST',
            headers: token ? { Authorization: 'Bearer ' + token } : {},
          });
        } catch {
          /* Local UI is already signed out; server sessions expire. */
        }
        return { error: null };
      },
      onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        listeners.add(callback);
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
      },
    },
    from: (table: string) => {
      if (table !== 'change_signals')
        throw new Error('Classroom browser access is limited to signal metadata.');
      return {
        select: () => ({
          in: async (_column: string, scopes: string[]) => {
            const token = current()?.access_token;
            const response = await fetch('/api/classroom/signals', {
              headers: token ? { Authorization: 'Bearer ' + token } : {},
            });
            const result = await response.json();
            return {
              data: result.data?.filter((row: { scope: string }) => scopes.includes(row.scope)),
              error: response.ok ? null : new Error('signal_read_failed'),
            };
          },
        }),
      };
    },
    channel: () => {
      let source: EventSource | null = null;
      let receive: (payload: any) => void = () => {};
      const channel = {
        on: (_event: string, _filter: unknown, callback: (payload: any) => void) => {
          receive = callback;
          return channel;
        },
        subscribe: (state: (value: string) => void) => {
          source = new EventSource('/api/classroom/events');
          source.onopen = () => state('SUBSCRIBED');
          source.onerror = () => state('CHANNEL_ERROR');
          source.onmessage = (event) => receive(JSON.parse(event.data));
          return channel;
        },
        close: () => {
          source?.close();
        },
      };
      return channel;
    },
    removeChannel: async (channel: { close: () => void }) => {
      channel.close();
      return 'ok';
    },
  };
  // The application uses this documented subset of the Supabase client. The
  // classroom adapter deliberately exposes no arbitrary browser database writes.
  return client as unknown as SupabaseClient;
}
