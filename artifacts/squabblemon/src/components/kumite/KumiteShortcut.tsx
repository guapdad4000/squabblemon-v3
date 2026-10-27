import {useKumiteHotspotClock} from '../../lib/useKumiteHotspotClock';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { getAssetUrl } from '../../lib/assets';
import { KumiteLogo } from './KumiteBanner';
import '../../styles/kumite.css';

/** Chibi fight shortcut below the Safehouse's mythic announcements. */
export function KumiteShortcut({ className = '' }: { className?: string }) {
  const [missingArt, setMissingArt] = useState(false);
  const [intent,setIntent]=useState(false);
  const clock=useKumiteHotspotClock(intent);
  return <Link href="/game/kumite" className={`kumite-shortcut ${className}`} aria-label="Enter Kumite weekly PvP tournaments" data-preload-route="/game/kumite" onMouseEnter={()=>setIntent(true)} onMouseLeave={()=>setIntent(false)} onFocus={()=>setIntent(true)} onBlur={()=>setIntent(false)} title={clock}>
    <span className="kumite-shortcut__fight" aria-hidden="true">
      {missingArt ? <KumiteLogo decorative /> : <img src={getAssetUrl('assets/kumite/dragonfly-vs-chonk-chibi-v1.webp')} alt="" width={512} height={468} draggable={false} onError={() => setMissingArt(true)} />}
    </span>
    <span className="kumite-shortcut__clock" role="tooltip">{clock}</span>
    <span className="kumite-shortcut__cta">KUMITE<ArrowUpRight size={13} aria-hidden="true" /></span>
  </Link>;
}
