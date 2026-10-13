import { useState } from 'react';
import { HandFist } from 'lucide-react';
import { getCardImage } from '../../lib/assets';
import { catalogPortrait } from '../profile/FighterPortrait';
import type { KumiteWinner } from '../../lib/kumite';
import { KumiteLogo } from './KumiteBanner';

export function KumitePortrait({ hero, avatarKey, name = '', decorative = true }: { hero?: string; avatarKey?: string; name?: string; decorative?: boolean }) {
  const card = catalogPortrait(avatarKey ?? '') ?? catalogPortrait(hero ?? '');
  const src = card ? getCardImage(card.catalogId) : '';
  const [failedSource, setFailedSource] = useState('');
  return <span className="kumite-portrait">
    {src && src !== failedSource ? <img src={src} alt={decorative ? '' : `${name} portrait`} loading="lazy" decoding="async" onError={() => setFailedSource(src)} /> : <KumiteLogo decorative />}
  </span>;
}

export function KumiteWinnerCard({ winner }: { winner: KumiteWinner }) {
  return <article className="kumite-winner-card">
    <KumitePortrait hero={winner.hero} avatarKey={winner.avatarKey} name={winner.name} />
    <div className="kumite-winner-card__caption">
      <span className="kumite-fist-seal" aria-hidden="true"><HandFist /></span>
      <small>{winner.weekLabel}</small><h3>{winner.name}</h3>
      <span>{winner.entrantCount} entrants · Champion</span>
      <time dateTime={new Date(winner.wonAt).toISOString()}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(winner.wonAt)}</time>
    </div>
  </article>;
}
