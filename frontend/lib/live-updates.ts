import type { SupabaseClient } from '@supabase/supabase-js';

export type ChangeScope = 'public' | 'staff' | 'owner';
export type LiveState = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'setup_required';
type Options = {
  changed: (scopes: Set<ChangeScope>) => Promise<void>;
  state?: (state: LiveState) => void;
  verify?: () => Promise<boolean>;
  observed?: (scope: ChangeScope, revision: number) => void;
};

// Database events invalidate views; API/database reads remain the source of
// truth. There is no periodic data polling. Resubscription and focus reconcile
// current state so a dropped event cannot permanently strand the UI.
export function connectLiveUpdates(
  client: SupabaseClient,
  scopes: ChangeScope[],
  options: Options,
) {
  let stopped = false;
  let joined = false;
  let verified = false;
  let reconciling = false;
  let flushing = false;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let dirty = new Set<ChangeScope>();
  const revisions = new Map<ChangeScope, number>();
  const state = (value: LiveState) => {
    if (!stopped) options.state?.(value);
  };
  const flush = async () => {
    if (stopped || !verified || flushing || !dirty.size) return;
    flushing = true;
    try {
      while (!stopped && dirty.size) {
        const batch = dirty;
        dirty = new Set();
        try {
          await options.changed(batch);
        } catch (error) {
          batch.forEach((scope) => dirty.add(scope));
          throw error;
        }
      }
      retryCount = 0;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      if (joined) state('live');
    } catch {
      state(navigator.onLine === false ? 'offline' : 'reconnecting');
      // Retry a failed read, not idle data polling. Reconnect/focus also
      // reconcile state if all four bounded recovery attempts fail.
      if (!stopped && joined && navigator.onLine !== false && !retryTimer && retryCount < 4) {
        retryTimer = setTimeout(
          () => {
            retryTimer = undefined;
            void flush();
          },
          500 * 2 ** retryCount++,
        );
      }
    } finally {
      flushing = false;
    }
  };
  const reconcile = async () => {
    if (stopped || !joined || reconciling) return;
    reconciling = true;
    try {
      if (options.verify && !(await options.verify())) {
        state('setup_required');
        return;
      }
      const { data, error } = await client
        .from('change_signals')
        .select('scope,revision')
        .in('scope', scopes);
      if (stopped) return;
      if (error || !data || scopes.some((scope) => !data.some((row) => row.scope === scope))) {
        state('setup_required');
        return;
      }
      verified = true;
      retryCount = 0;
      for (const row of data) {
        const scope = row.scope as ChangeScope;
        revisions.set(scope, Math.max(revisions.get(scope) ?? -1, Number(row.revision)));
      }
      scopes.forEach((scope) => dirty.add(scope));
      await flush();
    } catch {
      state(navigator.onLine === false ? 'offline' : 'reconnecting');
    } finally {
      reconciling = false;
    }
  };

  state('connecting');
  const channel = client
    .channel('vss-' + crypto.randomUUID(), {
      // This pinned SDK waits for the server's database listener to be ready,
      // rather than mistaking a socket join for working replication.
      config: { postgres_changes_options: { wait: true, timeout: 10_000 } },
    })
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'change_signals' },
      (payload) => {
        if (stopped) return;
        const scope = payload.new.scope as ChangeScope;
        const revision = Number(payload.new.revision);
        if (!scopes.includes(scope) || !Number.isFinite(revision)) return;
        options.observed?.(scope, revision);
        if (revision <= (revisions.get(scope) ?? -1)) return;
        revisions.set(scope, revision);
        dirty.add(scope);
        void flush();
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        joined = true;
        void reconcile();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        joined = false;
        verified = false;
        state('reconnecting');
      }
    });

  const returned = () => {
    if (document.visibilityState !== 'hidden') void reconcile();
  };
  const offline = () => state('offline');
  window.addEventListener('focus', returned);
  window.addEventListener('online', returned);
  window.addEventListener('offline', offline);
  document.addEventListener('visibilitychange', returned);
  return () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(retryTimer);
    dirty.clear();
    window.removeEventListener('focus', returned);
    window.removeEventListener('online', returned);
    window.removeEventListener('offline', offline);
    document.removeEventListener('visibilitychange', returned);
    void client.removeChannel(channel).catch(() => {});
  };
}
