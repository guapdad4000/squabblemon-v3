import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, ApiError, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import type { StockzState } from '@workspace/squabblemon-engine/accountRewards';
import { ArcadeCabinet } from './MachineScreen';
import { FadecadeDialog } from './FadecadeDialog';
import { StockzArcade, StockzIcon } from './StockzArcade';
import { createStockzGate, resolveStockzOrder, isSettledStockzRound, stockzClock, type SettledStockzRound, type StockzOrder } from './stockzArcadeModel';
import '../../styles/stockz.css';

/** Keying the controller prevents one account's pending order leaking into another. */
export function StockzMachine({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  return <StockzMachineSession key={bootstrap.profile.id} bootstrap={bootstrap} />;
}

function StockzMachineSession({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState('DURG');
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [stake, setStake] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const [pendingOrder, setPendingOrder] = useState<StockzOrder | null>(null);
  const [result, setResult] = useState<SettledStockzRound | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const gate = useRef(createStockzGate());
  const mounted = useRef(true);
  const pendingSettlement = useRef<string | null>(null);
  const client = useQueryClient();
  const queryKey = ['stockz', bootstrap.profile.id];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => customFetch<StockzState>('/api/player/stockz', { signal }),
    enabled: open,
    retry: 1,
  });

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!open || !query.data?.active) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [open, query.data?.active?.id]);

  // Recover a request whose response was lost, including after reconnect/refocus.
  useEffect(() => {
    const data = query.data;
    if (!data) return;
    if (data.active) { setResult(null); setCelebrate(false); }
    if (pendingOrder && (data.active?.id === pendingOrder.id || data.recent.some(round => round.id === pendingOrder.id && isSettledStockzRound(round)))) {
      setPendingOrder(null);
      setError('');
      void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    }
    const receipt = data.recent.find(round => round.id === pendingSettlement.current && isSettledStockzRound(round));
    if (receipt && isSettledStockzRound(receipt)) {
      pendingSettlement.current = null;
      setResult(receipt);
      setCelebrate(true);
      setError('');
      void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    }
  }, [query.data, pendingOrder, client]);

  async function trade(action: 'start' | 'settle') {
    if (!gate.current.acquire()) return;
    const active = query.data?.active;
    const clock = stockzClock(active, Date.now());
    if (!query.data || query.isError || (action === 'start' && active) || (action === 'settle' && (!active || !clock.valid || clock.seconds > 0))) {
      gate.current.release();
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Keep the entire payload, not just its ID, after an uncertain response.
      const order = action === 'start' ? resolveStockzOrder(pendingOrder, { ticker, direction, stake }, () => crypto.randomUUID()) : null;
      if (order) setPendingOrder(order);
      if (action === 'settle') pendingSettlement.current = active!.id;
      // An older in-flight GET must not overwrite a newer accepted order.
      await client.cancelQueries({ queryKey, exact: true });
      const data = await customFetch<StockzState>(`/api/player/stockz/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(order ?? { id: active!.id }),
      });
      client.setQueryData(queryKey, data);
      void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      if (!mounted.current) return;
      if (action === 'start') { setPendingOrder(null); setResult(null); setCelebrate(false); }
      else {
        const receipt = data.recent.find(round => round.id === active!.id && isSettledStockzRound(round));
        if (receipt && isSettledStockzRound(receipt)) {
          pendingSettlement.current = null;
          setResult(receipt);
          setCelebrate(true);
        } else {
          setError('The closing receipt is still syncing. Refresh the market to confirm it.');
          void query.refetch();
        }
      }
      setNow(Date.now());
    } catch (err) {
      if (!mounted.current) return;
      const detail = err instanceof ApiError ? err.data as { error?: string } : null;
      // Validation/auth rejection is definitive; timeouts, conflicts and 5xx are not.
      if (action === 'start' && err instanceof ApiError && [400, 401, 403, 404, 422].includes(err.status)) setPendingOrder(null);
      setError(detail?.error ?? 'Connection interrupted. Refresh the market or retry the same saved order.');
      void query.refetch();
    } finally {
      gate.current.release();
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="fadecade-machine-group stockz-machine">
    <ArcadeCabinet artUrl="assets/fadecade/stockz-screen.webp" aspectRatio={1458 / 1079}
      aperture={{ left: '17%', top: '30%', width: '66%', height: '50%' }}
      testId="fadecade-stockz" className="machine-small stockz-screen">
      <div className="stockz-attract"><div className="stockz-attract-heading"><span>THE CLOUT EXCHANGE</span><strong>UP OR DOWN?</strong></div>
        <div className="stockz-attract-art" aria-hidden="true"><StockzIcon name="durg" /><StockzIcon name="clout" /><StockzIcon name="snkr" /></div>
        <button type="button" className="cabinet-btn" aria-expanded={open} aria-controls="stockz-setup" onClick={() => { setNow(Date.now()); setOpen(true); setCelebrate(false); }}>Play Stockz <span aria-hidden="true">↗</span></button>
      </div>
    </ArcadeCabinet>
    <FadecadeDialog open={open} onOpenChange={setOpen} title="Stockz · Clout Exchange" kind="stockz">
      <StockzArcade balance={bootstrap.profile.softCurrency} state={query.data} ticker={ticker} direction={direction} stake={stake} now={now}
        busy={busy} loading={query.isPending} unavailable={query.isError} retryPending={!!pendingOrder} error={error} result={result} celebrate={celebrate}
        onTicker={setTicker} onDirection={setDirection} onStake={setStake} onStart={() => void trade('start')} onSettle={() => void trade('settle')}
        onRefresh={() => { setNow(Date.now()); void query.refetch(); }}
        onDismissResult={() => { setResult(null); setCelebrate(false); }}
        onReview={receipt => { setResult(receipt); setCelebrate(false); }} />
    </FadecadeDialog>
  </div>;
}
