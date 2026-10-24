import { Check, LockKeyhole, Play, Star } from 'lucide-react';
import { forwardRef, type KeyboardEvent } from 'react';
import type { StorySeasonProgress } from '@workspace/api-client-react';
import { getAssetUrl } from '../../../../data';

type SeasonPosterProps = {
  season: StorySeasonProgress;
  isSelected: boolean;
  isCurrent?: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
};

const SEASON_POSTERS: Record<string, string> = {
  'season-1': 'assets/story/posters/block-crown.webp',
  'season-2': 'assets/story/posters/blockbuster.webp',
  'special-sherlock': 'assets/story/posters/missing-motion.webp',
  'special-oz': 'assets/story/posters/yellow-line.webp',
  'special-alice': 'assets/story/posters/borrowed-hour.webp',
  'special-yasuke': 'assets/story/posters/banner-without-master.webp',
  'special-cellblock': 'assets/story/posters/library-hour.webp',
  'special-leon': 'assets/story/posters/place-to-return.webp',
  'special-squabble-house': 'assets/story/posters/last-waffle.webp',
};

export const SeasonPoster = forwardRef<HTMLButtonElement, SeasonPosterProps>(({
  season,
  isSelected,
  isCurrent = false,
  onSelect,
  onFocus,
  onKeyDown,
}, ref) => {
  const poster = SEASON_POSTERS[season.id] ?? 'assets/story/theater/season-one.webp';

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
      data-current={isCurrent}
      aria-label={`${season.title} · ${isCurrent ? 'Continue here' : season.status === 'cleared' ? 'Completed, replay available' : season.status === 'locked' ? 'Locked' : 'Available'} · ${season.starsEarned} of ${season.starsAvailable} stars · ${season.clearedNodes} of ${season.totalNodes} scenes`}
      data-status={season.status}
      data-testid={`button-presentation-${season.id}`}
    >
      <div className="cinema-poster-art">
        <img className="cinema-poster-cover" src={getAssetUrl(poster)} alt="" draggable={false} />
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
        {isCurrent ? <><Play aria-hidden="true"/> Continue here</> : season.status === 'cleared' ? <><Check aria-hidden="true"/> Completed · Replay</> : season.status === 'locked' ? <><LockKeyhole aria-hidden="true"/> Locked</> : season.clearedNodes ? 'In progress' : 'Ready to start'}
      </div>
    </button>
  );
});

SeasonPoster.displayName = 'SeasonPoster';
