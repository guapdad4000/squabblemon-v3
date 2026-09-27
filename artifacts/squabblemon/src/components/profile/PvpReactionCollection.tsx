import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useReducedMotion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getGetPlayerBootstrapQueryKey, useUpdatePlayerProfile, type PlayerBootstrap } from '@workspace/api-client-react';
import { REACTIONS, REACTION_PACKS, REACTION_TRAY_SIZE, ownedReactions, reactionById, resolveReactionTray, type ReactionId } from '@workspace/squabblemon-engine/reactions';
import { setDeckExitGuard } from '../../lib/deckExitGuard';
import { ReactionArt } from '../ReactionArt';
import '../../styles/pvp-reactions.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const shortName = (id: ReactionId) => reactionById(id)!.name.split(' — ').at(-1)!;
const fullName = (id: ReactionId) => reactionById(id)!.name;
function apiMessage(error: unknown) {
  if (error instanceof ApiError && error.data && typeof error.data === 'object') {
    const data = error.data as Record<string, unknown>;
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
  }
  return 'Could not save your tray. Your picks are still here.';
}

export function PvpReactionCollection({ bootstrap, onBusyChange, onDirtyChange }: {
  bootstrap: PlayerBootstrap;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { profile } = bootstrap;
  const client = useQueryClient();
  const update = useUpdatePlayerProfile();
  const systemReduced = useReducedMotion();
  const motionOff = !!systemReduced || profile.settings.reducedMotion;
  const unlocks = profile.unlockedCosmeticIds;
  const savedRaw = profile.settings.reactionTray;
  const saved = useMemo(() => resolveReactionTray(savedRaw, unlocks), [JSON.stringify(savedRaw), unlocks.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const owned = useMemo(() => ownedReactions(unlocks), [unlocks.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState<ReactionId[]>(saved);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');
  const [preview, setPreview] = useState<ReactionId | null>(null);
  const inFlight = useRef(false);
  const dirty = !same(draft, saved);
  const saving = state === 'saving';

  // Background refresh: adopt server tray only while the player has no unsaved draft.
  const confirmedRef = useRef<ReactionId[]>(saved);
  useEffect(() => {
    const previous = confirmedRef.current;
    confirmedRef.current = saved;
    if (inFlight.current) return;
    setDraft(current => same(current, previous) ? saved : current);
  }, [saved]);
  // Drop picks that are no longer owned (e.g. account change) without touching order.
  useEffect(() => { setDraft(d => d.every(id => owned.includes(id)) ? d : d.filter(id => owned.includes(id))); }, [owned]);

  const busyRef = useRef(onBusyChange); busyRef.current = onBusyChange;
  const dirtyCb = useRef(onDirtyChange); dirtyCb.current = onDirtyChange;
  useEffect(() => { busyRef.current?.(saving); }, [saving]);
  useEffect(() => { dirtyCb.current?.(dirty); }, [dirty]);
  useEffect(() => () => { busyRef.current?.(false); dirtyCb.current?.(false); }, []);
  useEffect(() => {
    if (!dirty) return;
    const before = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', before);
    const clear = setDeckExitGuard((proceed, stay) => {
      if (window.confirm('Your PvP reaction tray has unsaved changes. Leave without saving?')) proceed(); else stay();
    });
    return () => { window.removeEventListener('beforeunload', before); clear(); };
  }, [dirty]);
  useEffect(() => { if (!preview) return; const t = window.setTimeout(() => setPreview(null), 4000); return () => clearTimeout(t); }, [preview]);

  function edit(next: ReactionId[], message: string) {
    setDraft(next); setAnnounce(message);
    if (state !== 'saving') { setState('idle'); setError(''); }
  }
  const add = (id: ReactionId) => draft.length < REACTION_TRAY_SIZE && !draft.includes(id)
    && edit([...draft, id], `${fullName(id)} added to slot ${draft.length + 1}.`);
  const remove = (id: ReactionId) => edit(draft.filter(x => x !== id), `${fullName(id)} removed from tray.`);
  function move(index: number, delta: number) {
    const to = index + delta; if (to < 0 || to >= draft.length) return;
    const next = [...draft]; [next[index], next[to]] = [next[to], next[index]];
    edit(next, `${fullName(next[to])} moved to slot ${to + 1}.`);
  }

  async function save() {
    if (inFlight.current || !dirty) return;
    inFlight.current = true; setState('saving'); setError('');
    const sending = [...draft];
    try {
      const response = await update.mutateAsync({ data: { reactionTray: sending } });
      await client.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      client.setQueryData(getGetPlayerBootstrapQueryKey(), response);
      void client.invalidateQueries({ queryKey: ['battle-reactions'] });
      const confirmed = resolveReactionTray(response.profile.settings.reactionTray, response.profile.unlockedCosmeticIds);
      setDraft(current => same(current, sending) ? confirmed : current);
      setState('saved'); setAnnounce('Battle tray saved.');
    } catch (e) {
      setError(apiMessage(e)); setState('error');
    } finally { inFlight.current = false; }
  }

  const lockedPacks = REACTION_PACKS.filter(pack => !unlocks.includes(pack.unlock));
  const statusText = saving ? 'Saving your tray…' : state === 'error' ? error : dirty ? 'Unsaved changes. Save to take this tray into PvP.' : state === 'saved' ? 'Saved. This tray rides with you into your next fade.' : 'Saved tray. Edit it any time.';
  const statusKind = saving ? 'saving' : state === 'error' ? 'error' : dirty ? 'dirty' : 'saved';

  return <section className="pvp-reactions" id="pvp-reactions" aria-labelledby="pvp-reactions-title" aria-busy={saving} data-testid="section-pvp-reactions">
    <header className="pvp-reactions__head">
      <div>
        <span className="pvp-reactions__kicker">FIGHTER ID / PvP ONLY</span>
        <h2 id="pvp-reactions-title">PvP Reactions</h2>
        <p>Load up to four into your battle tray. They show in the speech bubble during online fades, in this order.</p>
      </div>
      <div className="pvp-reactions__count" data-testid="text-pvp-reactions-owned"><strong>{owned.length}<small>/{REACTIONS.length}</small></strong>collected</div>
    </header>

    <div className="pvp-tray" data-testid="tray-pvp-reactions">
      <div className="pvp-tray__label"><span>BATTLE TRAY</span><span>{draft.length} / {REACTION_TRAY_SIZE}</span></div>
      <ol className="pvp-tray__slots" aria-label="Battle tray, in send order">
        {Array.from({ length: REACTION_TRAY_SIZE }, (_, index) => {
          const id = draft[index];
          if (!id) return <li key={`empty-${index}`} className="pvp-slot pvp-slot--empty" data-testid={`slot-reaction-empty-${index}`}>
            <span className="pvp-slot__num">{index + 1}</span>
            <span className="pvp-slot__hint">Empty slot<small>Pick from your collection</small></span>
          </li>;
          const name = fullName(id);
          return <li key={id} className="pvp-slot" data-testid={`slot-reaction-${index}`}>
            <span className="pvp-slot__num">{index + 1}</span>
            <div className="pvp-slot__art"><ReactionArt id={id} still /></div>
            <strong className="pvp-slot__name">{shortName(id)}</strong>
            <div className="pvp-slot__controls">
              <button type="button" disabled={saving || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${name} earlier`} data-testid={`button-reaction-earlier-${id}`}>&larr;</button>
              <button type="button" disabled={saving || index === draft.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${name} later`} data-testid={`button-reaction-later-${id}`}>&rarr;</button>
              <button type="button" className="pvp-slot__remove" disabled={saving} onClick={() => remove(id)} aria-label={`Remove ${name} from tray`} data-testid={`button-reaction-remove-${id}`}>Remove</button>
            </div>
          </li>;
        })}
      </ol>
      <div className="pvp-tray__bar">
        <p className="pvp-tray__status" data-state={statusKind} role={state === 'error' ? 'alert' : 'status'} data-testid="status-reaction-tray">{statusText}</p>
        <div className="pvp-tray__actions">
          {dirty && !saving && <button type="button" className="street-sign-btn street-sign-btn--secondary" onClick={() => edit(saved, 'Changes discarded.')} data-testid="button-reaction-tray-reset">Undo changes</button>}
          <button type="button" className="street-sign-btn" disabled={saving || !dirty} onClick={() => void save()} data-testid="button-reaction-tray-save">
            {saving ? 'Saving…' : state === 'error' ? 'Retry save' : 'Save tray'}
          </button>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>

    <h3 className="pvp-reactions__chapter">Your collection <small>{owned.length} READY</small></h3>
    <ul className="pvp-grid" data-testid="grid-pvp-reactions-owned">
      {owned.map(id => {
        const reaction = reactionById(id)!;
        const slot = draft.indexOf(id);
        const inTray = slot >= 0;
        const full = draft.length >= REACTION_TRAY_SIZE;
        const playing = preview === id;
        const name = fullName(id);
        return <li key={id} className="pvp-card" data-in-tray={inTray} data-testid={`card-reaction-${id}`}>
          <button type="button" className="pvp-card__art" aria-pressed={playing} onClick={() => setPreview(playing ? null : id)}
            aria-label={`${playing ? 'Stop previewing' : 'Preview'} ${name}`} data-testid={`button-reaction-preview-${id}`}>
            <ReactionArt id={id} still={motionOff || !playing} />
            {inTray && <span className="pvp-card__stamp">SLOT {slot + 1}</span>}
          </button>
          <strong>{shortName(id)}</strong>
          <small>{reaction.starter ? 'Free starter' : 'Pack unlock'}{playing && motionOff ? ' · motion off' : ''}</small>
          {inTray
            ? <button type="button" className="pvp-card__toggle pvp-card__toggle--on" disabled={saving} onClick={() => remove(id)} aria-label={`Remove ${name} from tray`} data-testid={`button-reaction-toggle-${id}`}>Remove from tray</button>
            : <button type="button" className="pvp-card__toggle" disabled={saving || full} onClick={() => add(id)} aria-label={full ? `Tray full, cannot add ${name}` : `Add ${name} to tray`} data-testid={`button-reaction-toggle-${id}`}>{full ? 'Tray full' : 'Add to tray'}</button>}
        </li>;
      })}
    </ul>

    <h3 className="pvp-reactions__chapter">Still on the wall <small>{lockedPacks.length ? `${lockedPacks.length} PACKS LOCKED` : 'ALL COLLECTED'}</small></h3>
    {lockedPacks.length ? <ul className="pvp-locked" data-testid="list-pvp-reactions-locked">
      {lockedPacks.map(pack => <li key={pack.id} className="pvp-locked__pack" data-testid={`pack-locked-${pack.id}`}>
        <div className="pvp-locked__art" aria-hidden="true">
          {pack.reactionIds.slice(0, 3).map(id => <span key={id}><ReactionArt id={id} still /></span>)}
        </div>
        <div className="pvp-locked__info"><strong>{pack.name}</strong><small>{pack.reactionIds.length} reactions · {pack.price} Clout</small></div>
      </li>)}
    </ul> : <p className="pvp-reactions__done">Every pack on the wall is yours. Respect.</p>}
    <Link className="street-sign-btn street-sign-btn--secondary pvp-reactions__market" href="/game/shop?view=corner&shelf=reactions" data-testid="link-reaction-market">Browse reactions in Fade Market →</Link>
  </section>;
}
