import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { setBattleActive } from './imageWarmup';

test('real notification queries stop automatic work in battle/hidden, refresh on return, and isolate accounts while explicit mutations remain live', async t => {
  const globals = ['window', 'document', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const window = new EventTarget();
  let accountId = 'account-a';
  const reads: string[] = [], writes: string[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === 'POST') { writes.push(`${accountId}:${path}`); return Response.json({ ids: ['receipt-in-battle'], saved: true }); }
    reads.push(`${accountId}:${path}`);
    const body = path.endsWith('/mail') ? { messages: [{ id: `mail-${accountId}`, title: accountId, body: '', sender: '', sentAt: '', readAt: null, claimedAt: null, gift: { softCurrency: 0, packTickets: 0, styleShards: 0 } }] }
      : path.endsWith('/daily-clout') ? { date: 'today', available: true, amount: 50, attemptsRemaining: 1, resetsAt: '' }
      : path.endsWith('/account') ? { date: 'today', pending: [], growth: { ready: false } }
      : { state: 'not-ready' };
    return Response.json(body);
  };
  for (const [name, value] of Object.entries({ window, document, fetch, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, name, { configurable: true, value });
  // Import after installing a browser: QueryObserver's real polling must run.
  const { QueryClient, QueryClientProvider, useQuery, useMutation } = await import('@tanstack/react-query');
  const { customFetch, getGetPlayerBootstrapQueryKey } = await import('@workspace/api-client-react');
  const { useNotificationBackground } = await import('./notificationBackground');
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  let current: ReturnType<typeof useNotificationBackground>;
  let saveReceipt!: () => Promise<unknown>;
  function Probe({ id }: { id: string }) {
    current = useNotificationBackground(id);
    useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: () => customFetch('/api/player/bootstrap'), staleTime: Infinity });
    const receipt = useMutation({ mutationFn: () => customFetch('/api/player/notifications/receipts', { method: 'POST', body: JSON.stringify({ ids: ['receipt-in-battle'] }) }), onSuccess: value => client.setQueryData(['notification-receipts', id], value) });
    saveReceipt = () => receipt.mutateAsync();
    return null;
  }
  const flush = async () => { for (let i = 0; i < 8; i++) { await Promise.resolve(); t.mock.timers.tick(0); } };
  const tree = (id: string) => React.createElement(QueryClientProvider, { client }, React.createElement(Probe, { id }));
  let renderer: ReturnType<typeof create>;
  let inBattle = false;
  try {
    await act(async () => { renderer = create(tree(accountId)); await flush(); });
    assert.equal(reads.length, 6, 'five notification reads plus bootstrap');
    const initial = reads.length;
    await act(async () => { t.mock.timers.tick(30000); await flush(); });
    await act(async () => { t.mock.timers.tick(30000); await flush(); });
    const menuPollsPerMinute = reads.length - initial;
    assert.equal(menuPollsPerMinute, 8, 'retain prior 30s/60s menu cadence');
    await act(async () => { setBattleActive(true); inBattle = true; await flush(); });
    const beforeBattle = reads.length;
    await act(async () => { t.mock.timers.tick(120000); await flush(); });
    assert.equal(reads.length, beforeBattle, 'no automatic notification or bootstrap reads during battle');
    await act(async () => { await saveReceipt(); await flush(); });
    assert.equal(writes.length, 1);
    assert.deepEqual(client.getQueryData(['notification-receipts', accountId]), { ids: ['receipt-in-battle'], saved: true });
    await act(async () => { setBattleActive(false); inBattle = false; await flush(); });
    assert.equal(reads.length - beforeBattle, 6, 'each optional query and bootstrap refreshes once on return');
    document.visibilityState = 'hidden';
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await flush(); });
    const beforeHidden = reads.length;
    await act(async () => { t.mock.timers.tick(120000); await flush(); });
    assert.equal(reads.length, beforeHidden);
    accountId = 'account-b';
    await act(async () => { renderer!.update(tree(accountId)); await flush(); });
    assert.equal(current!.mail.data, undefined, 'new account cannot see old account mail');
    assert.equal(client.getQueryData(['notification-receipts', accountId]), undefined);
    assert.equal(reads.length, beforeHidden, 'hidden account switch must not start optional reads');
    document.visibilityState = 'visible';
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await flush(); });
    assert.equal(reads.length - beforeHidden, 6);
    await act(async () => { await flush(); });
    assert.equal(current!.mail.data?.messages[0].id, 'mail-account-b');
    assert.equal(client.getQueryData(['player-mail', 'account-a']) !== undefined, true, 'old cache remains namespaced');
    await act(async () => { renderer!.unmount(); await flush(); });
    const beforeUnmount = reads.length;
    await act(async () => { t.mock.timers.tick(120000); await flush(); });
    assert.equal(reads.length, beforeUnmount);
    t.diagnostic(JSON.stringify({ baselineScheduledPerMinute: menuPollsPerMinute, battleScheduledIn120Seconds: 0, hiddenScheduledIn120Seconds: 0, resumeReads: 6, receiptWritesInBattle: writes.length }));
  } finally {
    if (inBattle) setBattleActive(false);
    client.clear();
    for (const name of globals) { const descriptor = previous.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
  }
});
