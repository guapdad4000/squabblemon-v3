import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CardView } from './CardView';
import { getEffectiveCardPower, type CardInstance } from '../gameEngine';

type District = { name: string; rule: string; status?: string };
export function BattleDistrictView({ districts, boards, scores, lane, onLane, onClose, onInspect, variantFor, covered, targetIds = [] }: {
  districts: District[]; boards: CardInstance[][]; scores: { player: number; cpu: number }[];
  lane: number; onLane: (lane: number) => void; onClose: () => void;
  onInspect: (card: CardInstance) => void; variantFor: (card: CardInstance) => string | undefined;
  covered: (id: string) => boolean; targetIds?: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => { node?.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [lane]);
  const district = districts[lane];
  return createPortal(<dialog ref={dialog} className="battle-district-view" aria-label={`${district.name} district view`}
    onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><div><small>District view · live scores</small><h2>{district.name}</h2></div><button type="button" onClick={onClose}>Back to board</button></header>
    <nav aria-label="District scores">{districts.map((d, i) => <button type="button" key={i} aria-pressed={i === lane} onClick={() => onLane(i)}>
      <span>{d.name}</span><strong><em>{scores[i].cpu}</em><small>Rival / You</small><b>{scores[i].player}</b></strong>
    </button>)}</nav>
    <div ref={content} className="battle-district-view__content">
      <details className="battle-district-rule"><summary>District rule</summary><p>{district.rule}</p>{district.status && <p>{district.status}</p>}</details>
      {(['cpu', 'player'] as const).map(owner => <section key={owner} aria-label={owner === 'cpu' ? 'Rival fighters' : 'Your fighters'}>
        <h3>{owner === 'cpu' ? 'Rival' : 'Your gang'} <span>{boards[lane].filter(c => c.owner === owner).length} fighters</span></h3>
        <div className="battle-district-view__cards">{boards[lane].filter(c => c.owner === owner).map(card => <div key={card.instanceId} className={targetIds.includes(card.instanceId) ? 'district-fighter is-targeted' : 'district-fighter'}>
          <CardView card={card} isBoard isEnemy={owner === 'cpu'} fillContainer disableLayout covered={covered(card.instanceId)}
            variantId={variantFor(card)} effectivePower={getEffectiveCardPower(card)}
            onClick={() => onInspect(card)} onInspect={() => onInspect(card)} />
          <span>{targetIds.includes(card.instanceId) ? 'Targeted · ' : ''}{card.name}</span>
        </div>)}</div>
        {!boards[lane].some(c => c.owner === owner) && <p className="battle-district-empty">No fighters here yet.</p>}
      </section>)}
      <p className="battle-district-hint">Tap a fighter for their full ability and status.</p>
    </div>
  </dialog>, document.body);
}
