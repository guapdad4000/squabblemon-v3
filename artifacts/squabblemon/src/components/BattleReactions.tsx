import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { MessageCircle, X } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { REACTIONS, REACTION_PACKS, REACTION_COOLDOWN_MS, REACTION_DURATION_MS, type ReactionId, type ReactionView } from '@workspace/squabblemon-engine/reactions';
import { otherSeat, type OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { request, onlineErrorMessage } from '../lib/multiplayer';
import { ReactionArt } from './ReactionArt';
import '../styles/battle-reactions.css';

export function BattleReactions({ room, connected, reducedMotion }: { room: OnlineRoomView; connected: boolean; reducedMotion: boolean }) {
  const [collection, setCollection] = useState('starters');
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('squabblemon:mute-reactions') === 'true'; } catch { return false; } });
  const [now, setNow] = useState(Date.now);
  const trigger = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const systemReducedMotion = useReducedMotion();
  const client = useQueryClient();
  const key = ['battle-reactions', room.code, room.seat, room.gameNumber];
  const enabled = connected && room.status === 'active';
  const newer = (incoming: ReactionView) => {
    const current = client.getQueryData<ReactionView>(key);
    return current && (current.revision > incoming.revision || (current.revision === incoming.revision && current.serverTime > incoming.serverTime)) ? current : incoming;
  };
  const query = useQuery({ queryKey: key, enabled, queryFn: async ({ signal }) => newer(await request<ReactionView>(`/${room.code}/reactions`, undefined, signal)), refetchInterval: enabled ? 1000 : false, retry: false });
  const mutation = useMutation({
    mutationFn: (reactionId: ReactionId) => request<ReactionView>(`/${room.code}/reactions`, { requestId: crypto.randomUUID(), reactionId, gameNumber: room.gameNumber }),
    onSuccess: data => { client.setQueryData(key, newer(data)); setOpen(false); trigger.current?.focus(); },
  });
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!open) return;
    picker.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !picker.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', dismiss); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', dismiss); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  const serverNow = now + (query.data ? query.data.serverTime - query.dataUpdatedAt : room.serverTime - now);
  const own = query.data?.latest[room.seat];
  const wait = Math.max(0, Math.ceil(((own?.sentAt ?? 0) + REACTION_COOLDOWN_MS - serverNow) / 1000));
  const owned = query.data?.owned ?? [];
  const still = reducedMotion || !!systemReducedMotion;
  if (room.status !== 'active') return null;
  return <>
    <div className="pvp-reaction-controls">
      <button ref={trigger} type="button" className="pvp-reaction-trigger" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="pvp-reaction-picker" aria-label="Choose a reaction"><MessageCircle size={22} /><span>React</span></button>
      {open && <div ref={picker} className="pvp-reaction-picker" id="pvp-reaction-picker" role="region" aria-label="Your reaction collection">
        <header><div><small>BLOCK TALK</small><h3>Your reactions</h3></div><button type="button" aria-label="Close reactions" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button></header>
        <label className="pvp-reaction-collection">Collection<select value={collection} onChange={event => setCollection(event.target.value)}><option value="starters">Starter reactions</option>{REACTION_PACKS.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label>
        <div className="pvp-reaction-grid">{REACTIONS.filter(reaction => collection === 'starters' ? reaction.starter : reaction.packId === collection).map(reaction => <button type="button" key={reaction.id} disabled={!enabled || mutation.isPending || !owned.includes(reaction.id) || wait > 0} onClick={() => mutation.mutate(reaction.id)} aria-label={`Send ${reaction.name}`}><ReactionArt id={reaction.id} still={still} /><strong>{reaction.name}</strong><small>{owned.includes(reaction.id) ? 'Owned' : 'Shop unlock'}</small></button>)}</div>
        <p role="status">{!connected ? 'Reconnect to send reactions.' : mutation.isPending ? 'Sending…' : wait ? `Next reaction in ${wait}s` : 'One reaction every 4 seconds.'}</p>
        {(query.error || mutation.error) && <p role="alert">{onlineErrorMessage(mutation.error ?? query.error)}</p>}
        <label><input type="checkbox" checked={muted} onChange={e => { setMuted(e.target.checked); try { localStorage.setItem('squabblemon:mute-reactions', String(e.target.checked)); } catch { /* Session-only preference. */ } }} /> Hide opponent reactions</label>
        <Link href="/game/shop?view=reactions" target="_blank" rel="noopener noreferrer">Browse reaction shop ↗</Link>
      </div>}
    </div>
    {Object.values(query.data?.latest ?? {}).filter(event => event.gameNumber === room.gameNumber && serverNow >= event.sentAt && serverNow - event.sentAt < REACTION_DURATION_MS && !(muted && event.seat !== room.seat)).map(event => <div key={event.id} className={`pvp-reaction-bubble pvp-reaction-bubble--${event.seat === room.seat ? 'you' : 'rival'}`} role="status"><small>{event.seat === room.seat ? 'You' : room.members[otherSeat(room.seat)]?.name}</small><ReactionArt id={event.reactionId} still={still} /></div>)}
  </>;
}
