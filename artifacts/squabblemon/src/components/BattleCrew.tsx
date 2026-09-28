import React, { useEffect, useMemo, useRef } from 'react';
import type { CardInstance } from '../gameEngine';
import { getEffectiveCardPower } from '../gameEngine';
import { CardView } from './CardView';

export function BattleCrew({ name, crew, onClose, onInspect }: { name: string; crew: CardInstance[]; onClose: () => void; onInspect: (card: CardInstance) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const powers = useMemo(() => new Map(crew.map(card => [card.instanceId, getEffectiveCardPower(card)])), [crew]);
  return <dialog ref={dialog} className="battle-crew-dialog" aria-label={`${name} gang`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><div><span>District formation</span><h2>{name}</h2></div><button autoFocus type="button" onClick={onClose} aria-label="Close gang view">Close</button></header>
    <p>Choose a character to inspect their ability and status.</p>
    <div className="battle-crew-grid">{crew.map(card => <CardView key={card.instanceId} card={card} isInspector inspectable fillContainer effectivePower={powers.get(card.instanceId)} onClick={() => { onClose(); onInspect(card); }} onInspect={() => { onClose(); onInspect(card); }} />)}</div>
  </dialog>;
}
