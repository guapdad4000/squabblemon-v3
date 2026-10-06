import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowUpRight, Swords } from 'lucide-react';
import { CardView } from './CardView';
import { getEffectiveCardPower, type CardInstance } from '../gameEngine';
import { getLocationArtwork } from '../locationArtwork';
import { getLocationDetails } from '../locationDetails';
import './battle-location-details.css';

type District = { id: string; name: string; rule: string; strategy?: string; accent?: string; status?: string };
type ViewMode = 'location' | 'formation';
export function BattleDistrictView({ districts, boards, scores, lane, mode = 'formation', onMode, onLane, onClose, onInspect, variantFor, covered, targetIds = [] }: {
  districts: District[]; boards: CardInstance[][]; scores: { player: number; cpu: number }[];
  lane: number; mode?: ViewMode; onMode?: (mode: ViewMode) => void; onLane: (lane: number) => void; onClose: () => void;
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
  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [lane, mode]);
  const district = districts[lane];
  const art = getLocationArtwork(district.id);
  const details = getLocationDetails(district.id);
  const score = scores[lane];
  const formation = mode === 'formation';
  return createPortal(<dialog ref={dialog} className="battle-district-view" data-mode={mode} data-location={district.id}
    style={{ '--location-accent': district.accent || '#e9c675' } as React.CSSProperties}
    aria-label={`${district.name} district view`}
    onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="battle-location-header">
      <div><small>{formation ? 'District view · live formations' : 'Know the streets'}<span aria-hidden="true"> / / </span>{details.category}</small><h2>{district.name}</h2></div>
      <button type="button" className="battle-location-close" onClick={onClose} aria-label="Close location details"><X size={22} aria-hidden="true" /></button>
    </header>
    {formation && <nav aria-label="District scores">{districts.map((d, i) => <button type="button" key={d.id} aria-pressed={i === lane} onClick={() => onLane(i)}>
      <span>{d.name}</span><strong><em>{scores[i].cpu}</em><small>Rival / You</small><b>{scores[i].player}</b></strong>
    </button>)}</nav>}
    <div ref={content} className="battle-district-view__content">
      <div className={formation ? "battle-location-layout battle-location-layout--formation" : "battle-location-layout"}>
        {!formation && <figure className="battle-location-portrait">
          <div className="battle-location-art"><span className="battle-location-art__stamp" aria-hidden="true">{details.category}</span>
            <img className="battle-location-scene" src={art.wallpaper} srcSet={`${art.node} 600w, ${art.wallpaper} 1200w`}
              sizes="(max-width: 600px) 92vw, 420px" width="1200" height="800" alt={`${district.name} location artwork`} decoding="async" draggable={false} />
          </div>
          <figcaption data-testid="location-description">{details.description}</figcaption>
        </figure>}
        <div className="battle-location-briefing">
          <section className="battle-district-rule" aria-labelledby="location-rule-title" data-testid="location-rule">
            <span className="battle-location-label">House rules</span><h3 id="location-rule-title">Rule of the block</h3><p>{district.rule}</p>
          </section>
          {!formation && district.strategy && <section className="battle-location-strategy" aria-labelledby="location-strategy-title" data-testid="location-strategy">
            <h3 id="location-strategy-title"><ArrowUpRight size={18} aria-hidden="true" />Make your move</h3><p>{district.strategy}</p>
          </section>}
          {district.status && <section className="battle-location-status" aria-labelledby="location-status-title" data-testid="location-status">
            <h3 id="location-status-title">Right now</h3><p>{district.status}</p>
          </section>}
          {!formation && <div className="battle-location-score" aria-label={`Current Hands: Rival ${score.cpu}, You ${score.player}`}>
            <div><span>Rival</span><strong>{score.cpu}</strong></div><Swords size={18} aria-hidden="true" /><div><span>You</span><strong>{score.player}</strong></div>
          </div>}
        </div>
      </div>
      {formation && <div className="battle-location-formations">
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
      </div>}
    </div>
    <footer className="battle-location-footer">
      {onMode && <button type="button" className="battle-location-secondary" onClick={() => onMode(formation ? 'location' : 'formation')}>
        {formation ? 'Location details' : 'View fighters here'}<ArrowUpRight size={15} aria-hidden="true" />
      </button>}
      <button type="button" className="battle-location-return" onClick={onClose}><ArrowLeft size={16} aria-hidden="true" />Back to board</button>
    </footer>
  </dialog>, document.body);
}
