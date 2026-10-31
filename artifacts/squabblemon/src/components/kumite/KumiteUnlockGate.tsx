import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { getCardImage } from '../../lib/assets';
import { claimKumiteFilmReceipt, getKumiteFilmReceipts, type KumiteFilmReceipt } from '../../lib/kumite';
import { KUMITE_FILMS } from '../../lib/kumiteFilms';
import { isBattleActive, subscribeBattleActive } from '../../lib/imageWarmup';
import { rewardReceipts } from '../../lib/rewardReceiptStore';
import { isWorldArrivalRoute, useWorldSurface, worldAutoPresentationAllowed } from '../../lib/worldSurface';

const presentationBlocked = () => !!document.querySelector('dialog[open], [role="dialog"][data-state="open"], [role="dialog"][aria-modal="true"], .gacha-stage[data-phase]:not([data-phase="idle"])');

/** Auto presentations only begin on a safe destination, never in a timed room or minigame. */
export function KumiteUnlockGate({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [location] = useLocation();
  const battle = useSyncExternalStore(subscribeBattleActive, isBattleActive, () => false);
  const reward = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  const world = useWorldSurface();
  const [visible, setVisible] = useState(() => !document.hidden);
  const [dialogOpen, setDialogOpen] = useState(presentationBlocked);
  const [claiming, setClaiming] = useState(false);
  const [pending, setPending] = useState<KumiteFilmReceipt | null>(null);
  const mounted = useRef(false);
  const attempted = useRef('');
  const client = useQueryClient();
  const enabled = bootstrap.profile.onboardingStep === 'complete' && !battle && visible && worldAutoPresentationAllowed(world)
    && (['/game', '/game/kumite', '/game/collection'].includes(location.split('?')[0]) || isWorldArrivalRoute(location, world));
  const key = ['kumite-film-receipts', bootstrap.profile.id];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getKumiteFilmReceipts(signal), enabled,
    staleTime: 15_000, refetchInterval: enabled ? 30_000 : false, retry: 1, refetchOnWindowFocus: true });
  useEffect(() => {
    mounted.current = true;
    const update = () => setVisible(!document.hidden);
    const dialogs = new MutationObserver(() => setDialogOpen(presentationBlocked()));
    dialogs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-modal', 'data-state', 'data-phase'] });
    document.addEventListener('visibilitychange', update);
    return () => { mounted.current = false; dialogs.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    // A claim may finish after navigation. Keep its presentation until a safe screen returns.
    if (!pending || !enabled || reward || dialogOpen || isBattleActive() || presentationBlocked()) return;
    const film = KUMITE_FILMS.find(item => item.cardId === pending.cardId);
    rewardReceipts.show({ id: `${bootstrap.profile.id}:kumite-film:${pending.id}`, title: `${pending.name} unlocked`,
      items: [{ label: pending.name, image: getCardImage(pending.cardId) }], kumiteFilmKey: film?.key });
    setPending(null);
  }, [pending, enabled, reward, dialogOpen, query.dataUpdatedAt, bootstrap.profile.id]);
  useEffect(() => {
    const next = query.data?.receipts?.[0];
    if (!enabled || reward || pending || !next || claiming || dialogOpen || presentationBlocked()) return;
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
      client.setQueryData<{ receipts: KumiteFilmReceipt[] }>(key, previous => previous?.receipts
        ? { receipts: previous.receipts.filter(item => item.id !== next.id) } : previous);
    }).catch(() => { /* No receipt was confirmed; retry on the next server refresh. */ })
      .finally(() => { if (mounted.current) setClaiming(false); });
  }, [enabled, reward, pending, claiming, dialogOpen, query.data, query.dataUpdatedAt, bootstrap.profile.id, client]);
  return null;
}
