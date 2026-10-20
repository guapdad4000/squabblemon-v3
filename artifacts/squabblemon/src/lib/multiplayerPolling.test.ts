import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { isOnlineSnapshotSynchronized } from './multiplayer';

// Exercise real QueryClient cancellation ordering, including React-batched connectivity updates.
const tick = () => new Promise(resolve => setTimeout(resolve, 1));

for (const commitDisabledBeforeAwait of [true, false]) test(`resume cancels obsolete GETs before re-enabling; disabled committed=${commitDisabledBeforeAwait}`, async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const key = ['friend-match', 'test', 'ABCDEF123456'];
  const scope = JSON.stringify(['test', 'ABCDEF123456']);
  let generation = 0;
  let confirmedRead: { scope: string; generation: number; revision: number } | null = null;
  let reads = 0;
  const pending: { resolve: (value: { revision: number }) => void; signal: AbortSignal }[] = [];
  client.setQueryData(key, { revision: 1 });
  const options = {
    queryKey: key,
    enabled: true,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const atStart = generation;
      const incoming = await new Promise<{ revision: number }>((resolve, reject) => {
        reads++;
        pending.push({ resolve, signal });
        signal.addEventListener('abort', () => reject(signal.reason));
      });
      if (atStart === generation) {
        confirmedRead = { scope, generation: atStart, revision: incoming.revision };
      }
      const current = client.getQueryData<{ revision: number }>(key)!;
      return current.revision > incoming.revision ? current : incoming;
    },
  };
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await tick();
    assert.equal(reads, 1);
    generation++;
    if (commitDisabledBeforeAwait) {
      observer.setOptions({ ...options, enabled: false });
    }
    const cancellation = client.cancelQueries(
      { queryKey: key, exact: true },
      { revert: false },
    );
    // A write acknowledgement arrives while obsolete read cancellation is pending.
    client.setQueryData(key, { revision: 7 });
    await cancellation;
    assert.equal(client.getQueryData<{ revision: number }>(key)!.revision, 7,
      'cancellation must not roll back acknowledgement');
    assert.equal(confirmedRead, null,
      'acknowledgement cannot confirm a GET');

    // Production may invalidate while disabled, then commit enabled, or remain
    // enabled across batched React state updates. Both must start only one GET.
    void client.invalidateQueries({ queryKey: key }, { cancelRefetch: false });
    observer.setOptions(options);
    assert.equal(reads, 2);
    await tick();
    assert.equal(client.getQueryState(key)!.fetchStatus, 'fetching',
      'old cancellation must not clobber the new fetch');
    void client.refetchQueries({ queryKey: key }, { cancelRefetch: false });
    assert.equal(reads, 2,
      'poll must deduplicate the pending fresh read');

    pending[0].resolve({ revision: 2 });
    await tick();
    assert.equal(confirmedRead, null,
      'cancelled stale response must not unlock commands');
    pending[1].resolve({ revision: 6 });
    await tick();
    assert.deepEqual(confirmedRead, { scope, generation: 1, revision: 6 });
    assert.equal(client.getQueryData<{ revision: number }>(key)!.revision, 7,
      'fresh lower response must not overwrite the later acknowledgement');
    assert.equal(client.getQueryState(key)!.fetchStatus, 'idle');
    assert.equal(client.getQueryState(key)!.error, null);
    assert.equal(isOnlineSnapshotSynchronized(confirmedRead, scope, generation, 7), true);
  } finally {
    unsubscribe();
    client.clear();
  }
});
