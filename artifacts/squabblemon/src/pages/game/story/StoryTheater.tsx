import { type StoryCampaign, type StorySeasonProgress } from '@workspace/api-client-react';
import { storyContent, storySeasons } from '@workspace/squabblemon-engine/story';
import { ChevronLeft, ChevronRight, LockKeyhole, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import { getAssetUrl } from '../../../data';
import '../../../styles/theater.css';
import { SeasonPoster } from './components/SeasonPoster';
import { usePopcornParticles } from './components/usePopcornParticles';
import { useProjectorBeam } from './components/useProjectorBeam';

type TheaterProps = {
  campaign: StoryCampaign;
  onSelectSeason: (seasonId: string) => void;
  onContinue?: (nodeId: string) => void;
};

function legacySeasons(campaign: StoryCampaign): StorySeasonProgress[] {
  return storySeasons.map((season) => {
    const chapterIds = new Set(season.chapterIds);
    const nodes = campaign.nodes.filter((node) => chapterIds.has(node.chapterId));
    const authoredNodes = storyContent.chapters
      .filter((chapter) => chapterIds.has(chapter.id))
      .flatMap((chapter) => chapter.nodes);
    const clearedNodes = nodes.filter((node) => node.cleared).length;
    const availableNodes = nodes.filter((node) => node.status === 'available' && !node.cleared);
    const recommendedNodeId =
      availableNodes.find((node) => node.nodeId === campaign.recommendedNodeId)?.nodeId ??
      availableNodes[0]?.nodeId ??
      null;

    return {
      ...season,
      chapterIds: [...season.chapterIds],
      status: nodes.length > 0 && clearedNodes === nodes.length
        ? 'cleared'
        : availableNodes.length > 0 || nodes.some((node) => node.cleared)
          ? 'available'
          : 'locked',
      recommendedNodeId,
      starsEarned: nodes.reduce((total, node) => total + node.stars, 0),
      starsAvailable: authoredNodes.filter((node) => node.kind === 'battle').length * 3,
      clearedNodes,
      totalNodes: nodes.length || authoredNodes.length,
    };
  });
}

export function StoryTheater({ campaign, onSelectSeason, onContinue }: TheaterProps) {
  const posterRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const posterRailRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    dragged: boolean;
    onPosterRail: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressResetRef = useRef<number | null>(null);

  const { containerRef: popcornContainerRef, spawnParticles } = usePopcornParticles();
  const { logoRef, beamRef, lensAnchorRef, handlePointerMove, updateBeam } = useProjectorBeam();

  const seasons = useMemo(
    () => campaign.seasons?.length ? campaign.seasons : legacySeasons(campaign),
    [campaign],
  );

  const recommendedNode = useMemo(() => {
    const available = campaign.nodes.filter((node) => node.status === 'available' && !node.cleared);
    return available.find((node) => node.nodeId === campaign.recommendedNodeId) ??
      available.find((node) => seasons.some((season) => season.recommendedNodeId === node.nodeId)) ??
      available[0] ??
      null;
  }, [campaign.nodes, campaign.recommendedNodeId, seasons]);

  const recommendedSeason = seasons.find((season) =>
    season.chapterIds.includes(recommendedNode?.chapterId ?? ''),
  );

  const initialSeason = recommendedSeason ?? seasons.find((season) => season.status !== 'locked') ?? seasons[0];
  const [selectedId, setSelectedId] = useState(initialSeason?.id ?? '');
  const selected = seasons.find((season) => season.id === selectedId) ?? initialSeason;
  const selectedIndex = seasons.findIndex((season) => season.id === selected?.id);

  useEffect(() => {
    if (!seasons.some((season) => season.id === selectedId) && initialSeason) {
      setSelectedId(initialSeason.id);
    }
  }, [initialSeason, seasons, selectedId]);

  useEffect(() => () => {
    if (suppressResetRef.current !== null) window.clearTimeout(suppressResetRef.current);
  }, []);

  const selectSeason = (seasonId: string, focus = false, openImmediately = false) => {
    setSelectedId(seasonId);

    const season = seasons.find((item) => item.id === seasonId);
    if (openImmediately && season && season.status !== 'locked') {
      onSelectSeason(seasonId);
      return;
    }

    const poster = posterRefs.current[seasonId];
    poster?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
    if (focus) poster?.focus({ preventScroll: true });
  };

  const handlePosterKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = Math.min(seasons.length - 1, index + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = Math.max(0, index - 1);
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = seasons.length - 1;
    else return;

    event.preventDefault();
    selectSeason(seasons[target].id, true);
  };

  const unlockCondition = selected?.status === 'locked'
    ? storyContent.chapters
      .find((chapter) => chapter.id === selected.chapterIds[0])
      ?.prerequisites.map((id) => storyContent.chapters.find((chapter) => chapter.id === id)?.title ?? id)
      .join(', ')
    : null;

  return createPortal(
    <div
      className="theater-host"
      onPointerMoveCapture={(event) => {
        handlePointerMove(event);
        const drag = dragRef.current;
        if (drag?.pointerId === event.pointerId) {
          const deltaX = event.clientX - drag.x;
          const distance = Math.hypot(deltaX, event.clientY - drag.y);
          if (distance > 8) drag.dragged = true;
          if (drag.dragged && drag.onPosterRail && posterRailRef.current) {
            posterRailRef.current.scrollLeft = drag.scrollLeft - deltaX;
          }
        }
      }}
      onPointerDownCapture={(event) => {
        handlePointerMove(event);
        const target = event.target as Element;
        dragRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          scrollLeft: posterRailRef.current?.scrollLeft ?? 0,
          dragged: false,
          onPosterRail: Boolean(target.closest('.theater-posters')),
        };
      }}
      onPointerUpCapture={(event) => {
        const drag = dragRef.current;
        if (drag?.pointerId === event.pointerId) {
          suppressClickRef.current = drag.dragged;
          dragRef.current = null;
          if (drag.dragged) {
            if (suppressResetRef.current !== null) window.clearTimeout(suppressResetRef.current);
            suppressResetRef.current = window.setTimeout(() => {
              suppressClickRef.current = false;
              suppressResetRef.current = null;
            }, 500);
          } else {
            spawnParticles(event);
          }
        }
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      data-testid="region-story-theater"
    >
      <div className="theater-hall">
        {/* Environment */}
        <div className="theater-bg" style={{ backgroundImage: `url(${getAssetUrl('assets/story/theater/cinema-hall.webp')})` }} />

        {/* Curtains */}
        <img src={getAssetUrl('assets/story/theater/cinema-curtain.webp')} className="theater-curtain theater-curtain--left" alt="" />
        <img src={getAssetUrl('assets/story/theater/cinema-curtain.webp')} className="theater-curtain theater-curtain--right" alt="" />

        {/* Bottom Film Elements */}
        <img src={getAssetUrl('assets/story/theater/cinema-film-strip.webp')} className="cinema-film-strip" alt="" />
        <div className="cinema-reel-container">
          <img src={getAssetUrl('assets/story/theater/cinema-reel.webp')} className="cinema-reel" alt="" />
        </div>

        {/* Dynamic Beam and Logo */}
        <div className="theater-beam" ref={beamRef} aria-hidden="true" data-testid="projector-beam" />
        <div
          ref={lensAnchorRef}
          aria-hidden="true"
          data-testid="projector-lens-anchor"
          style={{ position: 'fixed', width: 1, height: 1, pointerEvents: 'none' }}
        />
        <img
          ref={logoRef}
          src={getAssetUrl('assets/story/theater/cinema-logo.webp')}
          className="cinema-logo"
          alt=""
          onLoad={() => updateBeam()}
        />

        <div className="theater-content">
          <h1
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            Squabblemon Cinema
          </h1>
          <Link href="/game" className="theater-exit" aria-label="Return to safehouse">Back to block</Link>

          {([-1, 1] as const).map((direction) => {
            const target = seasons[selectedIndex + direction];
            return (
              <button
                key={direction}
                type="button"
                className={`theater-nav theater-nav--${direction < 0 ? 'previous' : 'next'}`}
                style={{ minWidth: 44, minHeight: 44 }}
                aria-label={direction < 0 ? 'Previous presentation' : 'Next presentation'}
                disabled={!target}
                onClick={() => {
                  if (target) selectSeason(target.id);
                }}
              >
                {direction < 0 ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
            );
          })}

          <div className="theater-posters" ref={posterRailRef} aria-label="Story presentations">
            {seasons.map((season, index) => {
              const isSelected = season.id === selected?.id;
              return (
                <SeasonPoster
                  key={season.id}
                  ref={(node) => { posterRefs.current[season.id] = node; }}
                  season={season}
                  isSelected={isSelected}
                  onFocus={() => selectSeason(season.id)}
                  onKeyDown={(event) => handlePosterKeys(event, index)}
                  onSelect={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      if (suppressResetRef.current !== null) {
                        window.clearTimeout(suppressResetRef.current);
                        suppressResetRef.current = null;
                      }
                      return;
                    }
                    selectSeason(season.id, false, true);
                  }}
                />
              );
            })}
          </div>

          {selected && (
            <section className="theater-selection" aria-live="polite" data-testid="status-selected-presentation">
              <span>{selected.description}</span>
              {unlockCondition && (
                <small data-testid={`status-unlock-${selected.id}`}>
                  <LockKeyhole aria-hidden="true" /> Unlock by completing {unlockCondition}.
                </small>
              )}
            </section>
          )}

          <button
            type="button"
            className="theater-continue-ticket"
            disabled={!recommendedNode}
            onClick={() => {
              if (!recommendedNode) return;
              if (onContinue) onContinue(recommendedNode.nodeId);
              else {
                const season = seasons.find((item) => item.chapterIds.includes(recommendedNode.chapterId));
                if (season && season.status !== 'locked') onSelectSeason(season.id);
              }
            }}
            data-testid="button-continue-story"
          >
            <span>
              <Play aria-hidden="true" fill="currentColor" /> Continue Story
            </span>
          </button>
        </div>
      </div>

      {/* Particle Container */}
      <div
        ref={popcornContainerRef}
        data-testid="popcorn-particles"
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
      />
    </div>,
    document.body
  );
}
