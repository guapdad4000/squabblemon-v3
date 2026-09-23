import { ChevronLeft, ChevronRight, LockKeyhole, Play, Projector, Star, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import './_group.css';

type StoryNodeProgress = {
  chapterId: string;
  nodeId: string;
  status: 'locked' | 'available' | 'cleared';
  cleared: boolean;
  stars: number;
};

type StorySeasonProgress = {
  id: string;
  kind: 'season' | 'special';
  title: string;
  subtitle: string;
  description: string;
  chapterIds: string[];
  posterAssetId: string;
  status: 'locked' | 'available' | 'cleared';
  recommendedNodeId: string | null;
  starsEarned: number;
  starsAvailable: number;
  clearedNodes: number;
  totalNodes: number;
};

type StoryCampaign = {
  nodes: StoryNodeProgress[];
  recommendedNodeId: string | null;
  seasons?: StorySeasonProgress[];
};

type TheaterProps = {
  campaign: StoryCampaign;
  onSelectSeason: (seasonId: string) => void;
  onContinue?: (nodeId: string) => void;
};

const storySeasons = [
  {
    id: 'season-1', kind: 'season', title: 'The Block Crown', subtitle: 'Season One',
    description: 'One neighborhood. Two brothers. A crown that cannot fix a family.',
    chapterIds: ['block-party'], posterAssetId: 'assets/story/theater/season-one.webp',
  },
  {
    id: 'season-2', kind: 'season', title: 'Blockbuster on the Block', subtitle: 'Season Two',
    description: 'You won the Crown. Somebody else bought the roof. Save the gathering place without selling out the people.',
    chapterIds: ['s2-the-morning-after'], posterAssetId: 'assets/story/theater/season-two.webp',
  },
  {
    id: 'special-sherlock', kind: 'special', title: 'The Missing Motion', subtitle: 'A Sherlock Special Presentation',
    description: 'A stolen film reel. A detective charging by the deduction. Everybody has an alibi; none of them are good.',
    chapterIds: ['special-sherlock-missing-motion'], posterAssetId: 'assets/story/theater/sherlock.webp',
  },
] as const;

const storyContent = {
  chapters: [
    { id: 'block-party', title: 'Block Party', prerequisites: [] as string[], nodes: [{ id: 'welcome-to-the-block', kind: 'battle' }] },
    { id: 's2-the-morning-after', title: 'The Crown', prerequisites: ['block-party'], nodes: [{ id: 'the-morning-after', kind: 'battle' }] },
    { id: 'special-sherlock-missing-motion', title: 'Block Party', prerequisites: ['block-party'], nodes: [{ id: 'missing-motion', kind: 'battle' }] },
  ],
};

const campaign: StoryCampaign = {
  recommendedNodeId: 'welcome-to-the-block',
  nodes: [
    { chapterId: 'block-party', nodeId: 'welcome-to-the-block', status: 'available', cleared: false, stars: 0 },
    { chapterId: 'block-party', nodeId: 'scene-two', status: 'locked', cleared: false, stars: 0 },
    { chapterId: 's2-the-morning-after', nodeId: 'the-morning-after', status: 'locked', cleared: false, stars: 0 },
    { chapterId: 'special-sherlock-missing-motion', nodeId: 'missing-motion', status: 'locked', cleared: false, stars: 0 },
  ],
  seasons: [
    {
      ...storySeasons[0], chapterIds: [...storySeasons[0].chapterIds], status: 'available',
      recommendedNodeId: 'welcome-to-the-block', starsEarned: 0, starsAvailable: 21, clearedNodes: 0, totalNodes: 8,
    },
    {
      ...storySeasons[1], chapterIds: [...storySeasons[1].chapterIds], status: 'locked',
      recommendedNodeId: null, starsEarned: 0, starsAvailable: 18, clearedNodes: 0, totalNodes: 8,
    },
    {
      ...storySeasons[2], chapterIds: [...storySeasons[2].chapterIds], status: 'locked',
      recommendedNodeId: null, starsEarned: 0, starsAvailable: 6, clearedNodes: 0, totalNodes: 3,
    },
  ],
};

const getAssetUrl = (path: string) => `/__mockup/images/story-cinema-current/${path.split('/').at(-1)}`;

function legacySeasons(source: StoryCampaign): StorySeasonProgress[] {
  return storySeasons.map((season) => {
    const chapterIds = new Set<string>(season.chapterIds);
    const nodes = source.nodes.filter((node) => chapterIds.has(node.chapterId));
    const authoredNodes = storyContent.chapters
      .filter((chapter) => chapterIds.has(chapter.id))
      .flatMap((chapter) => chapter.nodes);
    const clearedNodes = nodes.filter((node) => node.cleared).length;
    const availableNodes = nodes.filter((node) => node.status === 'available' && !node.cleared);
    const recommendedNodeId =
      availableNodes.find((node) => node.nodeId === source.recommendedNodeId)?.nodeId ??
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

function StoryTheater({ campaign: source, onSelectSeason, onContinue }: TheaterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const posterRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const requestRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; dragged: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const seasons = useMemo(
    () => source.seasons?.length ? source.seasons : legacySeasons(source),
    [source],
  );
  const recommendedNode = useMemo(() => {
    const available = source.nodes.filter((node) => node.status === 'available' && !node.cleared);
    return available.find((node) => node.nodeId === source.recommendedNodeId) ??
      available.find((node) => seasons.some((season) => season.recommendedNodeId === node.nodeId)) ??
      available[0] ??
      null;
  }, [source.nodes, source.recommendedNodeId, seasons]);
  const recommendedSeason = seasons.find((season) =>
    season.chapterIds.includes(recommendedNode?.chapterId ?? ''),
  );
  const initialSeason = recommendedSeason ?? seasons.find((season) => season.status !== 'locked') ?? seasons[0];
  const [selectedId, setSelectedId] = useState(initialSeason?.id ?? '');
  const [boothOpen, setBoothOpen] = useState(false);
  const selected = seasons.find((season) => season.id === selectedId) ?? initialSeason;
  const selectedIndex = seasons.findIndex((season) => season.id === selected?.id);

  useEffect(() => {
    if (!seasons.some((season) => season.id === selectedId) && initialSeason) {
      setSelectedId(initialSeason.id);
    }
  }, [initialSeason, seasons, selectedId]);

  useEffect(() => () => {
    if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
  }, []);

  const aimBeam = (event: PointerEvent<HTMLDivElement>) => {
    const host = containerRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(() => {
      host.style.setProperty('--mx', String(x));
      host.style.setProperty('--my', String(y));
      requestRef.current = null;
    });
  };

  const selectSeason = (seasonId: string, focus = false) => {
    setSelectedId(seasonId);
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
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectSeason(seasons[index].id);
      return;
    } else return;
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
      ref={containerRef}
      onPointerMove={(event) => {
        aimBeam(event);
        if (dragRef.current?.pointerId === event.pointerId) {
          const distance = Math.hypot(event.clientX - dragRef.current.x, event.clientY - dragRef.current.y);
          if (distance > 8) dragRef.current.dragged = true;
        }
      }}
      onPointerDown={(event) => {
        aimBeam(event);
        dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) {
          suppressClickRef.current = dragRef.current.dragged;
          dragRef.current = null;
        }
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      style={{ '--mx': 50, '--my': 50 } as CSSProperties}
      data-testid="region-story-theater"
    >
      <div className="theater-hall">
        <div className="theater-bg" style={{ backgroundImage: `url(${getAssetUrl('assets/story/theater/theater.webp')})` }} />
        <div className="theater-beam" aria-hidden="true" />
        <div className="theater-curtain theater-curtain--left" style={{ backgroundImage: `url(${getAssetUrl('assets/story/theater/curtain-left.webp')})` }} />
        <div className="theater-curtain theater-curtain--right" style={{ backgroundImage: `url(${getAssetUrl('assets/story/theater/curtain-right.webp')})` }} />

        <div className="theater-content">
          <a href="#safehouse" onClick={(event) => event.preventDefault()} className="theater-exit" aria-label="Return to safehouse">Back to block</a>
          <header className="theater-header">
            <h1>Squabblemon Cinema</h1>
            <p>Select a presentation</p>
          </header>

          <button
            type="button"
            className="theater-booth"
            onClick={() => setBoothOpen(true)}
            aria-label="Visit the projection booth"
            data-testid="button-projection-booth"
          >
            <Projector aria-hidden="true" /> <span>Projection booth</span>
          </button>

          {([-1, 1] as const).map((direction) => {
            const target = seasons[selectedIndex + direction];
            return (
              <button
                key={direction}
                type="button"
                className={`theater-nav theater-nav--${direction < 0 ? 'previous' : 'next'}`}
                aria-label={direction < 0 ? 'Previous presentation' : 'Next presentation'}
                disabled={!target}
                onClick={() => target && selectSeason(target.id)}
              >
                {direction < 0 ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
            );
          })}
          <div className="theater-posters" role="listbox" aria-label="Story presentations">
            {seasons.map((season, index) => {
              const isSelected = season.id === selected?.id;
              return (
                <button
                  key={season.id}
                  ref={(node) => { posterRefs.current[season.id] = node; }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onFocus={() => selectSeason(season.id)}
                  onKeyDown={(event) => handlePosterKeys(event, index)}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    selectSeason(season.id);
                  }}
                  className="theater-poster"
                  data-selected={isSelected}
                  data-status={season.status}
                  data-testid={`button-presentation-${season.id}`}
                >
                  <img src={getAssetUrl(season.posterAssetId)} alt="" draggable={false} />
                  <div className="theater-poster__copy">
                    <span>{season.subtitle}</span>
                    <h2>{season.title}</h2>
                    <div className="theater-poster__progress">
                      <span><Star aria-hidden="true" /> {season.starsEarned} / {season.starsAvailable}</span>
                      <span>{season.clearedNodes} / {season.totalNodes} scenes</span>
                    </div>
                  </div>
                  <div className="theater-poster__status" data-status={season.status}>
                    {season.status === 'available' ? (season.clearedNodes ? 'Playing' : 'Available') : season.status}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <section className="theater-selection" aria-live="polite" data-testid="status-selected-presentation">
              <div className="theater-selection__copy">
                <strong>{selected.title}</strong>
                <span>{selected.description}</span>
                {unlockCondition && (
                  <small data-testid={`status-unlock-${selected.id}`}>
                    <LockKeyhole aria-hidden="true" /> Unlock by completing {unlockCondition}.
                  </small>
                )}
              </div>
              <button
                type="button"
                className="theater-open"
                disabled={selected.status === 'locked'}
                onClick={() => selected.status !== 'locked' && onSelectSeason(selected.id)}
                data-testid="button-open-presentation"
              >
                {selected.status === 'locked' ? <LockKeyhole aria-hidden="true" /> : <Play aria-hidden="true" />}
                Open Presentation
              </button>
            </section>
          )}

          <button
            type="button"
            className="theater-continue"
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
            <Play aria-hidden="true" /> Continue Story
          </button>
        </div>
      </div>

      {boothOpen && (
        <div className="theater-note-backdrop" role="presentation" onMouseDown={() => setBoothOpen(false)}>
          <section
            className="theater-note"
            role="dialog"
            aria-modal="true"
            aria-labelledby="projection-note-title"
            onMouseDown={(event) => event.stopPropagation()}
            data-testid="dialog-projection-booth"
          >
            <button type="button" onClick={() => setBoothOpen(false)} aria-label="Close projection booth note" data-testid="button-close-projection-booth">
              <X aria-hidden="true" />
            </button>
            <Projector aria-hidden="true" />
            <h2 id="projection-note-title">Projection Booth</h2>
            <p>Cornball asked Snitch if the projector was running. Snitch said, “Yeah—and I already told it where you live.”</p>
          </section>
        </div>
      )}
    </div>,
    document.body,
  );
}

export function Current() {
  return (
    <StoryTheater
      campaign={campaign}
      onSelectSeason={() => undefined}
      onContinue={() => undefined}
    />
  );
}