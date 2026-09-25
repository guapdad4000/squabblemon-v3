import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { ArrowUpRight, Bell, Check, X } from 'lucide-react';
import { useSafehouseMail } from './SafehouseMail';
import { getAssetUrl } from '../lib/assets';
import { cardCatalog } from '../data';
import { CHARACTER_STYLE_SETS } from '@workspace/squabblemon-engine/cosmetics';
import { CORNER_OFFERS } from '../lib/cornerStore';
import '../styles/notifications.css';
import { NotificationArrival } from './NotificationArrival';

type Section = 'cards' | 'style' | 'bag' | 'mail' | 'missions' | 'challenges' | 'shop' | 'growth' | 'story';
type Notice = { id: string; section: Section; title: string; href: string; sticky?: boolean; dismissalKey?: string };
type Daily = { date: string; available: boolean; amount: number; attemptsRemaining: number; resetsAt: string };
type NoticeIds = string | readonly string[];
const Context = createContext({ notices: [] as Notice[], seen: (_ids: NoticeIds) => {}, dismiss: (_ids: NoticeIds) => {}, has: (_section: string): boolean => false });
function readReceipts(key: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
}
export const useNotifications = () => useContext(Context);
export function useDailyClout(playerId: string) {
  return useQuery({ queryKey: ['daily-clout', playerId], queryFn: () => customFetch<Daily>('/api/player/shop/daily-clout'), refetchInterval: 60000, refetchOnWindowFocus: true, retry: 1 });
}
export function NotificationProvider({ bootstrap, children }: { bootstrap: PlayerBootstrap; children: ReactNode }) {
  return <PlayerNotifications key={bootstrap.profile.id} bootstrap={bootstrap}>{children}</PlayerNotifications>;
}
function PlayerNotifications({ bootstrap, children }: { bootstrap: PlayerBootstrap; children: ReactNode }) {
  const p = bootstrap.profile, key = `squabblemon:seen:v1:${p.id}`;
  const bagKey = `squabblemon:bag-notices:v1:${p.id}`;
  const balances = { clout: p.softCurrency, tickets: p.packTickets, shards: p.styleShards };
  const [bag, setBag] = useState<{ balances: typeof balances; events: Notice[] }>(() => {
    try { const saved = JSON.parse(localStorage.getItem(bagKey) ?? 'null'); if (saved?.balances && Array.isArray(saved.events)) return saved; } catch {}
    return { balances, events: p.packTickets > 0 ? [{ id: 'bag:initial-tickets', section: 'bag', title: `${p.packTickets} tickets in your bag`, href: '/game/inventory' }] : [] };
  });
  useEffect(() => {
    const gains = Object.entries(balances).filter(([kind, value]) => value > (bag.balances[kind as keyof typeof balances] ?? value));
    if (Object.entries(balances).every(([kind, value]) => value === bag.balances[kind as keyof typeof balances])) {
      try { localStorage.setItem(bagKey, JSON.stringify(bag)); } catch {}
      return;
    }
    const events: Notice[] = gains.map(([kind, value]) => ({ id: `bag:${kind}:${crypto.randomUUID()}`, section: 'bag', title: `+${value - bag.balances[kind as keyof typeof balances]} ${kind === 'shards' ? 'Style Shards' : kind === 'clout' ? 'Clout' : 'tickets'} added to your bag`, href: '/game/inventory' }));
    const next = { balances, events: [...bag.events, ...events].slice(-30) };
    setBag(next); try { localStorage.setItem(bagKey, JSON.stringify(next)); } catch {}
  }, [p.softCurrency, p.packTickets, p.styleShards]);
  const [read, setRead] = useState(() => readReceipts(key));
  const receipts = useRef(read);
  const mail = useSafehouseMail(p.id), daily = useDailyClout(p.id), client = useQueryClient();
  const account = useQuery({ queryKey: ['account-rewards', p.id], queryFn: () => customFetch<{ date: string; pending: { key: string; title: string }[]; growth: { ready: boolean } }>('/api/player/rewards/account'), refetchInterval: 30000, retry: 1 });
  const mythic = useQuery({ queryKey: ['starter-mythic', p.id], queryFn: () => customFetch<{ state: string }>('/api/player/rewards/starter-mythic'), refetchInterval: 60000, retry: 1 });
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() }); }, 60000); return () => clearInterval(timer); }, [client]);
  const seen = useCallback((ids: NoticeIds) => {
    const stored = readReceipts(key);
    const next = [...new Set([...stored, ...receipts.current, ...(typeof ids === 'string' ? [ids] : ids)])];
    // Repair a stale cross-tab write even when this tab already knows every receipt.
    if (stored.length !== next.length || next.some(id => !stored.includes(id))) {
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    }
    if (next.length === receipts.current.length && next.every(id => receipts.current.includes(id))) return;
    receipts.current = next;
    setRead(next);
  }, [key]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      try { const value: unknown = JSON.parse(event.newValue); if (Array.isArray(value)) seen(value.filter((id): id is string => typeof id === 'string')); } catch {}
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key, seen]);
  const notices: Notice[] = [];
  for (const id of p.ownedCardIds) notices.push({ id: `card:${id}`, section: 'cards', title: `New card · ${cardCatalog.find(c => c.catalogId === id)?.name ?? id}`, href: `/game/collection?card=${encodeURIComponent(id)}` });
  for (const set of Object.values(CHARACTER_STYLE_SETS)) if (p.ownedCardIds.includes(set.cardId)) notices.push({ id: `banner:${set.cardId}`, section: 'style', title: `New banner · ${cardCatalog.find(c => c.catalogId === set.cardId)?.name ?? set.cardId}`, href: `/game/style/${set.cardId}?tab=banner` });
  for (const id of p.unlockedCosmeticIds) {
    const [kind, cardId, cosmetic] = id.split(':');
    const name = cardCatalog.find(card => card.catalogId === cardId)?.name ?? cardId;
    const label = id.replaceAll(/[-:]/g, ' ');
    const notice: Notice = { id: `style:${id}`, section: 'style', title: `New unlock · ${label}`, href: '/game/style' };
    if (kind === 'style' && Object.hasOwn(CHARACTER_STYLE_SETS, cardId) && ['stickers', 'backdrop', 'banner-finish'].includes(cosmetic)) {
      const tab = cosmetic === 'stickers' ? 'stickers' : cosmetic === 'backdrop' ? 'scene' : 'banner';
      const item = cosmetic === 'stickers' ? 'Sticker pack' : cosmetic === 'backdrop' ? 'Card scene' : 'Silver Lining';
      notice.title = `New style · ${name} · ${item}`;
      notice.href = `/game/style/${encodeURIComponent(cardId)}?tab=${tab}${cosmetic === 'banner-finish' ? '&finish=silver' : ''}`;
    } else if ((kind === 'mastery' || kind === 'badge') && cardId) {
      const badges: Record<string, string> = { 'after-hours': 'After-hours champion', 'street-draft': 'Street draft winner', neighborhood: 'Neighborhood champion' };
      notice.section = 'missions';
      notice.title = kind === 'mastery' ? `Mastery earned · ${name}` : `Badge earned · ${badges[cardId] ?? cardId.replaceAll('-', ' ')}`;
      notice.href = '/game/missions?view=mastery';
    } else if ((kind === 'story-key' && cardId) || ['side-alley-tagged-cardback', 'block-party-crowned'].includes(id)) {
      notice.section = 'story';
      notice.title = kind === 'story-key' ? `Chapter unlocked · ${cardId.replaceAll('-', ' ')}` : `Story reward · ${label}`;
      notice.href = '/game/story' + (kind === 'story-key' ? '' : `?node=${id === 'block-party-crowned' ? 'block-crowned' : 'side-alley-challenge'}`);
    }
    notices.push(notice);
  }
  for (const id of p.ownedVariants) {
    const card = cardCatalog.find(c => c.variantSlots.some(v => v.id === id));
    if (card) notices.push({ id: `style:${id}`, section: 'style', title: `New finish · ${card.name} · ${card.variantSlots.find(v => v.id === id)?.name}`, href: `/game/collection?card=${encodeURIComponent(card.catalogId)}&variant=${encodeURIComponent(id)}` });
  }
  for (const reward of account.data?.pending ?? []) notices.push({ id: `reward:${reward.key}`, section: 'growth', title: reward.title, href: '/game?notice=growth', sticky: true });
  if (account.data?.growth?.ready) notices.push({ id: 'growth:water', dismissalKey: `growth:water:${account.data.date}`, section: 'growth', title: 'Your garden is ready to grow', href: '/game?notice=growth', sticky: true });
  if (mythic.data?.state === 'ready') notices.push({ id: 'mythic:ready', section: 'missions', title: 'Nothing to Lose · claim your Mythical', href: '/game/missions?mythic=open', sticky: true });
  for (const m of bootstrap.missions) if (m.status !== 'claimed') notices.push({ id: `mission:${m.id}:${m.resetAt ?? 'permanent'}`, dismissalKey: `mission:${m.id}:${m.resetAt ?? 'permanent'}:${m.status}`, section: 'missions', title: `${m.status === 'claimable' ? 'Reward ready' : 'Bounty available'} · ${m.title}`, href: `/game/missions?mission=${encodeURIComponent(m.id)}`, sticky: m.status === 'claimable' });
  for (const m of mail.data?.messages ?? []) if (!m.readAt || (!m.claimedAt && Object.values(m.gift).some(n => n > 0))) notices.push({ id: `mail:${m.id}`, section: 'mail', title: m.title, href: `/game?notice=mail&letter=${encodeURIComponent(m.id)}`, sticky: true });
  if (daily.data?.available) notices.push({ id: `daily:${daily.data.date}`, section: 'shop', title: 'Your free 50 Clout is ready', href: '/game/shop?view=corner', sticky: true });
  if (daily.data && daily.data.attemptsRemaining > 0) notices.push({ id: `attempts:${daily.data.date}`, section: 'challenges', title: `Straight to the Back · ${daily.data.attemptsRemaining} attempts available`, href: '/game/challenges?machine=road' });
  for (const offer of CORNER_OFFERS) notices.push({ id: `offer:${offer.id}`, section: 'shop', title: `In the store · ${offer.name}`, href: `/game/shop?view=corner&offer=${encodeURIComponent(offer.id)}` });
  notices.push(...bag.events);
  const unique = [...new Map(notices.map(notice => [notice.id, notice])).values()];
  const visible = unique.filter(n => !read.includes(`dismissed:${n.dismissalKey ?? n.id}`) && (n.sticky || !read.includes(n.id)));
  const dismiss = (ids: NoticeIds) => {
    const selected = new Set(typeof ids === 'string' ? [ids] : ids);
    seen(unique.filter(n => selected.has(n.id)).flatMap(n => n.sticky
      ? [`dismissed:${n.dismissalKey ?? n.id}`]
      : [n.id, `dismissed:${n.dismissalKey ?? n.id}`]));
  };
  const has = (section: string) => visible.some(n => n.section === section || (section === 'safehouse' && ['mail','missions','challenges','bag','growth'].includes(n.section)) || (section === 'cards' && n.section === 'style'));
  return <Context.Provider value={{ notices: visible, seen, dismiss, has }}>{children}<NotificationArrival /></Context.Provider>;
}
export function Attention({ section, micro = false }: { section: string; micro?: boolean }) {
  const { has } = useNotifications();
  return has(section) ? <span className={`attention-mark ${micro ? 'attention-mark--dot' : ''}`} role="img" aria-label="New activity">{micro ? '' : '!'}</span> : null;
}
export function NotificationInbox() {
  const { notices, seen, dismiss } = useNotifications();
  const dialog = useRef<HTMLDialogElement>(null), clearButton = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const [, navigate] = useLocation();
  const clear = (ids: NoticeIds) => {
    dismiss(ids);
    // Keep keyboard focus in the dialog when the focused row disappears.
    clearButton.current?.focus({ preventScroll: true });
  };
  return <><button className="notification-bell" aria-label={`Notifications, ${notices.length} updates`} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><Bell size={18}/>{notices.length > 0 && <span className="attention-mark attention-mark--dot" />}</button>
    <dialog className="notification-inbox" aria-label="On your radar" aria-describedby={descriptionId} ref={dialog}>
      <div className="notification-inbox__top">
        <header><h2>On your radar</h2><button aria-label="Close notifications" onClick={() => dialog.current?.close()}><X size={22}/></button></header>
        <p id={descriptionId}>Clear alerts here. Your rewards stay available.</p>
        <div className="notification-inbox__actions"><span role="status">{notices.length ? `${notices.length} alerts` : 'You’re all caught up.'}</span><button ref={clearButton} className="notification-clear" aria-disabled={!notices.length} onClick={() => clear(notices.map(n => n.id))}>Clear all</button></div>
      </div>
      <div className="notification-inbox__list">
        {notices.map(n => <div className="notification-row" key={n.id} data-notice-id={n.id}>
          <button className="notification-item" onClick={() => {
            // Following an alert counts as reading it. Cards keep their inspection
            // highlight until the player has actually viewed and left the card.
            if (!n.sticky && n.section !== 'cards') seen(n.id);
            dialog.current?.close();
            const url = new URL(n.href, window.location.origin);
            url.searchParams.set('notification', n.id);
            url.searchParams.set('opened', crypto.randomUUID());
            navigate(url.pathname + url.search + url.hash);
          }}><span className="attention-mark attention-mark--dot"/><span><small>{n.section}</small>{n.title}</span><span aria-hidden="true">›</span></button>
          <button className="notification-dismiss" aria-label={`Dismiss ${n.title}`} title="Dismiss alert" onClick={() => clear(n.id)}><X size={16}/></button>
        </div>)}
      </div>
    </dialog></>;
}
export function DailyCloutPack({ playerId, onClaimed }: { playerId: string; onClaimed?: (reward: { amount: number; date: string }) => void }) {
  const query = useDailyClout(playerId), client = useQueryClient();
  const claim = useMutation({
    mutationFn: () => customFetch<{ claimed: boolean; amount: number; status: Daily }>('/api/player/shop/daily-clout/claim', { method: 'POST' }),
    onSuccess: result => {
      client.setQueryData(['daily-clout', playerId], result.status);
      void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      if (result.claimed) onClaimed?.({ amount: result.amount, date: result.status.date });
    },
  });
  const claimed = query.data?.available === false;
  const claimLabel = claim.isPending ? 'Claiming…' : query.data?.available ? 'Claim free' : claimed ? 'Claimed' : 'Unavailable';
  const resetsAt = query.data?.resetsAt ? new Date(query.data.resetsAt) : null;
  const resetLabel = resetsAt && !Number.isNaN(resetsAt.getTime())
    ? `Resets ${resetsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · daily`
    : query.isError ? 'Daily pack unavailable' : 'Checking your daily pack…';
  return <article className="corner-product corner-product--daily" data-testid="daily-clout-pack" aria-label="Daily free pack" data-notification-id={query.data?.date ? `daily:${query.data.date}` : undefined}>
    <div className="corner-product__display">
      <span className="bodega-led" aria-hidden="true" /><span className="bodega-light-cone" aria-hidden="true" />
      <span className="bodega-cubby-back" aria-hidden="true" />
      <img src={getAssetUrl('assets/rewards/clout-token.webp')} alt="" />
      <span className="market-daily__seal">On the house<small>EVERY DAY</small></span>
      <span className="bodega-shelf-number" aria-hidden="true">DAILY</span>
    </div>
    <div className="corner-product__label">
      <span className="market-paper-watermark" aria-hidden="true"><img src={getAssetUrl('assets/market/fade-market-ascii-logo.svg')} alt="" draggable={false} /></span>
      <div className="market-tag__header"><span>FADE MARKET</span><span>DAILY / FREE</span></div>
      <span className="market-tag__category">A LITTLE SOMETHING FOR YOU</span>
      <h2>Daily free pack{query.data?.available && <span className="attention-mark attention-mark--dot" role="img" aria-label="Ready to claim" />}</h2>
      <p>{query.data?.amount ?? 50} Clout. On the house.</p>
      <small className="market-daily__reset">{resetLabel}</small>
      <button className="market-tag__buy market-tag__claim" aria-label={claimLabel} disabled={!query.data?.available || claim.isPending} onClick={() => claim.mutate()}>
        <span className="market-tag__price"><strong className="market-tag__free-price" aria-hidden="true">FREE</strong><small>ONE PER DAY</small></span>
        <span className="market-tag__action" aria-hidden="true">{claimLabel}{claimed ? <Check size={18} /> : <ArrowUpRight size={18} />}</span>
      </button>
      {(claim.isError || query.isError) && <p className="market-daily__error" role="alert">Couldn’t load or confirm your pack. <button onClick={() => void query.refetch()}>Retry</button></p>}
      <div className="market-tag__footer"><span className="market-print-bars" aria-hidden="true" /><span>DAILY-CLOUT</span></div>
    </div>
  </article>;
}

export function ItemDot({ id }: { id: string }) {
  const { notices } = useNotifications();
  return notices.some(n => n.id === id) ? <span className="attention-mark attention-mark--dot" role="img" aria-label="New item" /> : null;
}
