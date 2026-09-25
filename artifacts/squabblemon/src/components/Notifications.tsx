import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Bell } from 'lucide-react';
import { useSafehouseMail } from './SafehouseMail';
import { GameGlyph } from './venue/GameGlyph';
import { cardCatalog } from '../data';
import { CHARACTER_STYLE_SETS } from '@workspace/squabblemon-engine/cosmetics';
import { CORNER_OFFERS } from '../lib/cornerStore';
import '../styles/notifications.css';

type Section = 'cards' | 'style' | 'bag' | 'mail' | 'missions' | 'challenges' | 'shop' | 'growth';
type Notice = { id: string; section: Section; title: string; href: string; sticky?: boolean };
type Daily = { date: string; available: boolean; amount: number; attemptsRemaining: number; resetsAt: string };
const Context = createContext({ notices: [] as Notice[], seen: (_id: string) => {}, has: (_section: string): boolean => false });
export const useNotifications = () => useContext(Context);
export function useDailyClout(playerId: string) {
  return useQuery({ queryKey: ['daily-clout', playerId], queryFn: () => customFetch<Daily>('/api/player/shop/daily-clout'), refetchInterval: 60000, refetchOnWindowFocus: true, retry: 1 });
}
export function NotificationProvider({ bootstrap, children }: { bootstrap: PlayerBootstrap; children: ReactNode }) {
  const [location] = useLocation();
  const p = bootstrap.profile, key = `squabblemon:seen:v1:${p.id}`;
  const bagKey = `squabblemon:bag-notices:v1:${p.id}`;
  const balances = { clout: p.softCurrency, tickets: p.packTickets, shards: p.styleShards };
  const [bag, setBag] = useState<{ balances: typeof balances; events: Notice[] }>(() => {
    try { const saved = JSON.parse(localStorage.getItem(bagKey) ?? 'null'); if (saved?.balances && Array.isArray(saved.events)) return saved; } catch {}
    return { balances, events: p.packTickets > 0 ? [{ id: 'bag:initial-tickets', section: 'bag', title: `${p.packTickets} tickets in your bag`, href: '/game/inventory' }] : [] };
  });
  useEffect(() => {
    const gains = Object.entries(balances).filter(([kind, value]) => value > (bag.balances[kind as keyof typeof balances] ?? value));
    if (Object.entries(balances).every(([kind, value]) => value === bag.balances[kind as keyof typeof balances])) return;
    const events: Notice[] = gains.map(([kind, value]) => ({ id: `bag:${kind}:${Date.now()}`, section: 'bag', title: `+${value - bag.balances[kind as keyof typeof balances]} ${kind === 'shards' ? 'Style Shards' : kind === 'clout' ? 'Clout' : 'tickets'} added to your bag`, href: '/game/inventory' }));
    const next = { balances, events: [...bag.events, ...events].slice(-30) };
    setBag(next); try { localStorage.setItem(bagKey, JSON.stringify(next)); } catch {}
  }, [p.softCurrency, p.packTickets, p.styleShards]);
  const [read, setRead] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(x => typeof x === 'string') : []; } catch { return []; } });
  const mail = useSafehouseMail(p.id), daily = useDailyClout(p.id), client = useQueryClient();
  const account = useQuery({ queryKey: ['account-rewards', p.id], queryFn: () => customFetch<{ pending: { key: string; title: string }[]; growth: { ready: boolean } }>('/api/player/rewards/account'), refetchInterval: 30000, retry: 1 });
  const mythic = useQuery({ queryKey: ['starter-mythic', p.id], queryFn: () => customFetch<{ state: string }>('/api/player/rewards/starter-mythic'), refetchInterval: 60000, retry: 1 });
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() }); }, 60000); return () => clearInterval(timer); }, [client]);
  const seen = (id: string) => setRead(old => { const next = [...new Set([...old, id])].slice(-5000); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* In-memory acknowledgement remains available. */ } return next; });
  useEffect(() => { const sync = (e: StorageEvent) => { if (e.key === key) { try { const value = JSON.parse(e.newValue ?? '[]'); if (Array.isArray(value)) setRead(value.filter(x => typeof x === 'string')); } catch {} } }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, [key]);
  const notices: Notice[] = [];
  for (const id of p.ownedCardIds) notices.push({ id: `card:${id}`, section: 'cards', title: `New card · ${cardCatalog.find(c => c.catalogId === id)?.name ?? id}`, href: '/game/collection' });
  for (const set of Object.values(CHARACTER_STYLE_SETS)) if (p.ownedCardIds.includes(set.cardId)) notices.push({ id: `banner:${set.cardId}`, section: 'style', title: `New banner · ${cardCatalog.find(c => c.catalogId === set.cardId)?.name ?? set.cardId}`, href: `/game/style/${set.cardId}` });
  for (const id of [...p.unlockedCosmeticIds, ...p.ownedVariants]) notices.push({ id: `style:${id}`, section: 'style', title: `New style · ${id.replaceAll('-', ' ')}`, href: id.startsWith('style:') ? '/game/style/' + id.split(':')[1] : '/game/settings' });
  for (const reward of account.data?.pending ?? []) notices.push({ id: `reward:${reward.key}`, section: 'growth', title: reward.title, href: '/game?notice=growth', sticky: true });
  if (account.data?.growth?.ready) notices.push({ id: 'growth:water', section: 'growth', title: 'Your garden is ready to grow', href: '/game?notice=growth', sticky: true });
  if (mythic.data?.state === 'ready') notices.push({ id: 'mythic:ready', section: 'missions', title: 'Nothing to Lose · claim your Mythical', href: '/game/missions', sticky: true });
  for (const m of bootstrap.missions) if (m.status !== 'claimed') notices.push({ id: `mission:${m.id}:${m.resetAt ?? 'permanent'}`, section: 'missions', title: `${m.status === 'claimable' ? 'Reward ready' : 'Bounty available'} · ${m.title}`, href: '/game/missions', sticky: m.status === 'claimable' });
  for (const m of mail.data?.messages ?? []) if (!m.readAt || (!m.claimedAt && Object.values(m.gift).some(n => n > 0))) notices.push({ id: `mail:${m.id}`, section: 'mail', title: m.title, href: '/game?notice=mail', sticky: true });
  if (daily.data?.available) notices.push({ id: `daily:${daily.data.date}`, section: 'shop', title: 'Your free 50 Clout is ready', href: '/game/shop?view=corner', sticky: true });
  if (daily.data && daily.data.attemptsRemaining > 0) notices.push({ id: `attempts:${daily.data.date}`, section: 'challenges', title: `Straight to the Back · ${daily.data.attemptsRemaining} attempts available`, href: '/game/challenges' });
  for (const offer of CORNER_OFFERS) notices.push({ id: `offer:${offer.id}`, section: 'shop', title: `In the store · ${offer.name}`, href: '/game/shop?view=corner' });
  notices.push(...bag.events);
  const routeSection = location.startsWith('/game/inventory') ? 'bag' : location.startsWith('/game/missions') ? 'missions' : location.startsWith('/game/challenges') ? 'challenges' : null;
  const visitIds = notices.filter(n => n.section === routeSection && !n.sticky && !read.includes(n.id)).map(n => n.id).join('|');
  useEffect(() => { if (visitIds) visitIds.split('|').forEach(seen); }, [visitIds]);
  const visible = notices.filter(n => n.sticky || !read.includes(n.id));
  const has = (section: string) => visible.some(n => n.section === section || (section === 'safehouse' && ['mail','missions','challenges','bag','growth'].includes(n.section)) || (section === 'cards' && n.section === 'style'));
  return <Context.Provider value={{ notices: visible, seen, has }}>{children}</Context.Provider>;
}
export function Attention({ section, micro = false }: { section: string; micro?: boolean }) {
  const { has } = useNotifications();
  return has(section) ? <span className={`attention-mark ${micro ? 'attention-mark--dot' : ''}`} role="img" aria-label="New activity">{micro ? '' : '!'}</span> : null;
}
export function NotificationInbox() {
  const { notices, seen } = useNotifications(), dialog = useRef<HTMLDialogElement>(null);
  const [, navigate] = useLocation();
  return <><button className="notification-bell" aria-label={`Notifications, ${notices.length} updates`} onClick={() => dialog.current?.showModal()}><Bell size={18}/>{notices.length > 0 && <span className="attention-mark attention-mark--dot" />}</button>
    <dialog className="notification-inbox" aria-label="On your radar" ref={dialog}><header><h2>On your radar</h2><button aria-label="Close notifications" onClick={() => dialog.current?.close()}>×</button></header><p>New finds, fresh attempts, and rewards waiting on you.</p>
      {notices.length === 0 && <p>You’re all caught up.</p>}
      {notices.map(n => <button className="notification-item" key={n.id} onClick={() => { seen(n.id); dialog.current?.close(); navigate(n.href.includes('?notice=') ? `${n.href}&opened=${Date.now()}` : n.href); }}><span className="attention-mark attention-mark--dot"/><span><small>{n.section}</small>{n.title}</span><span>›</span></button>)}
      {notices.some(n => !n.sticky) && <button className="notification-clear" onClick={() => notices.filter(n => !n.sticky).forEach(n => seen(n.id))}>Mark new items as seen</button>}
    </dialog></>;
}
export function DailyCloutPack({ playerId }: { playerId: string }) {
  const query = useDailyClout(playerId), client = useQueryClient();
  const claim = useMutation({ mutationFn: () => customFetch<{ claimed: boolean; status: Daily }>('/api/player/shop/daily-clout/claim', { method: 'POST' }), onSuccess: result => { client.setQueryData(['daily-clout', playerId], result.status); void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() }); } });
  return <section className="daily-clout-pack"><GameGlyph name="cloutStack"/><div><strong>Daily pocket change</strong><span>50 Clout. On the house.</span><small>{query.data ? `Resets ${new Date(query.data.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · daily` : 'Checking your daily pack…'}</small></div><button disabled={!query.data?.available || claim.isPending} onClick={() => claim.mutate()}>{claim.isPending ? 'Claiming…' : query.data?.available ? 'Claim free' : query.data ? 'Claimed' : 'Unavailable'}{query.data?.available && <span className="attention-mark">!</span>}</button>{(claim.isError || query.isError) && <p role="alert">Couldn’t load or confirm your pack. <button onClick={() => void query.refetch()}>Retry</button></p>}</section>;
}

export function ItemDot({ id }: { id: string }) {
  const { notices } = useNotifications();
  return notices.some(n => n.id === id) ? <span className="attention-mark attention-mark--dot" role="img" aria-label="New item" /> : null;
}
