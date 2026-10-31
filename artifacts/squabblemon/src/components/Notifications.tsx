import { dojoReminderNotice } from '../lib/dojoReminder';
import { lazy, Suspense } from 'react';
const SocialRequestPopups = lazy(() => import('./SocialRequestPopups').then(module => ({ default: module.SocialRequestPopups })));
const SOCIAL_POPUP_EVENT = 'squabblemon:open-social-request';
import { useOptionalSocial } from '../lib/social';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { ArrowUpRight, Bell, Check, X } from 'lucide-react';
import { useDailyClout, useNotificationBackground, type Daily } from '../lib/notificationBackground';
export { useDailyClout } from '../lib/notificationBackground';
import { getAssetUrl } from '../lib/assets';
import { useCollectionNotices } from '../lib/useCollectionNotices';
import { CORNER_OFFERS } from '../lib/cornerStore';
import '../styles/notifications.css';
import { NotificationArrival } from './NotificationArrival';
import { getWorldSurface, storyOverviewReceiptAllowed, subscribeWorldSurface } from '../lib/worldSurface';
import { GamePopupTitle, GamePopupCopy, GamePopupClose, GamePopupSecondary } from './ui/game-popup';

type Section = 'cards' | 'style' | 'bag' | 'mail' | 'missions' | 'challenges' | 'shop' | 'growth' | 'story' | 'profile' | 'friends' | 'friendly fade';
export type BagResource = 'clout' | 'tickets' | 'shards';
type Notice = { id: string; section: Section; title: string; href: string; sticky?: boolean; dismissalKey?: string; bagReward?: { kind: BagResource; amount: number } };
type ReceiptResponse = { ids: string[] };
type NoticeIds = string | readonly string[];
const Context = createContext({ notices: [] as Notice[], seen: (_ids: NoticeIds) => {}, dismiss: (_ids: NoticeIds) => {}, has: (_section: string): boolean => false });
function readReceipts(key: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
}
function receiptIds(value: unknown): string[] {
  if (!value || typeof value !== 'object' || !('ids' in value) || !Array.isArray(value.ids)) return [];
  return value.ids.filter((id): id is string => typeof id === 'string');
}
export const useNotifications = () => useContext(Context);
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
    const events: Notice[] = gains.map(([kind, value]) => ({ id: `bag:${kind}:${crypto.randomUUID()}`, section: 'bag', title: `+${value - bag.balances[kind as keyof typeof balances]} ${kind === 'shards' ? 'Style Shards' : kind === 'clout' ? 'Clout' : 'tickets'} added to your bag`, href: '/game/inventory', bagReward: { kind: kind as BagResource, amount: value - bag.balances[kind as BagResource] } }));
    const next = { balances, events: [...bag.events, ...events].slice(-30) };
    setBag(next); try { localStorage.setItem(bagKey, JSON.stringify(next)); } catch {}
  }, [p.softCurrency, p.packTickets, p.styleShards]);
  const [read, setRead] = useState(() => readReceipts(key));
  const receipts = useRef(read);
  const { mail, daily, account, johnHenry, mythic, dojo } = useNotificationBackground(p.id);
  const client = useQueryClient();
  const remoteReceipts = useQuery({
    queryKey: ['notification-receipts', p.id],
    queryFn: async () => ({ ids: receiptIds(await customFetch<unknown>('/api/player/notifications/receipts')) }),
    staleTime: 30000,
    retry: 2,
  });
  const applyReceipts = useCallback((ids: NoticeIds) => {
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
  const seen = useCallback((ids: NoticeIds) => {
    const batch = [...new Set(typeof ids === 'string' ? [ids] : ids)];
    if (!batch.length) return;
    applyReceipts(batch);
    client.setQueryData<ReceiptResponse>(['notification-receipts', p.id], current => ({
      ids: [...new Set([...(current?.ids ?? []), ...batch])],
    }));
    void customFetch<ReceiptResponse>('/api/player/notifications/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: batch }),
    }).then(result => {
      const ids = receiptIds(result);
      // Older servers and browser fixtures may return a generic success body.
      // Keep the optimistic batch authoritative until the receipt API replies.
      const confirmed = ids.length ? ids : batch;
      applyReceipts(confirmed);
      client.setQueryData(['notification-receipts', p.id], { ids: confirmed });
    }).catch(() => {
      // Local optimistic receipts keep the bell usable while React Query retries
      // the authoritative ledger on the next signed-in visit.
      void client.invalidateQueries({ queryKey: ['notification-receipts', p.id] });
    });
  }, [applyReceipts, client, p.id]);
  useEffect(() => {
    if (remoteReceipts.data?.ids) applyReceipts(remoteReceipts.data.ids);
  }, [applyReceipts, remoteReceipts.data?.ids]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      try { const value: unknown = JSON.parse(event.newValue); if (Array.isArray(value)) applyReceipts(value.filter((id): id is string => typeof id === 'string')); } catch {}
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [applyReceipts, key]);
  const social = useOptionalSocial();
  const collection = useCollectionNotices(p);
  const notices: Notice[] = [];
  for (const request of social?.query.data?.incomingRequests ?? []) notices.push({ id: `friend:${request.id}`, section: 'friends', title: `${request.player.displayName} sent a friend request`, href: '/game/settings#homies', sticky: true });
  for (const invite of social?.query.data?.invitations ?? []) if (invite.direction === 'incoming' && invite.status === 'pending' && Date.parse(invite.expiresAt) > Date.now()) notices.push({ id: `fade:${invite.id}`, section: 'friendly fade', title: `${invite.player.displayName} wants a Friendly Fade`, href: `/game/online?tab=friends&invite=${encodeURIComponent(invite.id)}`, sticky: true });
  notices.push(...collection);
  const dojoNotice=dojoReminderNotice(dojo.data); if(dojoNotice)notices.push(dojoNotice);
  for (const reward of account.data?.pending ?? []) notices.push({ id: `reward:${reward.key}`, section: 'growth', title: reward.title, href: '/game?notice=growth', sticky: true });
  if (account.data?.growth?.ready) notices.push({ id: 'growth:water', dismissalKey: `growth:water:${account.data.date}`, section: 'growth', title: 'Your garden is ready to grow', href: '/game?notice=growth', sticky: true });
  if (johnHenry.data?.state === 'ready') notices.push({id:'mythic:john-henry',section:'missions',title:'Steel Driver · claim John Henry',href:'/game/missions?mythic=john-henry',sticky:true});
  if (mythic.data?.state === 'ready') notices.push({ id: 'mythic:ready', section: 'missions', title: 'Nothing to Lose · claim your Mythical', href: '/game/missions?mythic=open', sticky: true });
  for (const m of bootstrap.missions) if (m.status !== 'claimed') notices.push({ id: `mission:${m.id}:${m.resetAt ?? 'permanent'}`, dismissalKey: `mission:${m.id}:${m.resetAt ?? 'permanent'}:${m.status}`, section: 'missions', title: `${m.status === 'claimable' ? 'Reward ready' : 'Bounty available'} · ${m.title}`, href: `/game/missions?mission=${encodeURIComponent(m.id)}`, sticky: m.status === 'claimable' });
  for (const m of mail.data?.messages ?? []) if (!m.readAt || (!m.claimedAt && Object.values(m.gift).some(n => n > 0))) notices.push({ id: `mail:${m.id}`, section: 'mail', title: m.title, href: `/game?notice=mail&letter=${encodeURIComponent(m.id)}`, sticky: true });
  if (daily.data?.available) notices.push({ id: `daily:${daily.data.date}`, section: 'shop', title: 'Your free 50 Clout is ready', href: '/game/shop?view=corner', sticky: true });
  if (daily.data && daily.data.attemptsRemaining > 0) notices.push({ id: `attempts:${daily.data.date}`, section: 'challenges', title: `Straight to the Back · ${daily.data.attemptsRemaining} attempts available`, href: '/game/challenges?machine=road' });
  for (const offer of CORNER_OFFERS) notices.push({ id: `offer:${offer.id}`, section: 'shop', title: `In the store · ${offer.name}`, href: `/game/shop?view=corner&offer=${encodeURIComponent(offer.id)}` });
  notices.push(...bag.events);
  const unique = [...new Map(notices.map(notice => [notice.id, notice])).values()];
  const receiptReady = remoteReceipts.isSuccess || remoteReceipts.isError || read.length > 0;
  const visible = receiptReady
    ? unique.filter(n => !read.includes(`dismissed:${n.dismissalKey ?? n.id}`) && (n.sticky || !read.includes(n.id)))
    : [];
  const dismiss = (ids: NoticeIds) => {
    const selected = new Set(typeof ids === 'string' ? [ids] : ids);
    seen(unique.filter(n => selected.has(n.id)).flatMap(n => n.sticky
      ? [`dismissed:${n.dismissalKey ?? n.id}`]
      : [n.id, `dismissed:${n.dismissalKey ?? n.id}`]));
  };
  const has = (section: string) => visible.some(n => n.section === section || (section === 'safehouse' && ['mail','missions','challenges','bag','growth'].includes(n.section)) || (section === 'cards' && n.section === 'style'));
  return <Context.Provider value={{ notices: visible, seen, dismiss, has }}>{children}<NotificationArrival /><NotificationPageReceipt /><Suspense fallback={null}><SocialRequestPopups bootstrap={bootstrap} /></Suspense></Context.Provider>;
}

/** The actual Story overview and Fighter ID can acknowledge their visible content.
 * Roaming the world must not silently read unseen chapter notifications. */
function NotificationPageReceipt() {
  const { notices, seen } = useNotifications();
  const [location] = useLocation();
  const section: Section | null = location.startsWith('/game/story')
    ? 'story'
    : location === '/game/settings' ? 'profile' : null;
  const ids = notices.filter(notice => section === notice.section && !notice.sticky).map(notice => notice.id).join('\n');
  useEffect(() => {
    if (!ids) return;
    let timer: number | undefined;
    const ready = () => {
      if (document.visibilityState !== 'visible') return false;
      const storyContent = section === 'story'
        ? [...document.querySelectorAll<HTMLElement>('[data-story-content-active="true"]')].find(element => element.getClientRects().length > 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]'))
        : undefined;
      if (section === 'story' && !storyOverviewReceiptAllowed(getWorldSurface(), !!storyContent)) return false;
      // A chapter shown in a modal is real Story content. Other dialogs still
      // obscure the overview and defer its receipts until the player returns.
      return ![...document.querySelectorAll('dialog[open], [role="dialog"][data-state="open"], [role="dialog"][aria-modal="true"]')]
        .some(dialog => !storyContent || !dialog.contains(storyContent));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      if (!ready()) return;
      timer = window.setTimeout(() => { if (ready()) seen(ids.split('\n')); }, 700);
    };
    const dialogs = new MutationObserver(schedule);
    dialogs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'data-state', 'aria-modal', 'data-story-content-active', 'hidden', 'inert', 'aria-hidden'] });
    const unsubscribeWorld = subscribeWorldSurface(schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      window.clearTimeout(timer);
      dialogs.disconnect();
      unsubscribeWorld();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [ids, seen, section]);
  return null;
}
export function Attention({ section, micro = false }: { section: string; micro?: boolean }) {
  const { has } = useNotifications();
  return has(section) ? <span className={`attention-mark ${micro ? 'attention-mark--dot' : ''}`} role="img" aria-label="New activity">{micro ? '' : '!'}</span> : null;
}
export function NotificationInbox() {
  const { notices, seen, dismiss } = useNotifications();
  const dialog = useRef<HTMLDialogElement>(null), clearButton = useRef<HTMLButtonElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !dialog.current?.contains(event.target) && !bell.current?.contains(event.target)) { dialog.current?.close(); setIsOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { dialog.current?.close(); setIsOpen(false); bell.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [isOpen]);
  const descriptionId = useId();
  const [, navigate] = useLocation();
  const clear = (ids: NoticeIds) => {
    dismiss(ids);
    // Keep keyboard focus in the dialog when the focused row disappears.
    clearButton.current?.focus({ preventScroll: true });
  };
  return <><button ref={bell} className="notification-bell" aria-expanded={isOpen} aria-label={`Notifications, ${notices.length} updates`} aria-haspopup="dialog" onClick={() => { if (dialog.current?.open) { dialog.current.close(); setIsOpen(false); } else { dialog.current?.show(); setIsOpen(true); } }}><Bell size={18}/>{notices.length > 0 && <span className="attention-mark attention-mark--dot" />}</button>
    <dialog className="notification-inbox game-popup" data-popup-family="announcement" aria-label="On your radar" aria-describedby={descriptionId} ref={dialog} onClose={() => setIsOpen(false)}>
      <div className="notification-inbox__top">
        <header><GamePopupTitle>On your radar</GamePopupTitle><GamePopupClose aria-label="Close notifications" onClick={() => { dialog.current?.close(); bell.current?.focus(); }} /></header>
        <GamePopupCopy id={descriptionId}>Clear alerts here. Your rewards stay available.</GamePopupCopy>
        <div className="notification-inbox__actions"><span role="status">{notices.length ? `${notices.length} alerts` : 'You’re all caught up.'}</span><GamePopupSecondary ref={clearButton} className="notification-clear" aria-disabled={!notices.length} onClick={() => clear(notices.map(n => n.id))}>Clear all</GamePopupSecondary></div>
      </div>
      <div className="notification-inbox__list">
        {notices.map(n => <div className="notification-row" key={n.id} data-notice-id={n.id}>
          <button className="notification-item" onClick={() => {
            // Following an alert counts as reading it. Cards keep their inspection
            // highlight until the player has actually viewed and left the card.
            if (!n.sticky && n.section !== 'cards') seen(n.id);
            dialog.current?.close();
            if (n.section === 'friends' || n.section === 'friendly fade') { window.dispatchEvent(new CustomEvent(SOCIAL_POPUP_EVENT, { detail: n.id })); return; }
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
