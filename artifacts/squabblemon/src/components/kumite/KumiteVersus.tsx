import { useState } from 'react';
import { Check, Clock3 } from 'lucide-react';
import type { OnlineRoomView, Seat } from '@workspace/squabblemon-engine/multiplayer';
import { getAssetUrl, getCardImage } from '../../lib/assets';
import { catalogPortrait } from '../profile/FighterPortrait';
import { KumiteLogo } from './KumiteBanner';
import '../../styles/kumite-versus.css';

function VersusFighter({ member, own, seat }: { member: OnlineRoomView['members'][Seat]; own: boolean; seat: Seat }) {
  const hero = catalogPortrait(member?.hero ?? '');
  const source = hero ? getCardImage(hero.catalogId) : '';
  const [failedSource, setFailedSource] = useState('');
  const hasArt = Boolean(source && source !== failedSource);
  return <article className={`kumite-versus__fighter kumite-versus__fighter--${seat}`} data-ready={Boolean(member?.ready)}>
    <span className="kumite-versus__seat">{own ? 'YOU' : 'OPPONENT'}</span>
    <div className="kumite-versus__portrait" data-art-fallback={!hasArt}>
      {hasArt ? <img src={source} alt="" draggable={false} decoding="async" onError={() => setFailedSource(source)} /> : <KumiteLogo decorative />}
    </div>
    <div className="kumite-versus__nameplate">
      <h2>{member?.name ?? 'Awaiting fighter'}</h2>
      {hero && <span className="kumite-versus__hero">{hero.name}</span>}
    </div>
    <p className="kumite-versus__ready" aria-live="polite">{member?.ready ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{member?.ready ? 'Ready' : 'Not ready'}</p>
  </article>;
}

/** Real assigned heroes sit above separate artwork; player labels stay live and editable. */
export function KumiteVersus({ room }: { room: OnlineRoomView }) {
  return <section className="kumite-versus" aria-label="Assigned Kumite fighters" data-testid="kumite-versus">
    <img className="kumite-versus__backdrop" src={getAssetUrl('assets/kumite/vs-backdrop.webp')} alt="" aria-hidden="true" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
    <div className="kumite-versus__halves">
      <VersusFighter member={room.members.player} own={room.seat === 'player'} seat="player" />
      <VersusFighter member={room.members.cpu} own={room.seat === 'cpu'} seat="cpu" />
    </div>
    <strong className="kumite-versus__versus" aria-hidden="true">VS</strong>
  </section>;
}
