import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectLiveUpdates, type ChangeScope } from '../../frontend/lib/live-updates';

function harness() {
  vi.useFakeTimers();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  vi.stubGlobal('navigator', { onLine: true });
  let receive!: (payload: unknown) => void;
  let status!: (value: string) => void;
  let allowed: Array<{ scope: ChangeScope; revision: number }> = [{ scope: 'staff', revision: 0 }];
  const channel = {
    on: vi.fn((_event, _filter, callback) => {
      receive = callback;
      return channel;
    }),
    subscribe: vi.fn((callback) => {
      status = callback;
      return channel;
    }),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
    from: vi.fn(() => ({ select: () => ({ in: async () => ({ data: allowed, error: null }) }) })),
  };
  const changed = vi.fn(async (_scopes: Set<ChangeScope>) => {});
  const state = vi.fn();
  return {
    client,
    changed,
    state,
    receive: (scope: ChangeScope, revision: number) => receive({ new: { scope, revision } }),
    status: (s: string) => status(s),
    rows: (value: typeof allowed) => {
      allowed = value;
    },
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('WebSocket invalidations without data polling', () => {
  it('waits for readiness, resynchronizes once, and updates immediately on a new revision', async () => {
    const h = harness();
    const stop = connectLiveUpdates(h.client as any, ['staff'], {
      changed: h.changed,
      state: h.state,
    });
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.changed).not.toHaveBeenCalled();
    expect(h.client.channel).toHaveBeenCalledWith(expect.any(String), {
      config: { postgres_changes_options: { wait: true, timeout: 10_000 } },
    });
    h.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.state).toHaveBeenLastCalledWith('live');
    h.receive('staff', 1);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.changed).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.changed).toHaveBeenCalledTimes(2);
    h.receive('staff', 1);
    h.receive('owner', 9);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.changed).toHaveBeenCalledTimes(2);
    stop();
    h.receive('staff', 10);
    expect(h.client.removeChannel).toHaveBeenCalledTimes(1);
    expect(h.changed).toHaveBeenCalledTimes(2);
  });
  it('resynchronizes after reconnect instead of trusting events that may have been lost', async () => {
    const h = harness();
    const stop = connectLiveUpdates(h.client as any, ['staff'], {
      changed: h.changed,
      state: h.state,
    });
    h.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    h.status('CHANNEL_ERROR');
    expect(h.state).toHaveBeenLastCalledWith('reconnecting');
    h.rows([{ scope: 'staff', revision: 5 }]);
    h.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.changed).toHaveBeenCalledTimes(2);
    expect(h.state).toHaveBeenLastCalledWith('live');
    stop();
  });
  it('retains a failed invalidation and retries the read without starting idle polling', async () => {
    const h = harness();
    const stop = connectLiveUpdates(h.client as any, ['staff'], {
      changed: h.changed,
      state: h.state,
    });
    h.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    h.changed.mockRejectedValueOnce(new Error('temporary network failure'));
    h.receive('staff', 1);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.state).toHaveBeenLastCalledWith('reconnecting');
    await vi.advanceTimersByTimeAsync(500);
    expect(h.changed).toHaveBeenCalledTimes(3);
    expect([...h.changed.mock.calls[2]![0]]).toEqual(['staff']);
    expect(h.state).toHaveBeenLastCalledWith('live');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.changed).toHaveBeenCalledTimes(3);
    stop();
  });
  it('does not claim a live connection if RLS hides a required signal or the publication is missing', async () => {
    const h = harness();
    h.rows([]);
    const stop = connectLiveUpdates(h.client as any, ['staff'], {
      changed: h.changed,
      state: h.state,
    });
    h.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.state).toHaveBeenLastCalledWith('setup_required');
    expect(h.changed).not.toHaveBeenCalled();
    stop();
    const k = harness();
    const stop2 = connectLiveUpdates(k.client as any, ['staff'], {
      changed: k.changed,
      state: k.state,
      verify: async () => false,
    });
    k.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    expect(k.state).toHaveBeenLastCalledWith('setup_required');
    stop2();
  });
});
