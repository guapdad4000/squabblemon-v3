import { useId, type CSSProperties } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { ArrowUpRight, CalendarDays, Check, ClipboardList } from 'lucide-react';
import { bulletinBoard } from '../../content/bulletinBoard';
import { getAssetUrl } from '../../lib/assets';
import { GamePopupClose, GamePopupFrame, GamePopupLabel, GamePopupTitle } from '../ui/game-popup';
import { FadewoodPanelSign } from './FadewoodPanelPrimitives';
import './fadewood-bulletin.css';

export interface FadewoodBulletinPanelProps {
  bootstrap: PlayerBootstrap;
  onNavigate: (route: string) => void;
  onClose: () => void;
  titleId?: string;
}

/** Content only. The world owns the one dialog, cinematic arrival and focus return. */
export function FadewoodBulletinPanel({ bootstrap, onNavigate, onClose, titleId }: FadewoodBulletinPanelProps) {
  const generatedId = useId();
  const headingId = titleId ?? `fadewood-bulletin-${generatedId}`;
  const ready = bootstrap.missions.filter(mission => mission.status === 'claimable').length;
  const active = bootstrap.missions.filter(mission => mission.status === 'active').length;
  const missions = bootstrap.missions.filter(mission => mission.status !== 'claimed')
    .sort((first, second) => Number(second.status === 'claimable') - Number(first.status === 'claimable')).slice(0, 3);

  return <GamePopupFrame className="fadewood-bulletin fadewood-panel" family="announcement" style={{
    '--fadewood-board-art': `url("${getAssetUrl('assets/events/generated/fadepark-board-texture.webp')}")`,
    '--fadewood-torn-paper': `url("${getAssetUrl('assets/inspector/torn-paper-strip.jpg')}")`,
  } as CSSProperties}>
    <GamePopupClose onClick={onClose} aria-label="Close events and bounties" data-world-initial-focus />
    <header className="fadewood-bulletin__heading">
      <GamePopupLabel>FADE PARK · COMMUNITY BOARD</GamePopupLabel>
      <GamePopupTitle id={headingId} feature>Events & bounties</GamePopupTitle>
      <p>Pick a flyer. Find your next move.</p>
    </header>

    <div className="fadewood-bulletin__columns">
      <section className="fadewood-bulletin__events" aria-labelledby={`${headingId}-events`}>
        <h3 id={`${headingId}-events`}><CalendarDays size={19} aria-hidden="true" />Events & notices</h3>
        <div className="fadewood-bulletin__flyers">
          {bulletinBoard.events.map(event => <article key={event.id} className="fadewood-bulletin__flyer" data-status={event.status}>
            <div className="fadewood-bulletin__photo"><img src={getAssetUrl(event.image)} alt="" width={640} height={360} loading="lazy" decoding="async" draggable={false} /><span>{event.sticker}</span></div>
            <div className="fadewood-bulletin__flyer-copy"><span>{event.statusLabel}</span><h4>{event.title}</h4><p>{event.summary}</p>
              <button type="button" className="fadewood-panel__ticket" onClick={() => onNavigate(event.link.href)}>{event.link.label}<ArrowUpRight size={16} aria-hidden="true" /></button>
            </div>
          </article>)}
        </div>
        <FadewoodPanelSign onClick={() => onNavigate('/game/events')}>Full Events board</FadewoodPanelSign>
      </section>

      <section className="fadewood-bulletin__bounties" aria-labelledby={`${headingId}-bounties`}>
        <div className="fadewood-bulletin__bounty-paper">
          <img className="fadewood-bulletin__bounty-art" src={getAssetUrl('assets/bounty-hunter/hero.webp')} alt="" width={1280} height={853} loading="lazy" decoding="async" draggable={false} />
          <h3 id={`${headingId}-bounties`}><ClipboardList size={19} aria-hidden="true" />Your bounties</h3>
          <p className="fadewood-bulletin__bounty-count"><strong>{ready}</strong> ready to collect <span>· {active} in progress</span></p>
          {missions.length ? <ul className="fadewood-bulletin__mission-list">{missions.map(mission => <li key={mission.id} data-status={mission.status}>
            <button type="button" onClick={() => onNavigate(`/game/missions?mission=${encodeURIComponent(mission.id)}`)} aria-label={`Open bounty: ${mission.title}`}>
              <strong>{mission.title}</strong>
              <span>{mission.status === 'claimable' ? <><Check size={14} aria-hidden="true" />Ready to collect</> : `${Math.max(0, Math.min(mission.progress, mission.goal))} / ${mission.goal}`}<b>{mission.rewardAmount.toLocaleString()} {mission.rewardCurrency === 'softCurrency' ? 'Clout' : 'Tickets'}</b></span>
            </button>
          </li>)}</ul> : <p className="fadewood-bulletin__empty">{bootstrap.missions.length ? 'Your listed bounties are collected.' : 'Your bounty board is quiet.'}</p>}
          <FadewoodPanelSign onClick={() => onNavigate('/game/missions')}>Open Bounties</FadewoodPanelSign>
        </div>
      </section>
    </div>

    <footer className="fadewood-bulletin__footer"><button type="button" className="fadewood-panel__ticket" onClick={onClose}>Back to the block</button><button type="button" className="fadewood-panel__ticket" onClick={() => onNavigate('/game/events?section=feedback')}>Pin a note for the devs<ArrowUpRight size={15} aria-hidden="true" /></button></footer>
  </GamePopupFrame>;
}
