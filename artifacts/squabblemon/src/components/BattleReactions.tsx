import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, X } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { REACTIONS, REACTION_TRAY_SIZE, REACTION_COOLDOWN_MS, REACTION_DURATION_MS, type ReactionId, type ReactionView } from '@workspace/squabblemon-engine/reactions';
import { otherSeat, type OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { request, onlineErrorMessage } from '../lib/multiplayer';
import { ReactionArt } from './ReactionArt';
import '../styles/battle-reactions.css';

export function BattleReactions({ room, connected, reducedMotion }: { room: OnlineRoomView; connected: boolean; reducedMotion: boolean }) {
  const [collection, setCollection] = useState(false);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('squabblemon:mute-reactions') === 'true'; } catch { return false; } });
  const [now, setNow] = useState(Date.now);
  const trigger = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const systemReducedMotion = useReducedMotion();
  const client = useQueryClient();
  const key = ['battle-reactions', room.code, room.seat, room.gameNumber];
  const enabled = connected && room.status === 'active';
  const newer = (incoming: ReactionView, queryKey = key) => {
    const current = client.getQueryData<ReactionView>(queryKey);
    return current && (current.revision > incoming.revision || (current.revision === incoming.revision && current.serverTime > incoming.serverTime)) ? current : incoming;
  };
  const query = useQuery({ queryKey: key, enabled, queryFn: async ({ signal }) => newer(await request<ReactionView>(`/${room.code}/reactions`, undefined, signal)), refetchInterval: enabled ? 1000 : false, retry: false });
  const mutation = useMutation({
    mutationFn: (input: { reactionId: ReactionId; code: string; seat: typeof room.seat; gameNumber: number }) =>
      request<ReactionView>(`/${input.code}/reactions`, { requestId: crypto.randomUUID(), reactionId: input.reactionId, gameNumber: input.gameNumber }),
    onSuccess: (data, input) => {
      const sentKey = ['battle-reactions', input.code, input.seat, input.gameNumber];
      client.setQueryData(sentKey, newer(data, sentKey));
      if (input.code === room.code && input.gameNumber === room.gameNumber) { setOpen(false); trigger.current?.focus(); }
    },
  });
  useEffect(() => { setOpen(false); setCollection(false); mutation.reset(); }, [room.code, room.seat, room.gameNumber, room.status]);
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
  const tray = (query.data?.tray ?? []).filter(id => owned.includes(id));
  const choices = collection
    ? REACTIONS.filter(reaction => owned.includes(reaction.id))
    : tray.flatMap(id => REACTIONS.filter(reaction => reaction.id === id));
  const still = reducedMotion || !!systemReducedMotion;
  if (room.status !== 'active') return null;
  return <>
    <div className="pvp-reaction-controls">
      <button ref={trigger} type="button" className="pvp-reaction-trigger" onClick={() => { if (!open) { setCollection(false); mutation.reset(); } setOpen(v => !v); }} aria-expanded={open} aria-controls="pvp-reaction-picker" aria-label="Choose a reaction"><MessageCircle size={22} /><span>React</span></button>
      {open && <div ref={picker} className="pvp-reaction-picker" id="pvp-reaction-picker" role="region" aria-label="Your reaction collection">
        <header><div><small>BLOCK TALK / PvP</small><h3>{collection ? 'Owned collection' : 'Battle tray'}</h3></div><button type="button" aria-label="Close reactions" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button></header>
        <div className="pvp-reaction-views" role="group" aria-label="Reaction views">
          <button type="button" aria-pressed={!collection} onClick={() => setCollection(false)}>Quick tray</button>
          <button type="button" aria-pressed={collection} onClick={() => setCollection(true)}>All owned{query.data ? ` (${owned.length})` : ''}</button>
        </div>
        <div className="pvp-reaction-grid" aria-label={collection ? 'All owned reactions' : 'Equipped reactions'}>
          {choices.map((reaction, index) => <button type="button" key={reaction.id} disabled={!enabled || !query.data || mutation.isPending || wait > 0}
            onClick={() => mutation.mutate({ reactionId: reaction.id, code: room.code, seat: room.seat, gameNumber: room.gameNumber })}
            aria-label={`Send ${reaction.name}`}><ReactionArt id={reaction.id} still={still} /><strong>{reaction.name}</strong><small>{collection ? 'Owned · send' : `Slot ${index + 1} · send`}</small></button>)}
          {!collection && query.data && Array.from({ length: Math.max(0, REACTION_TRAY_SIZE - choices.length) }, (_, index) =>
            <div className="pvp-reaction-empty" key={`empty-${index}`}><small>Slot {choices.length + index + 1}</small><span>Empty</span></div>)}
        </div>
        {!collection && query.data && !choices.length && <p>Your tray is empty. Choose All owned to send a reaction.</p>}
        <p role="status">{!connected ? 'Reconnect to send reactions.' : !query.data ? 'Loading your reactions…' : mutation.isPending ? 'Sending…' : wait ? `Next reaction in ${wait}s` : 'One reaction every 4 seconds.'}</p>
        {(query.error || mutation.error) && <p role="alert">{onlineErrorMessage(mutation.error ?? query.error)}</p>}
        <label><input type="checkbox" checked={muted} onChange={e => { setMuted(e.target.checked); try { localStorage.setItem('squabblemon:mute-reactions', String(e.target.checked)); } catch { /* Session-only preference. */ } }} /> Hide opponent reactions</label>
        <p className="pvp-reaction-customize">Customize your quick tray before queueing in <strong>Fighter ID → Style → PvP Reactions</strong>. All owned reactions can still be sent here.</p>
      </div>}
    </div>
    {Object.values(query.data?.latest ?? {}).filter(event => event.gameNumber === room.gameNumber && serverNow >= event.sentAt && serverNow - event.sentAt < REACTION_DURATION_MS && !(muted && event.seat !== room.seat)).map(event => <div key={event.id} className={`pvp-reaction-bubble pvp-reaction-bubble--${event.seat === room.seat ? 'you' : 'rival'}`} role="status"><span className="pvp-reaction-cloud" aria-hidden="true" /><ReactionArt id={event.reactionId} still={still} /><small>- {room.members[event.seat === room.seat ? room.seat : otherSeat(room.seat)]?.name ?? 'Player'}</small></div>)}
  </>;
}
