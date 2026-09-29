import { lazy, Suspense } from 'react';
import { UserRound } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';

const AlleyAvatar = lazy(() => import('./AlleyAvatar').then(module => ({ default: module.AlleyAvatar })));
const stillUrl = getAssetUrl('assets/fade-alley/street-sentinel-still.png');
function FighterLayer({ ready }: { ready: boolean }) {
  return <Suspense fallback={<img className="fa-avatar__still" src={stillUrl} alt="" aria-hidden="true" />}>
    <AlleyAvatar animation={ready ? 'Boxing_Practice' : 'Idle_10'} className="fa-avatar__model" />
  </Suspense>;
}

export function FadeAlleyScene({ rivalName, rivalHandle, joined = false, invited = false, ready = false, rivalReady = false, seat = 'player' }: {
  rivalName?: string; rivalHandle?: string; joined?: boolean; invited?: boolean; ready?: boolean; rivalReady?: boolean; seat?: 'player' | 'cpu';
}) {
  return <section className="fa-scene" aria-label="Fade Alley">
    <img className="fa-scene__image" src={getAssetUrl('assets/fade-alley/night.png')} alt="" />
    <div className="fa-hud-logo"><img src={getAssetUrl('assets/fade-alley/fade-alley-logo.png')} alt="Squabblemon Fade Alley" /></div>
    <div className="fa-scene__copy">
      <div className="fa-eyebrow">PRIVATE 1V1 · UNRANKED</div>
    </div>
    <div className="fa-avatar fa-avatar--you"><FighterLayer ready={ready} /></div>
    <div className="fa-playerlabel fa-playerlabel--you"><small>{seat === 'player' ? 'PLAYER 1' : 'PLAYER 2'}</small><strong>You</strong><span><UserRound size={11} /> {seat === 'player' ? 'Host' : 'Guest'}</span></div>
    <div className={`fa-rivalzone${joined ? ' fa-rivalzone--joined' : ''}`} aria-label={joined ? `${rivalName ?? 'Rival'} joined` : 'Waiting for rival'}>
      {joined
        ? <div className="fa-avatar fa-avatar--rival"><FighterLayer ready={rivalReady} /></div>
        : <div className="fa-rival-silhouette"><UserRound size={31} /><span>OPEN SPOT</span></div>}
    </div>
    {(joined || invited) && <div className={`fa-playerlabel fa-playerlabel--rival${joined ? ' fa-playerlabel--present' : ''}`}>
      <small>{seat === 'player' ? 'PLAYER 2' : 'PLAYER 1'}</small><strong>{joined ? rivalName ?? 'Rival' : invited ? rivalName ?? 'Invited' : 'Waiting'}</strong>
      {(joined || invited) && <span><UserRound size={11} />{joined ? rivalHandle ?? 'Joined' : 'Invite pending'}</span>}
    </div>}
  </section>;
}