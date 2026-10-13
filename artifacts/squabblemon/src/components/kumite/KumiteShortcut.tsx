import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { KumiteBanner } from './KumiteBanner';
import '../../styles/kumite.css';

/** Compact hanging cloth CTA for the Safehouse's right-hand announcement rail. */
export function KumiteShortcut({ className = '' }: { className?: string }) {
  return <Link href="/game/kumite" className={`kumite-shortcut ${className}`} aria-label="Enter Kumite weekly PvP tournaments" data-preload-route="/game/kumite">
    <KumiteBanner variant="vertical" subtitle="WEEKLY PVP" />
    <span className="kumite-shortcut__cta">8 spots. One champion.<ArrowUpRight size={17} aria-hidden="true" /></span>
  </Link>;
}
