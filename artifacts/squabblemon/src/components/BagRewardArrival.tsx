import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { useNotifications, type BagResource } from './Notifications';
import { GameGlyph, type GameGlyphName } from './venue/GameGlyph';
import { AnimatedNumber } from './AnimatedNumber';
import { isBattleActive, subscribeBattleActive } from '../lib/imageWarmup';
import { rewardReceipts } from '../lib/rewardReceiptStore';
import { getAssetUrl } from '../lib/assets';
import '../styles/bag-reward-arrival.css';

type Batch = { ids: string[]; amounts: Partial<Record<BagResource, number>> };
const resources: { kind: BagResource; label: string; glyph: GameGlyphName }[] = [
  { kind: 'clout', label: 'Clout', glyph: 'clout' },
  { kind: 'tickets', label: 'Tickets', glyph: 'ticket' },
  { kind: 'shards', label: 'Universal Shards', glyph: 'shards' },
];
const blocked = () => document.visibilityState !== 'visible' || isBattleActive() || !!rewardReceipts.current()
  || !!document.querySelector('dialog[open], [role="dialog"][data-state="open"], [role="dialog"][aria-modal="true"], .gacha-stage[data-phase]:not([data-phase="idle"])');

/** Presents existing positive wallet notices; never grants or modifies currency. */
export function BagRewardArrival({ profile }: { profile: PlayerBootstrap['profile'] }) {
  const { notices, seen } = useNotifications();
  const pending = notices.filter(notice => notice.bagReward && notice.bagReward.amount > 0);
  const pendingKey = pending.map(notice => notice.id).join('\n');
  const latest = useRef(pending); latest.current = pending;
  const [batch, setBatch] = useState<Batch | null>(null);
  const card = useRef<HTMLElement>(null);
  const [flight, setFlight] = useState<CSSProperties | null>(null);
  const balances = { clout: profile.softCurrency, tickets: profile.packTickets, shards: profile.styleShards };

  useEffect(() => {
    if (batch || !pendingKey) return;
    let timer: number | undefined;
    const schedule = () => {
      if (blocked()) { window.clearTimeout(timer); timer = undefined; return; }
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        if (blocked()) return;
        const selected = latest.current;
        if (!selected.length) return;
        const amounts: Batch['amounts'] = {};
        for (const notice of selected) {
          const reward = notice.bagReward!;
          amounts[reward.kind] = (amounts[reward.kind] ?? 0) + reward.amount;
        }
        setBatch({ ids: selected.map(notice => notice.id), amounts });
      }, 650);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'data-state', 'data-phase', 'aria-modal'] });
    const battle = subscribeBattleActive(schedule), rewards = rewardReceipts.subscribe(schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => { window.clearTimeout(timer); observer.disconnect(); battle(); rewards(); document.removeEventListener('visibilitychange', schedule); };
  }, [pendingKey, batch]);

  useEffect(() => {
    if (!batch) return;
    // Existing bell reads and cross-tab receipts also cancel a queued presentation.
    if (!batch.ids.every(id => pendingKey.split('\n').includes(id))) setBatch(null);
  }, [batch, pendingKey]);

  useEffect(() => {
    if (!batch) { setFlight(null); return; }
    const reduced = profile.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && card.current) {
      const kind = resources.find(resource => batch.amounts[resource.kind])!.kind;
      const targets = document.querySelectorAll<HTMLElement>(`[data-wallet-resource="${kind}"], [data-station="inventory"]`);
      const target = [...targets].find(element => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
      });
      if (target) {
        const start = card.current.getBoundingClientRect(), end = target.getBoundingClientRect();
        setFlight({ '--flight-x': `${start.left + 38}px`, '--flight-y': `${start.top + 36}px`,
          '--flight-dx': `${end.left + end.width / 2 - start.left - 38}px`, '--flight-dy': `${end.top + end.height / 2 - start.top - 36}px` } as CSSProperties);
      }
    }
    const abortIfBlocked = () => { if (blocked()) setBatch(null); };
    const timer = window.setTimeout(() => { if (!blocked()) { seen(batch.ids); setBatch(null); } }, 3600);
    const observer = new MutationObserver(abortIfBlocked);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'data-state', 'data-phase', 'aria-modal'] });
    const battle = subscribeBattleActive(abortIfBlocked), rewards = rewardReceipts.subscribe(abortIfBlocked);
    document.addEventListener('visibilitychange', abortIfBlocked);
    abortIfBlocked();
    return () => { window.clearTimeout(timer); observer.disconnect(); battle(); rewards(); document.removeEventListener('visibilitychange', abortIfBlocked); };
  }, [batch, seen, profile.settings.reducedMotion]);

  if (!batch) return null;
  const shown = resources.filter(resource => batch.amounts[resource.kind]);
  return createPortal(<div className="bag-arrival" data-bag-reward-arrival="true" data-reduced-motion={profile.settings.reducedMotion}>
    <aside ref={card} className="bag-arrival__receipt" role="status" aria-live="polite" aria-atomic="true"
      style={{ '--bag-brick': `url("${getAssetUrl('assets/progression/brick-ui-v1.webp')}")` } as CSSProperties}>
      <span className="bag-arrival__heading">In the bag</span>
      {shown.map(resource => <div className="bag-arrival__resource" key={resource.kind}>
        <GameGlyph name={resource.glyph} /><span><strong>+{batch.amounts[resource.kind]!.toLocaleString()} {resource.label}</strong>
        <small>Balance <AnimatedNumber value={balances[resource.kind]} from={Math.max(0, balances[resource.kind] - batch.amounts[resource.kind]!)} reducedMotion={profile.settings.reducedMotion} /></small></span>
      </div>)}
    </aside>
    {flight && <div className="bag-arrival__flight" style={flight} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} style={{ '--coin-index': index } as CSSProperties}><GameGlyph name={shown[0].glyph} /></i>)}</div>}
  </div>, document.body);
}
