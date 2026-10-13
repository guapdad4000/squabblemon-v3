import { HandFist } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';
import '../../styles/kumite-brand.css';

export function KumiteLogo({ className = '', decorative = false }: { className?: string; decorative?: boolean }) {
  return <img className={`kumite-logo ${className}`} src={getAssetUrl('assets/kumite/squabblemon-wordmark.webp')} alt={decorative ? '' : 'Squabblemon'} draggable={false} />;
}

/** The cloth is artwork. Every title stays selectable, editable and readable by assistive technology. */
export function KumiteBanner({ title = 'KUMITE', subtitle = 'UNDERGROUND TOURNAMENT', variant = 'hero', cloth = true, className = '' }: {
  title?: string; subtitle?: string; variant?: 'hero' | 'vertical' | 'horizontal'; cloth?: boolean; className?: string;
}) {
  return <div className={`kumite-banner kumite-banner--${variant} ${className}`}>
    {cloth && <img className="kumite-banner__cloth" src={getAssetUrl(`assets/kumite/${variant === 'horizontal' ? 'yellow-banner-wide' : 'yellow-banner'}.webp`)} alt="" draggable={false} decoding="async" />}
    <div className="kumite-banner__ink">
      <span className="kumite-fist-seal" aria-hidden="true"><HandFist strokeWidth={2.4} /></span>
      <span className="kumite-banner__title">{title}</span>
      <span className="kumite-banner__subtitle">{subtitle}</span>
    </div>
  </div>;
}
