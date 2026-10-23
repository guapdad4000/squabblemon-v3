import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { getCardImage } from '../../lib/assets';
import { claimKumiteFilmReceipt, getKumiteFilmReceipts, type KumiteFilmReceipt } from '../../lib/kumite';
import { KUMITE_FILMS } from '../../lib/kumiteFilms';
import { isBattleActive, subscribeBattleActive } from '../../lib/imageWarmup';
import { rewardReceipts } from '../../lib/rewardReceiptStore';

/** Auto presentations only begin on a safe destination, never in a timed room or minigame. */
export function KumiteUnlockGate({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [location] = useLocation();
  const battle = useSyncExternalStore(subscribeBattleActive, isBattleActive, () => false);
  const reward = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [claiming, setClaiming] = useState(false);
  const [pending, setPending] = useState<KumiteFilmReceipt | null>(null);
  const mounted = useRef(false);
  const attempted = useRef('');
  const client = useQueryClient();
  const enabled = bootstrap.profile.onboardingStep === 'complete' && !battle && visible
    && ['/game', '/game/kumite', '/game/collection'].includes(location.split('?')[0]);
  const key = ['kumite-film-receipts', bootstrap.profile.id];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getKumiteFilmReceipts(signal), enabled,
    staleTime: 15_000, refetchInterval: enabled ? 30_000 : false, retry: 1, refetchOnWindowFocus: true });
  useEffect(() => {
    mounted.current = true;
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => { mounted.current = false; document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    // A claim may finish after navigation. Keep its presentation until a safe screen returns.
    if (!pending || !enabled || reward || isBattleActive()
      || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
    const film = KUMITE_FILMS.find(item => item.cardId === pending.cardId);
    rewardReceipts.show({ id: `${bootstrap.profile.id}:kumite-film:${pending.id}`, title: `${pending.name} unlocked`,
      items: [{ label: pending.name, image: getCardImage(pending.cardId) }], kumiteFilmKey: film?.key });
    setPending(null);
  }, [pending, enabled, reward, query.dataUpdatedAt, bootstrap.profile.id]);
  useEffect(() => {
    const next = query.data?.receipts[0];
    if (!enabled || reward || pending || !next || claiming || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
    const attempt = `${next.id}:${query.dataUpdatedAt}`;
    if (attempted.current === attempt) return;
    attempted.current = attempt;
    setClaiming(true);
    void claimKumiteFilmReceipt(next.id).then(({ receipt }) => {
      if (!mounted.current) return;
      if (receipt) {
        setPending(receipt);
        void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      }
      client.setQueryData<{ receipts: KumiteFilmReceipt[] }>(key, previous => previous
        ? { receipts: previous.receipts.filter(item => item.id !== next.id) } : previous);
    }).catch(() => { /* No receipt was confirmed; retry on the next server refresh. */ })
      .finally(() => { if (mounted.current) setClaiming(false); });
  }, [enabled, reward, pending, claiming, query.data, query.dataUpdatedAt, bootstrap.profile.id, client]);
  return null;
}
