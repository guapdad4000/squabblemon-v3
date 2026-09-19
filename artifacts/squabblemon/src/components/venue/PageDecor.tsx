import { getAssetUrl } from '../../lib/assets';
import '../../styles/world-decor.css';

export type PageDecorTheme =
  | 'bounties'
  | 'mastery'
  | 'collection'
  | 'crew'
  | 'market'
  | 'battle'
  | 'profile'
  | 'safehouse'
  | 'story'
  | 'mythic';

const ART: Record<PageDecorTheme, string> = {
  bounties: 'bounties-poster-wall.webp',
  mastery: 'mastery-training-kit.webp',
  collection: 'collection-playbook.webp',
  crew: 'collection-playbook.webp',
  market: 'market-counter.webp',
  battle: 'fight-night-press.webp',
  profile: 'fighter-dossier.webp',
  safehouse: 'safehouse-relics.webp',
  story: 'story-ephemera.webp',
  mythic: 'mythic-relics.webp',
};

/** Non-interactive physical props with a clear center for gameplay. */
export function PageDecor({ theme, compact = false }: { theme: PageDecorTheme; compact?: boolean }) {
  return (
    <div className={`world-decor ${compact ? 'world-decor--compact' : ''}`} data-decor={theme} aria-hidden="true">
      <img className="world-decor__primary" src={getAssetUrl(`brand/decorations/${ART[theme]}`)} alt="" draggable={false} decoding="async" />
      {!['safehouse', 'battle', 'story', 'mythic'].includes(theme) && (
        <img className="world-decor__city" src={getAssetUrl('brand/decorations/city-ephemera.webp')} alt="" draggable={false} decoding="async" />
      )}
    </div>
  );
}
