import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import './battle-play-choice.css';

type ChoiceMode = 'invest' | 'dice' | 'concert' | 'last-motion';
export function BattlePlayChoice({ cardName, artwork, district, mode, value, limit, cost, remaining, disabled, playLabel, onChange, onPlay, onCancel }: {
  cardName: string; artwork: string; district: string; mode: ChoiceMode;
  value: number; limit: number; cost: number; remaining: number;
  disabled: boolean; playLabel: string;
  onChange: (amount: number) => void; onPlay: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    node?.showModal();
    node?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true });
    return () => { node?.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  const title = mode === 'concert' ? 'Concert crowd' : mode === 'dice' ? 'Wager Motion' : mode === 'last-motion' ? 'Nothing to Lose' : 'Extra Motion';
  const options = mode === 'concert'
    ? [{ amount: 0, label: 'Lift the crowd', detail: 'Allies +3 · The Opps +1' }, { amount: 1, label: 'Shake the crowd', detail: 'The Opps −3 · allies −1' }]
    : mode === 'dice'
      ? Array.from({ length: Math.max(1, limit) }, (_, i) => ({ amount: i + 1, label: `${i + 1} Motion`, detail: 'Each side wagers' }))
      : Array.from({ length: limit + 1 }, (_, amount) => ({ amount, label: `${amount} Motion`, detail: amount ? `+${amount + 1} Hands` : 'No extra Hands' }));
  if (typeof document === 'undefined') return null;
  return createPortal(<dialog ref={dialog} className="battle-play-choice" data-testid="battle-play-choice" data-mode={mode} aria-label={`${cardName} play choice`}
    onCancel={event => { event.preventDefault(); onCancel(); }}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onCancel(); }}>
    <div className="battle-play-choice__body">
      <button type="button" className="battle-play-choice__close" onClick={onCancel} aria-label="Cancel card choice"><X size={20} aria-hidden="true" /></button>
      <header><img src={artwork} alt="" width="68" height="88" decoding="async" /><div><small>{district}</small><h2>{cardName}</h2><p>{title}</p></div></header>
      {mode === 'last-motion' ? <p className="battle-play-choice__effect">Last Motion · steal up to 2 Hands.</p> : <fieldset className="battle-play-choice__options"><legend className="sr-only">{title}</legend>{options.map(option => <label key={option.amount}>
        <input type="radio" name="battle-play-choice" value={option.amount} checked={value === option.amount} onChange={() => onChange(option.amount)} />
        <span><strong>{option.label}</strong><small>{option.detail}</small>{value === option.amount && <Check size={13} aria-hidden="true" />}</span>
      </label>)}</fieldset>}
      {mode === 'dice' && <p className="battle-play-choice__effect">3 D6 · best two win</p>}
      <footer><div><strong>{cost} Motion</strong><span>{Math.max(0, remaining)} left</span></div><button type="button" data-testid="button-choice-play" className="battle-play-choice__play" disabled={disabled} onClick={onPlay}>{playLabel}<ArrowRight size={17} aria-hidden="true" /></button></footer>
    </div>
  </dialog>, document.body);
}
