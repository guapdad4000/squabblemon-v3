import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import type { AccountRewardGrant, AccountRewardStatus } from '@workspace/squabblemon-engine/accountRewards';
import { MonthlyLoginTrack } from './MonthlyLoginTrack';
import { AccountCheckInCalendar } from './AccountCheckInCalendar';
import { GameGlyph } from './venue/GameGlyph';
import { getAssetUrl, getCardImage } from '../lib/assets';
import { isBattleActive, subscribeBattleActive } from '../lib/imageWarmup';
import { rewardReceipts } from '../lib/rewardReceiptStore';
import '../styles/reward-street-file.css';
import '../styles/daily-check-in-arrival.css';

type ClaimResult = { rewards: AccountRewardGrant[]; status: AccountRewardStatus; bootstrap: PlayerBootstrap };
const dismissedDays = new Map<string, string>();
const storageKey = (player: string) => `squabblemon:daily-arrival:v1:${player}`;
function wasDismissed(player: string, date: string) {
  if (dismissedDays.get(player) === date) return true;
  try { return localStorage.getItem(storageKey(player)) === date; } catch { return false; }
}
function rememberDismissal(player: string, date: string) {
  dismissedDays.set(player, date);
  try { localStorage.setItem(storageKey(player), date); } catch { /* Presentation history is optional; claims are server-authoritative. */ }
}

/** Home-only arrival: one daily reward, after existing invitations/celebrations. */
export function DailyCheckInArrival({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const player = bootstrap.profile.id;
  const client = useQueryClient();
  const queryKey = ['account-rewards', player];
  const query = useQuery({ queryKey, queryFn: () => customFetch<AccountRewardStatus>('/api/player/rewards/account'), staleTime: 30000, retry: 1 });
  const status = query.data;
  const date = status?.date;
  const eligible = !!status && !!date && !status.claimedToday && status.pending?.some(reward => reward.key === `login:${date}`);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const mounted = useRef(false), claiming = useRef(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<(ClaimResult & { recruitBuddy: boolean }) | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!eligible || !date || open || dismissed === date || wasDismissed(player, date)) return;
    let timer: number | undefined;
    const safe = () => document.visibilityState === 'visible' && !isBattleActive() && !rewardReceipts.current()
      && !document.querySelector('[data-bag-reward-arrival], dialog[open], [role="dialog"][data-state="open"], [role="dialog"][aria-modal="true"], .gacha-stage[data-phase]:not([data-phase="idle"])');
    const schedule = () => {
      window.clearTimeout(timer);
      if (!safe()) return;
      timer = window.setTimeout(() => {
        if (!safe() || wasDismissed(player, date)) return;
        // Eligibility and reward day come from the server, never the device clock.
        setReceipt(null); setError(''); setOpen(true);
      }, 2200);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'data-state', 'data-phase', 'aria-modal'] });
    const unsubscribeBattle = subscribeBattleActive(schedule);
    const unsubscribeRewards = rewardReceipts.subscribe(schedule);
    const storage = (event: StorageEvent) => { if (event.key === storageKey(player)) schedule(); };
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('storage', storage);
    schedule();
    return () => { window.clearTimeout(timer); observer.disconnect(); unsubscribeBattle(); unsubscribeRewards(); document.removeEventListener('visibilitychange', schedule); window.removeEventListener('storage', storage); };
  }, [eligible, date, status?.nextResetAt, player, open, dismissed]);

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [open]);

  function close() {
    const displayedDate = receipt?.status.date ?? date;
    if (claiming.current || !displayedDate) return;
    rememberDismissal(player, displayedDate);
    setDismissed(displayedDate); setOpen(false);
    dialog.current?.close();
    opener.current?.focus({ preventScroll: true });
    if (receipt?.recruitBuddy) {
      rewardReceipts.show({ id: `daily-buddy:${player}`, title: 'Buddy joined your crew', characterId: 'buddy', presentation: 'recruit', items: [{ label: 'Buddy', amount: 1 }] });
    }
  }
  async function claim() {
    if (claiming.current || receipt) return;
    const ownedBuddyBeforeClaim = bootstrap.profile.ownedCardIds.includes('buddy');
    claiming.current = true; setBusy(true); setError('');
    try {
      const result = await customFetch<ClaimResult>('/api/player/rewards/account/claim', { method: 'POST' });
      if (!mounted.current || result.bootstrap.profile.id !== player) return;
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      client.setQueryData(queryKey, result.status);
      rememberDismissal(player, result.status.date);
      setReceipt({ ...result, recruitBuddy: !ownedBuddyBeforeClaim
        && result.bootstrap.profile.ownedCardIds.includes('buddy')
        && result.rewards.some(reward => reward.cardId === 'buddy' && reward.styleShards === 0 && reward.isNewCard !== false) });
    } catch {
      if (mounted.current) setError('Couldn’t confirm your check-in. Try again.');
    } finally { claiming.current = false; if (mounted.current) setBusy(false); }
  }
  const rewards = receipt?.rewards ?? status?.pending ?? [];
  const totals = rewards.reduce((sum, reward) => ({ clout: sum.clout + reward.softCurrency, tickets: sum.tickets + reward.packTickets, shards: sum.shards + (reward.shardRarity ? 0 : reward.styleShards) }), { clout: 0, tickets: 0, shards: 0 });
  const rewardItems = [
    { amount: totals.clout, label: 'Clout', glyph: 'cloutStack' as const },
    { amount: totals.tickets, label: 'Tickets', glyph: 'ticket' as const },
    { amount: totals.shards, label: 'Style Shards', glyph: 'shards' as const },
  ].filter(item => item.amount > 0);
  // A committed claim can lose its response. Recover only this receipt day's
  // saved monthly identities; this does not credit or celebrate another grant.
  const recoveredCards = receipt && !receipt.rewards.length
    ? receipt.status.monthly?.milestones.flatMap(milestone => milestone.reward?.date === receipt.status.date ? [milestone.reward] : []) ?? []
    : [];
  const cardRewards = [...rewards, ...recoveredCards].filter(reward => reward.cardId);
  const shownStatus = receipt?.status ?? status;
  return <dialog ref={dialog} className="daily-arrival reward-street-file game-popup" data-popup-family="reward" style={{
    '--reward-file-scene': `url("${getAssetUrl('assets/selection/underpass.webp')}")`,
    '--reward-file-folder': `url("${getAssetUrl('assets/selection/dossier.webp')}")`,
  } as CSSProperties} aria-labelledby="daily-arrival-title" data-receipt={!!receipt} onCancel={event => { event.preventDefault(); close(); }}>
    {open && shownStatus && <>
      <button className="daily-arrival__close game-popup__close" aria-label={receipt ? 'Close check-in' : 'Check in later'} disabled={busy} onClick={close}>×</button>
      <div className="daily-arrival__art" aria-hidden="true"><img src={getAssetUrl('assets/buddy-growth/buddy-clipboard.webp')} alt="" width="720" height="960" decoding="async" /><div className="daily-arrival__note"><small>BUDDY’S STREET FILE</small><strong>DAILY<br />DROP.</strong><span className="reward-street-file__stamp">{receipt ? 'CHECKED IN' : `DAY ${shownStatus.streak}`}</span></div></div>
      <div className="daily-arrival__body reward-street-file__paper">
        <span className="daily-arrival__eyebrow game-popup__label">THE BLOCK LOOKS OUT FOR ITS OWN</span>
        <h2 id="daily-arrival-title" className="game-popup__title">{receipt ? 'You’re good.' : 'Back on the block.'}</h2>
        <div className="daily-arrival__loot reward-street-file__loot" role="status">
          {rewardItems.map(item => <div key={item.glyph}><GameGlyph name={item.glyph} /><strong>+{item.amount.toLocaleString()}</strong><span>{item.label}</span></div>)}
          {receipt && !receipt.rewards.length && <p>Already collected. Your rewards are saved.</p>}
        </div>
        {cardRewards.length > 0 && <ul className="daily-arrival__cards" aria-label="Card rewards">{cardRewards.map(reward => <li key={reward.key}>
          <img src={getCardImage(reward.cardId!)} alt="" width="48" height="60" />
          <span><strong>{reward.cardName ?? (reward.cardId === 'buddy' ? 'Buddy' : 'Free card')}</strong><small>{reward.isNewCard === false
            ? `Duplicate · +${reward.styleShards} ${reward.shardRarity === 'Epic' ? 'Super Rare' : reward.shardRarity ?? 'Universal'} Style Shards`
            : receipt ? `${reward.cardRarity === 'Epic' ? 'Super Rare' : reward.cardRarity === 'SuperCommon' ? 'Super Common' : reward.cardRarity ?? ''} card saved` : 'Ready with check-in'}</small></span>
        </li>)}</ul>}
        {!receipt && rewards.length > 1 && <p className="daily-arrival__bonus">Daily drop + earned bonuses</p>}
        {error && <p className="daily-arrival__error" role="alert">{error}</p>}
        <button className="daily-arrival__claim reward-street-file__action" disabled={busy} onClick={() => receipt ? close() : void claim()}>{busy ? 'Collecting…' : receipt ? 'Let’s play' : error ? 'Retry check-in' : 'Collect check-in'}<span aria-hidden="true">→</span></button>
        {!receipt && <button className="daily-arrival__later game-popup__secondary" disabled={busy} onClick={close}>Later · keep my reward</button>}
        <AccountCheckInCalendar streak={shownStatus.streak} claimedToday={shownStatus.claimedToday} />
        {shownStatus.monthly && <MonthlyLoginTrack status={shownStatus.monthly} />}
      </div>
    </>}
  </dialog>;
}
