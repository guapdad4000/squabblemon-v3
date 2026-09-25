import { Star } from 'lucide-react';
import { forwardRef, type KeyboardEvent } from 'react';
import type { StorySeasonProgress } from '@workspace/api-client-react';
import { getAssetUrl } from '../../../../data';

type SeasonPosterProps = {
  season: StorySeasonProgress;
  isSelected: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
};

const SEASON_ASSETS: Record<string, { bg: string; characters: string[] }> = {
  'season-1': { bg: 'assets/layered/morning-block.webp', characters: ['assets/characters/cornball.webp', 'assets/characters/block-party-titan.webp'] },
  'season-2': { bg: 'assets/layered/red-alley.webp', characters: ['assets/characters/ganger-red.webp', 'assets/characters/ganger-blue.webp'] },
  'special-oz': { bg: 'assets/layered/morning-block.webp', characters: ['assets/characters/dorothy.webp', 'assets/characters/oz.webp'] },
  'special-alice': { bg: 'assets/layered/blue-arcade.webp', characters: ['assets/characters/alice.webp', 'assets/characters/queen-of-hearts.webp'] },
  'special-yasuke': { bg: 'assets/layered/red-alley.webp', characters: ['assets/characters/yasuke.webp'] },
  'special-cellblock': { bg: 'assets/layered/red-alley.webp', characters: ['assets/characters/inmate-crafty.webp', 'assets/characters/inmate-boyfriend.webp'] },
  'special-leon': { bg: 'assets/layered/morning-block.webp', characters: ['assets/characters/homeless-guy.webp', 'assets/characters/delivery-demon.webp'] },
  'special-sherlock': { bg: 'assets/layered/blue-arcade.webp', characters: ['assets/characters/sherlock.webp', 'assets/characters/watson.webp'] },
};

export const SeasonPoster = forwardRef<HTMLButtonElement, SeasonPosterProps>(({
  season,
  isSelected,
  onSelect,
  onFocus,
  onKeyDown,
}, ref) => {
  const assets = SEASON_ASSETS[season.id] ?? { bg: 'assets/layered/morning-block.webp', characters: [] };

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={isSelected ? 0 : -1}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={onSelect}
      className={`cinema-poster ${isSelected ? 'is-selected' : ''}`}
      data-selected={isSelected}
      data-status={season.status}
      data-testid={`button-presentation-${season.id}`}
    >
      <div className="cinema-poster-art">
        <div className="cinema-poster-bg" style={{ backgroundImage: `url(${getAssetUrl(assets.bg)})` }} />
        {assets.characters.map((char, i) => (
          <img key={i} src={getAssetUrl(char)} className={`cinema-poster-char char-${i}`} alt="" draggable={false} />
        ))}
        <div className="cinema-poster-vignette" />
      </div>

      <div className="cinema-poster-details">
        <span className="cinema-poster-subtitle">{season.subtitle}</span>
        <h2 className="cinema-poster-title">{season.title}</h2>
        <div className="cinema-poster-progress">
          <span><Star aria-hidden="true" /> {season.starsEarned} / {season.starsAvailable}</span>
          <span>{season.clearedNodes} / {season.totalNodes} scenes</span>
        </div>
      </div>

      <div className="cinema-poster-status-badge" data-status={season.status}>
        {season.status === 'available' ? (season.clearedNodes ? 'Playing' : 'Available') : season.status}
      </div>
    </button>
  );
});

SeasonPoster.displayName = 'SeasonPoster';
