import { useEffect, useState, type ComponentProps } from 'react';
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import type { ParkResult } from '../ParkResult';
import { getAssetUrl, getCardImage } from '../../lib/assets';
import { setBattleMusicMode } from '../../musicStore';
import { KumiteLogo } from './KumiteBanner';
import '../../styles/kumite-result.css';

const poseHeroes = new Set(['franklin-duke', 'chonk-lee', 'bushedo-brown']);

/** Real outcome data sits above independent cinematic plates and character poses. */
export function KumiteResult({ outcome, description, claimed, rivalClaimed, timeoutResult, children, hero = 'leroy', playerName = 'You', final = false }: ComponentProps<typeof ParkResult> & { hero?: string; playerName?: string; final?: boolean; timeoutResult?: boolean }) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const win = outcome === 'win';
  const pose = poseHeroes.has(hero) && outcome !== 'draw' ? getAssetUrl(`assets/kumite/outcomes/${hero}-${outcome}.webp`) : getCardImage(hero);
  const logo = getAssetUrl('assets/kumite/squabblemon-wordmark.webp');
  const src = [...new Set([pose, getCardImage(hero), logo])].find(candidate => !failedSources.includes(candidate));
  const isLogo = src === logo;
  useEffect(() => {
    if (outcome === 'draw') return;
    setBattleMusicMode(win ? 'victory' : 'defeat');
    return () => setBattleMusicMode(null);
  }, [outcome, win]);
  return <DialogContent className={`kumite-result kumite-result--${outcome}`} aria-describedby="kumite-result-description" data-testid="kumite-result-dialog">
    <DialogClose className="kumite-result__close" aria-label="Inspect final board">×</DialogClose>
    <div className="kumite-result__scene" aria-hidden="true">
      <img className="kumite-result__backdrop" src={getAssetUrl(`assets/kumite/${outcome === 'draw' ? 'dojo-arena-wide' : `outcomes/${win ? 'victory-harbor' : 'defeat-impact'}`}.webp`)} alt="" />
      {src ? <img className={`kumite-result__fighter ${src === pose && poseHeroes.has(hero) && outcome !== 'draw' ? 'is-pose' : ''} ${isLogo ? 'kumite-logo' : ''}`} src={src} alt="" style={isLogo ? { width: '70%', height: '40%', left: '15%', bottom: '30%' } : undefined} onError={() => setFailedSources(current => current.includes(src) ? current : [...current, src])} /> : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', font: '800 italic 2rem var(--font-display)' }}>SQUABBLEMON</span>}
      <div className="kumite-result__shade" />
    </div>
    <header className="kumite-result__heading"><KumiteLogo decorative /><span>WEEKLY KUMITE · {playerName}</span><DialogTitle>{win ? final ? 'KUMITE CHAMPION.' : 'YOU ADVANCE.' : outcome === 'draw' ? 'RUN IT AGAIN.' : 'RESPECT THE FIGHT.'}</DialogTitle><p>{win ? final ? 'Your name belongs on the wall.' : 'Stay ready. The next round is calling.' : outcome === 'draw' ? 'Same gang. Same rivals. A fresh fight.' : 'Keep your discipline. Come back stronger.'}</p></header>
    <div className="kumite-result__receipt">
      <DialogDescription id="kumite-result-description" data-testid={timeoutResult ? 'timeout-result-reason' : undefined}>{description}</DialogDescription>
      <div className="kumite-result__scores"><span>YOUR DISTRICTS<strong>{claimed}</strong></span><i>—</i><span>RIVAL DISTRICTS<strong>{rivalClaimed}</strong></span></div>
      {timeoutResult && <p>District totals show the final board; the turn deadline decided this match.</p>}
      <nav aria-label="After the Kumite fight">{children}</nav>
    </div>
  </DialogContent>;
}
