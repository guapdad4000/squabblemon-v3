import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import type { ShopReceipt } from '@workspace/squabblemon-engine/economy';
import { readShopRequest, clearShopRequest } from '../lib/shopJournal';
import { revealProfileRewards } from '../lib/rewardReceipts';
import { RewardFileAction } from './ui/game-popup';
import '../styles/legacy-ticket-recovery.css';

/** Compatibility recovery only: this panel never creates a new ticket purchase. */
export function LegacyTicketRecovery({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap, client = useQueryClient();
  const [pending, setPending] = useState(() => readShopRequest(sessionStorage, profile.id));
  const [working, setWorking] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), lifetime = useRef({ active:false, playerId:profile.id });
  useLayoutEffect(() => {
    const current = { active:true, playerId:profile.id };
    lifetime.current = current; lock.current = false;
    setPending(readShopRequest(sessionStorage, profile.id)); setWorking(false); setError('');
    return () => { current.active = false; };
  }, [profile.id]);
  useEffect(() => {
    const refresh = () => setPending(readShopRequest(sessionStorage, profile.id));
    window.addEventListener('focus', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [profile.id]);
  async function recover() {
    const owner = lifetime.current;
    const key = getGetPlayerBootstrapQueryKey();
    const current = () => owner.active && lifetime.current === owner &&
      (!client.getQueryData<PlayerBootstrap>(key)?.profile.id || client.getQueryData<PlayerBootstrap>(key)!.profile.id === owner.playerId);
    if (lock.current || !current()) return;
    const request = readShopRequest(sessionStorage, owner.playerId);
    setPending(request);
    if (request?.itemId !== 'ticket') return;
    const clearMatching = () => {
      if (readShopRequest(sessionStorage, owner.playerId)?.idempotencyKey === request.idempotencyKey) clearShopRequest(sessionStorage, owner.playerId);
    };
    lock.current = true; setWorking(true); setError('');
    try {
      const result = await customFetch<{ receipt:ShopReceipt; bootstrap:PlayerBootstrap }>('/api/player/shop/purchases', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(request),
      });
      if (!current()) return;
      if (result.bootstrap.profile.id !== owner.playerId || result.receipt.itemId !== 'ticket') throw new Error('Invalid ticket receipt.');
      await client.cancelQueries({ queryKey:key });
      if (!current()) return;
      const latest = readShopRequest(sessionStorage, owner.playerId);
      if (latest && latest.idempotencyKey !== request.idempotencyKey) {
        setPending(latest); void client.invalidateQueries({ queryKey:key }); return;
      }
      client.setQueryData(key, result.bootstrap);
      clearMatching(); setPending(readShopRequest(sessionStorage, owner.playerId));
      revealProfileRewards(bootstrap, result.bootstrap, request.idempotencyKey, 'Ticket purchase confirmed', 'shop');
    } catch (reason) {
      if (!current()) return;
      if (reason instanceof ApiError && [400,409].includes(reason.status)) {
        clearMatching(); setPending(readShopRequest(sessionStorage, owner.playerId));
        void client.invalidateQueries({ queryKey:key });
      } else setError(reason instanceof ApiError && reason.status === 401
        ? 'Sign back in, then recover this same ticket purchase.'
        : 'Not confirmed. Your original purchase is kept; recover it again.');
    } finally {
      if (current()) { lock.current = false; setWorking(false); }
    }
  }
  if (pending?.itemId !== 'ticket') return null;
  return <aside className="legacy-ticket-recovery" aria-labelledby="legacy-ticket-title" aria-busy={working}>
    <div><h2 id="legacy-ticket-title">Your ticket needs confirmation</h2><p>Recover the saved purchase without paying twice.</p>{error && <p role="alert">{error}</p>}</div>
    <RewardFileAction disabled={working} onClick={() => void recover()}>{working ? 'Confirming…' : 'Recover ticket purchase'}</RewardFileAction>
  </aside>;
}
