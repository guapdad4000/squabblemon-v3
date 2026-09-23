import { rewardReceipts } from '../../lib/rewardReceipts';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { PageDecor } from '../../components/venue/PageDecor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Crown, LockKeyhole, MessageCircle, Star, Ticket } from 'lucide-react';
import '../../styles/studio.css';
import '../../styles/story-map.css';
import '../../styles/cinema-atlas.css';
import '../../styles/story-briefing.css';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { Link } from 'wouter';
import {
  getGetPlayerBootstrapQueryKey,
  getGetPlayerStoryQueryKey,
  type PlayerBootstrap,
  type StoryCampaign,
  type StoryGrantedReward,
  useCompletePlayerStoryNode,
  useGetPlayerStory,
  useSavePlayerStoryDialogue,
} from '@workspace/api-client-react';
import {
  storyDialogueToken,
  STORY_CHARACTERS,
  getStoryChapter,
  getStoryNode,
  getStorySeason,
  getStorySeasonForChapter,
  type StoryBattleNode,
  type StoryDialogueLine,
  type StoryNode,
  type StoryReward,
} from '@workspace/squabblemon-engine/story';
import { STORY_DUPLICATE_STYLE_SHARDS } from '@workspace/squabblemon-engine/economy';
import { cards, catalogCardByEngineId, getAssetUrl, getCardImage, CARD_RARITY_DEFINITIONS } from '../../data';
import { getMatchRoundLimit, getStoryModifierSummaries } from '../../gameEngine';
import { StoryStage } from '../../components/story/StoryStage';
import { ChapterTickets } from '../../components/story/ChapterTickets';
import {
  ChapterTicketProgress,
  ThreeStarResults,
} from '../../components/story';
import { CardRarityTreatment, getRarityClass } from '../../components/CardRarityTreatment';
import { StoryTheater } from './story/StoryTheater';
import { StoryPuzzle } from './story/StoryPuzzle';

type SceneEntry = {
  token: string;
  section: 'pre' | 'main' | 'post';
  line: StoryDialogueLine;
};

function sceneEntries(node: StoryNode): SceneEntry[] {
  if (node.kind === 'battle') {
    return [
      ...node.preDialogue.map((line, index) => ({
        token: storyDialogueToken(node.id, 'pre', index),
        section: 'pre' as const,
        line,
      })),
      ...node.postDialogue.map((line, index) => ({
        token: storyDialogueToken(node.id, 'post', index),
        section: 'post' as const,
        line,
      })),
    ];
  }
  return node.scenes.map((line, index) => ({
    token: storyDialogueToken(node.id, 'main', index),
    section: 'main' as const,
    line,
  }));
}

function rewardLabel(reward: StoryReward | StoryGrantedReward) {
  if (reward.kind === 'card') return `${cards[reward.id]?.name ?? reward.id} card · duplicate: ${'duplicateShards' in reward && reward.duplicateShards ? reward.duplicateShards : STORY_DUPLICATE_STYLE_SHARDS} Style Shards`;
  if (reward.kind === 'chapter-key') return 'Next chapter key';
  if (reward.kind === 'pack-ticket')
    return reward.amount === 10
      ? '10× Street Pack Tickets · One upgraded ten-pull'
      : `${reward.amount}x Pack Ticket${reward.amount === 1 ? '' : 's'}`;
  if (reward.kind === 'cosmetic') return `Cosmetic: ${reward.id}`;
  if (reward.kind === 'character-unlock') return `${STORY_CHARACTERS.find((character) => character.id === reward.id)?.name ?? reward.id} unlocked`;
  return reward.id === 'clout' ? `+${reward.amount} Clout · Training fund` : `+${reward.amount} Account XP`;
}

export function Story({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const storyQuery = useGetPlayerStory();
  const mapViewport = useRef<HTMLDivElement>(null);
  const mapDrag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);

  const campaign = storyQuery.data;
  useEffect(() => {
    if (!campaign || typeof campaign !== 'object' || !Array.isArray(campaign.nodes)) return;
    const params = new URLSearchParams(search);
    const requestedNode = params.get('node');
    const requestedSeason = params.get('season');

    const requestedProgress = campaign.nodes.find((node) => node.nodeId === requestedNode);
    if (requestedProgress && requestedProgress.status !== 'locked') {
      setSelectedNodeId(requestedProgress.nodeId);
      setActiveChapterId(requestedProgress.chapterId);
      setActiveSeasonId(getStorySeasonForChapter(requestedProgress.chapterId)?.id ?? null);
      return;
    }

    setSelectedNodeId(null);
    const season = requestedSeason ? getStorySeason(requestedSeason) : undefined;
    setActiveSeasonId(season?.id ?? null);
    const allowedChapters = campaign.chapters.filter(chapter => !season || season.chapterIds.includes(chapter.id));
    const recommended = campaign.nodes.find(node => node.nodeId === campaign.recommendedNodeId && allowedChapters.some(chapter => chapter.id === node.chapterId))
      ?? campaign.nodes.find(node => node.status === 'available' && !node.optional && allowedChapters.some(chapter => chapter.id === node.chapterId));
    setActiveChapterId(current => allowedChapters.some(chapter => chapter.id === current)
      ? current : recommended?.chapterId ?? allowedChapters[0]?.id ?? null);
  }, [campaign, location, search]);

  const currentChapter = (Array.isArray(campaign?.chapters)
    ? campaign.chapters.find((chapter) => chapter.id === activeChapterId) ??
      campaign.chapters.find((chapter) => chapter.status !== 'locked') ??
      campaign.chapters[0]
    : undefined) as StoryCampaign['chapters'][number] | undefined;

  useEffect(() => {
    const viewport = mapViewport.current;
    if (!viewport || !Array.isArray(campaign?.nodes)) return;
    const next = campaign.nodes.find(node => node.chapterId === currentChapter?.id && node.nodeId === campaign.recommendedNodeId)
      ?? campaign.nodes.find(node => node.chapterId === currentChapter?.id && node.status === 'available');
    if (!next) return;
    const centerNext = () => viewport.scrollTo({
      left: Math.max(0, viewport.scrollWidth * next.mapPosition.x / 100 - viewport.clientWidth / 2),
      top: Math.max(0, viewport.scrollHeight * next.mapPosition.y / 100 - viewport.clientHeight / 2),
      behavior: 'instant',
    });
    centerNext();
    const observer = new ResizeObserver(centerNext);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [currentChapter?.id, activeSeasonId, campaign?.recommendedNodeId, campaign?.nodes]);
  if (storyQuery.error) {
    return (
      <div className="h-full grid place-items-center bg-zinc-950 p-6 text-center">
        <div className="max-w-sm">
          <div className="font-mono text-[10px] uppercase tracking-[.25em] text-accent">Map signal lost</div>
          <h1 className="mt-2 font-display text-3xl font-black italic uppercase">Could not load the street</h1>
          <p className="mt-3 text-sm text-white/55">Your progress is safe. Reconnect and pull the campaign map again.</p>
          <button
            type="button"
            onClick={() => void storyQuery.refetch()}
            className="mt-6 bg-primary px-7 py-3 font-display font-black italic uppercase text-black"
          >
            Retry Map
          </button>
        </div>
      </div>
    );
  }
  if (storyQuery.isLoading || !campaign || !bootstrap) {
    return (
      <div className="h-full grid place-items-center bg-zinc-950 font-mono text-xs uppercase tracking-widest text-white/50">
        Mapping territory...
      </div>
    );
  }
  // Vite SPA fallback returns 200 OK with the index HTML when the API server
  // is offline; customFetch then hands us a string instead of a parsed
  // StoryCampaign. Guard the shape so the rest of the page can short-circuit
  // into the offline copy below.
  if (typeof campaign !== 'object' || !Array.isArray(campaign.chapters) || !Array.isArray(campaign.nodes)) {
    return (
      <div className="h-full grid place-content-center bg-zinc-950 text-center px-6 gap-3">
        <div className="font-mono text-[10px] text-white/45 uppercase tracking-[.2em]">Story</div>
        <div className="font-display font-black italic text-2xl uppercase">The streets are out of reach.</div>
        <p className="text-sm text-white/55 max-w-sm mx-auto">
          Connect your account to continue your campaign. In the meantime, sharpen your gang in a practice fight.
        </p>
        <Link
          href="/game/play"
          className="mx-auto mt-2 bg-primary text-black px-5 py-3 font-display font-black italic uppercase text-sm"
        >
          Run a CPU Fight
        </Link>
      </div>
    );
  }
  if (!campaign.chapters.length) {
    return <div className="h-full grid place-items-center bg-black text-sm text-white/55">No chapters are active.</div>;
  }

  if (!activeSeasonId && !selectedNodeId) {
    return (
      <StoryTheater
        campaign={campaign}
        onSelectSeason={(seasonId) => setLocation(`/game/story?season=${seasonId}`)}
        onContinue={(nodeId) => setLocation(`/game/story?node=${encodeURIComponent(nodeId)}`)}
      />
    );
  }

  const nodes = campaign.nodes.filter((node) => node.chapterId === currentChapter!.id);
  const chapterContent = currentChapter ? getStoryChapter(currentChapter.id) : undefined;
  const recommended = nodes.find(node => node.nodeId === campaign.recommendedNodeId);
  return (
    <div className="studio-page story-atlas world-decor-host">
      {/* Knock out only the near-white matte in the supplied decorative images. */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
        <defs>
          <filter id="story-film-cutout" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -6 -6 -6 0 18" result="matte" />
            <feComposite in="SourceGraphic" in2="matte" operator="in" />
          </filter>
        </defs>
      </svg>
      <PageDecor theme="story" />
      <header className="story-atlas__header">
        <button type="button" onClick={() => setLocation('/game/story')} className="text-white/70 text-xs font-mono uppercase tracking-widest absolute top-2 left-4 z-10 hover:text-white">&larr; Browse presentations</button>
        <ChapterTickets chapters={campaign.chapters.filter(c => !activeSeasonId || getStorySeason(activeSeasonId)?.chapterIds.includes(c.id))} activeId={currentChapter?.id} onSelect={setActiveChapterId} />
        <h1 className="story-title">{currentChapter?.title}</h1>
      </header>

      <div className="story-atlas__viewport" style={{ backgroundImage: `url("${getAssetUrl(currentChapter?.mapAssetId || '')}")` }}>
          {/* Static film-reel decorations (transparent BG, pointer-events: none). */}
          <span className="story-atlas__ornament story-atlas__ornament--reel-tl" aria-hidden="true">
            <img src={getAssetUrl('brand/story-cinematic/film-reel-corner.png')} alt="" draggable={false} />
          </span>
          <span className="story-atlas__ornament story-atlas__ornament--reel-tr" aria-hidden="true">
            <img src={getAssetUrl('brand/story-cinematic/film-reel-pair.png')} alt="" draggable={false} />
          </span>
          <span className="story-atlas__ornament story-atlas__ornament--strip-left" aria-hidden="true">
            <img src={getAssetUrl('brand/story-cinematic/film-reel-flow.png')} alt="" draggable={false} />
          </span>
          <span className="story-atlas__ornament story-atlas__ornament--reel-br" aria-hidden="true">
            <img src={getAssetUrl('brand/story-cinematic/film-reel-corner.png')} alt="" draggable={false} />
          </span>
          <span className="story-atlas__ornament story-atlas__ornament--cluster-bl" aria-hidden="true">
            <img src={getAssetUrl('brand/story-cinematic/film-reel-cluster.png')} alt="" draggable={false} />
          </span>
        <div ref={mapViewport} className="story-atlas__pan" tabIndex={0} role="region" aria-label="Campaign nodes. Swipe or use arrow keys to explore."
          onPointerDown={event => {
            mapDrag.current = null;
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            mapDrag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false };
          }}
          onPointerMove={event => {
            const drag = mapDrag.current;
            if (!drag || !event.buttons) return;
            const x = event.clientX - drag.x, y = event.clientY - drag.y;
            if (Math.hypot(x, y) > 6) { drag.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
            if (drag.moved) { event.currentTarget.scrollLeft = drag.left - x; event.currentTarget.scrollTop = drag.top - y; }
          }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { mapDrag.current = null; }}
          onClickCapture={event => { if (event.detail !== 0 && mapDrag.current?.moved) { event.stopPropagation(); event.preventDefault(); } }}>
        <div className="story-atlas__terrain">
          <svg className="story-atlas__routes" aria-hidden="true">
            {nodes.flatMap((node) =>
              node.prerequisites.map((id) => {
                const parent = nodes.find((n) => n.nodeId === id);
                return parent ? (
                  <line
                    key={`${id}-${node.nodeId}`}
                    x1={`${parent.mapPosition.x}%`}
                    y1={`${parent.mapPosition.y}%`}
                    x2={`${node.mapPosition.x}%`}
                    y2={`${node.mapPosition.y}%`}
                    stroke={node.status === 'locked' ? 'rgba(240,179,90,0.18)' : 'rgba(240,179,90,0.7)'}
                    strokeWidth={node.status === 'locked' ? 1 : 2}
                    strokeDasharray={node.status === 'locked' ? '3 7' : undefined}
                  />
                ) : null;
              }),
            )}
          </svg>
          {nodes.map((node) => {
            const locked = node.status === 'locked';
            const cleared = node.status === 'cleared';
            const isNext = node.nodeId === campaign.recommendedNodeId;
            const content = getStoryNode(node.nodeId);
            const boss = content?.kind === 'battle' && ['boss', 'mini-boss'].includes(content.battleType);
            return (
              <button
                key={node.nodeId}
                type="button"
                aria-disabled={locked}
                aria-label={`${node.title}, ${node.status}`}
                onClick={() => {
                  if (!locked) setLocation(`/game/story?node=${encodeURIComponent(node.nodeId)}`);
                }}
                className={`story-atlas__node ${isNext ? 'is-next' : ''} ${boss ? 'is-boss' : ''} ${locked ? 'is-locked' : ''} ${cleared ? 'is-cleared' : ''} ${node.optional ? 'is-optional' : ''}`}
                style={{ left: `${node.mapPosition.x}%`, top: `${node.mapPosition.y}%` }}
              >
                <span className="story-atlas__marker">
                  {boss && content?.kind === 'battle' ? (
                    <img src={getAssetUrl(content.encounter.enemy.portraitAssetId)} alt="" />
                  ) : locked ? (
                    <LockKeyhole size={15} />
                  ) : cleared ? (
                    <Check size={20} />
                  ) : node.kind === 'battle' ? (
                    <GameGlyph name="fight" />
                  ) : (
                    <MessageCircle size={19} />
                  )}
                  {boss && <Crown className="story-atlas__crown" size={15} />}
                </span>
                <span className="story-atlas__label">
                  <strong>{node.title}</strong>
                  <small>
                    {locked ? 'Locked' : isNext ? 'Up next' : node.optional ? 'Side story' : cleared ? 'Cleared' : 'Available'}
                  </small>
                </span>
                {node.kind === 'battle' && (
                  <span className="story-atlas__stars" aria-label={`${node.stars} of 3 stars`}>
                    {[1, 2, 3].map((n) => (
                      <Star key={n} size={9} fill={n <= node.stars ? 'currentColor' : 'none'} style={{ opacity: n <= node.stars ? 1 : 0.3 }} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
          <div className="story-atlas__wash" />
          <div className="story-atlas__light" aria-hidden="true" />
        {currentChapter && chapterContent && (
          <button
            type="button"
            className="story-atlas__rewards-fab"
            onClick={() => setRewardsOpen(true)}
            aria-label="Open chapter ticket rewards"
          >
            <Ticket size={14} />
            <span>Rewards</span>
          </button>
        )}
      </div>

      {/* Cinematic film-strip wave divider between viewport and footer. */}
      <span className="story-atlas__ornament story-atlas__ornament--wave-divider" aria-hidden="true">
        <img src={getAssetUrl('brand/story-cinematic/film-strip-wave.png')} alt="" draggable={false} />
      </span>

      <AnimatePresence>
        {rewardsOpen && currentChapter && chapterContent && (
          <motion.div
            key="rewards"
            className="story-atlas__rewards-panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-label="Chapter ticket rewards"
          >
            <div className="story-atlas__rewards-panel__head">
              <span className="story-atlas__rewards-panel__title">
                <Ticket size={14} />
                <strong>Chapter rewards</strong>
                <em>{currentChapter.title}</em>
              </span>
              <button
                type="button"
                className="story-atlas__rewards-panel__close"
                onClick={() => setRewardsOpen(false)}
                aria-label="Close rewards"
              >
                ×
              </button>
            </div>
            <div className="story-atlas__rewards-panel__body">
              <ChapterTicketProgress
                chapter={chapterContent}
                nodeProgressById={Object.fromEntries(
                  campaign.nodes.map((node) => [node.nodeId, { stars: node.stars, cleared: node.cleared }]),
                )}
                onSelectBattle={(nodeId) => {
                  const progress = campaign.nodes.find((node) => node.nodeId === nodeId);
                  if (progress?.status !== 'locked') {
                    setLocation(`/game/story?node=${encodeURIComponent(nodeId)}`);
                    setRewardsOpen(false);
                  }
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNodeId && (
          <NodeOverlay
            key={selectedNodeId}
            nodeId={selectedNodeId}
            campaign={campaign}
            onClose={() => {
              setSelectedNodeId(null);
              const season = getStorySeasonForChapter(currentChapter!.id);
              setLocation(season ? `/game/story?season=${season.id}` : '/game/story', { replace: true });
            }}
            onStartBattle={(nodeId) => setLocation(`/game/story/play/${nodeId}`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
export function NodeOverlay({
  nodeId,
  campaign,
  onClose,
  onStartBattle,
}: {
  nodeId: string;
  campaign: StoryCampaign;
  onClose: () => void;
  onStartBattle: (nodeId: string) => void;
}) {
  const queryClient = useQueryClient();
  const completeNode = useCompletePlayerStoryNode();
  const saveDialogue = useSavePlayerStoryDialogue();
  const nodeProgress = campaign.nodes.find((node) => node.nodeId === nodeId);
  const storyNode = getStoryNode(nodeId);
  const actionLock = useRef(false);
  const [screen, setScreen] = useState<'dialogue' | 'briefing' | 'puzzle' | 'completed'>('dialogue');
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [grantedRewards, setGrantedRewards] = useState<StoryGrantedReward[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  const entries = useMemo(() => (storyNode ? sceneEntries(storyNode) : []), [storyNode]);
  const seen = useMemo(() => new Set(nodeProgress?.dialogueSeen ?? []), [nodeProgress?.dialogueSeen]);
  const pendingEntries = useMemo(() => {
    if (!storyNode) return [];
    const targetSection =
      storyNode.kind !== 'battle' ? 'main' : nodeProgress?.cleared ? 'post' : 'pre';
    return entries.filter((entry) => entry.section === targetSection && !seen.has(entry.token));
  }, [entries, nodeProgress?.cleared, seen, storyNode]);
  const history = entries.filter((entry) => seen.has(entry.token));
  const replayEntries = entries.filter((entry) => entry.section !== 'post' || nodeProgress?.cleared);
  const isBattle = storyNode?.kind === 'battle';
  const hasPuzzle = !!storyNode?.puzzle;
  const isCleared = nodeProgress?.cleared;
  const pending = completeNode.isPending || saveDialogue.isPending;

  useEffect(() => {
    setActionError(null);
    if (pendingEntries.length) setScreen('dialogue');
    else setScreen(isBattle ? 'briefing' : hasPuzzle && !isCleared ? 'puzzle' : 'completed');
  }, [isBattle, hasPuzzle, isCleared, nodeId, pendingEntries.length]);

  if (!storyNode || !nodeProgress) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-6 text-center">
        <div className="max-w-sm border border-white/15 bg-zinc-950 p-7">
          <div className="font-mono text-[10px] uppercase tracking-[.25em] text-accent">Street file missing</div>
          <h2 className="mt-2 font-display text-3xl font-black italic uppercase">Fight could not be opened</h2>
          <p className="mt-3 text-sm text-white/55">Return to the map and choose another available stop.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 bg-primary px-7 py-3 font-display font-black italic uppercase text-black"
          >
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  const applyCampaign = (nextCampaign: StoryCampaign, bootstrap?: unknown) => {
    queryClient.setQueryData(getGetPlayerStoryQueryKey(), nextCampaign);
    if (bootstrap) queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), bootstrap);
  };

  const advanceDialogue = async (skipRemaining: boolean) => {
    if (actionLock.current) return;
    const current = pendingEntries[0];
    if (!current) return;
    actionLock.current = true;
    const remaining = skipRemaining ? pendingEntries : [current];
    setActionError(null);
    try {
      if (!isBattle && !hasPuzzle && (pendingEntries.length === 1 || skipRemaining)) {
        const result = await completeNode.mutateAsync({
          nodeId,
          data: {
            idempotencyKey: crypto.randomUUID(),
            dialogueSeen: remaining.map((entry) => entry.token),
          },
        });
        applyCampaign(result.campaign, result.bootstrap);
        setGrantedRewards(result.rewards);
        rewardReceipts.show({ id: `story:${nodeId}:${result.rewards.map(reward => reward.id).join(',')}`, title: 'Story rewards', items: result.rewards.map(reward => ({ label: rewardLabel(reward), glyph: reward.kind === 'pack-ticket' ? 'ticket' as const : reward.kind === 'currency' ? (reward.id === 'clout' ? 'cloutStack' as const : 'xp' as const) : 'mastery' as const, image: reward.kind === 'card' ? getCardImage(cards[reward.id]?.id ?? reward.id) : undefined })) });
        setScreen('completed');
        return;
      }
      const result = await saveDialogue.mutateAsync({
        nodeId,
        data: {
          idempotencyKey: crypto.randomUUID(),
          dialogueSeen: remaining.map((entry) => entry.token),
        },
      });
      applyCampaign(result.campaign, result.bootstrap);
      if (skipRemaining || pendingEntries.length === 1) setScreen(hasPuzzle && !isCleared ? 'puzzle' : 'briefing');
    } catch {
      setActionError('Progress could not be saved. Try again before continuing.');
    } finally {
      actionLock.current = false;
    }
  };

  const historyButton = (
    <>
      <button
        type="button"
        onClick={() => setShowHistory(true)}
        disabled={!history.length}
      >
        Dialogue History
      </button>
      <button type="button" onClick={() => setReplayIndex(0)}>
        Replay scenes
      </button>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="story-node-overlay absolute inset-0 z-50 bg-black/95"
    >
      {replayIndex !== null && replayEntries[replayIndex] ? (
        <DialogueView nodeId={nodeId} entry={replayEntries[replayIndex]}
          position={replayEntries.slice(0, replayIndex + 1).filter((entry) => entry.section === replayEntries[replayIndex].section).length}
          total={replayEntries.filter((entry) => entry.section === replayEntries[replayIndex].section).length}
          pending={false} error={null} onClose={() => setReplayIndex(null)} onHistory={() => setShowHistory(true)} historyDisabled={!history.length}
          onNext={() => setReplayIndex(replayIndex + 1 < replayEntries.length ? replayIndex + 1 : null)} onSkip={() => setReplayIndex(null)} />
      ) : screen === 'dialogue' && pendingEntries[0] && (
        <DialogueView
          nodeId={nodeId}
          entry={pendingEntries[0]}
          position={entries.filter((entry) => entry.section === pendingEntries[0].section).length - pendingEntries.length + 1}
          total={entries.filter((entry) => entry.section === pendingEntries[0].section).length}
          pending={pending}
          error={actionError}
          onClose={onClose}
          onHistory={() => setShowHistory(true)}
          historyDisabled={!history.length}
          onNext={() => void advanceDialogue(false)}
          onSkip={() => void advanceDialogue(true)}
        />
      )}

      {replayIndex === null && screen === 'briefing' && isBattle && (
        <BattleBriefing
          battle={storyNode as StoryBattleNode}
          stars={nodeProgress.stars}
          cleared={nodeProgress.cleared}
          historyButton={historyButton}
          onClose={onClose}
          onStart={() => onStartBattle(nodeId)}
        />
      )}

      {replayIndex === null && screen === 'puzzle' && storyNode.puzzle && (
        <StoryPuzzle
          puzzle={storyNode.puzzle}
          nodeId={nodeId}
          onCompleted={(result) => {
            applyCampaign(result.campaign, result.bootstrap);
            setGrantedRewards(result.rewards);
            rewardReceipts.show({ id: `story:${nodeId}:${result.rewards.map(r => r.id).join(',')}`, title: 'Story rewards', items: result.rewards.map(reward => ({ label: rewardLabel(reward), glyph: reward.kind === 'pack-ticket' ? 'ticket' as const : reward.kind === 'currency' ? (reward.id === 'clout' ? 'cloutStack' as const : 'xp' as const) : 'mastery' as const, image: reward.kind === 'card' ? getCardImage(cards[reward.id]?.id ?? reward.id) : undefined })) });
            setScreen('completed');
          }}
          onClose={onClose}
        />
      )}

      {replayIndex === null && screen === 'completed' && !isBattle && (
        <div className="grid h-full place-items-center overflow-y-auto p-6 text-center">
          <div className="max-w-md">
            <img
              src={getAssetUrl(storyNode.scenes.at(-1)?.portraitAssetId ?? 'assets/characters/snitch.webp')}
              alt=""
              className="mx-auto mb-4 h-40 w-40 object-contain drop-shadow-2xl"
            />
            <div className="font-mono text-[9px] uppercase tracking-[.25em] text-primary">
              {nodeProgress.cleared ? 'Location secured' : 'Ready to claim'}
            </div>
            <h2 className="mt-2 font-display text-4xl font-black italic uppercase">{storyNode.title}</h2>
            {storyNode.puzzle && nodeProgress.cleared && (
              <p role="status" className="mt-4 text-sm leading-relaxed text-white/80">
                {nodeProgress.lastOutcome === 'puzzle-skipped' ? storyNode.puzzle.skipText : storyNode.puzzle.solvedText}
              </p>
            )}
            {!!storyNode.rewards.length && (
              <div className="mt-5 border border-primary/25 bg-primary/5 p-4 text-left">
                <div className="font-mono text-[8px] uppercase tracking-widest text-primary">
                  {grantedRewards.length ? 'Added to collection' : 'Node rewards'}
                </div>
                {(grantedRewards.length ? grantedRewards : storyNode.rewards).map((reward, index) => (
                  <div key={`${reward.id}-${index}`} className="mt-2 text-sm text-white/75">{rewardLabel(reward)}</div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-center gap-2 story-briefing__history">
              {historyButton}
              <button type="button" onClick={onClose} className="bg-primary px-7 py-3 font-display font-black italic uppercase text-black">
                Return to Map
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="absolute inset-0 z-20 overflow-y-auto bg-zinc-950 p-5 md:left-auto md:w-[430px] md:border-l md:border-white/15"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-black italic uppercase">Dialogue History</h3>
              <button type="button" onClick={() => setShowHistory(false)} className="border border-white/20 px-3 py-2 font-mono text-[8px] uppercase">Close</button>
            </div>
            <div className="mt-5 space-y-3">
              {history.map((entry) => (
                <div key={entry.token} className="border-l-2 border-primary bg-white/5 p-3">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-primary">{entry.line.speaker}</div>
                  <p className="mt-1 text-sm text-white/75">{entry.line.text}</p>
                </div>
              ))}
              {!history.length && <p className="text-sm text-white/45">No saved dialogue yet.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DialogueView({
  nodeId,
  entry,
  position,
  total,
  pending,
  error,
  onClose,
  onHistory,
  historyDisabled,
  onNext,
  onSkip,
}: {
  nodeId: string;
  entry: SceneEntry;
  position: number;
  total: number;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onHistory: () => void;
  historyDisabled: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  return <StoryStage nodeId={nodeId} section={entry.section} line={entry.line}
    position={position} total={total} pending={pending} error={error} onClose={onClose}
    onHistory={onHistory} historyDisabled={historyDisabled} onNext={onNext} onSkip={onSkip} />;
}

function BattleBriefing({
  battle,
  stars,
  cleared,
  historyButton,
  onClose,
  onStart,
}: {
  battle: StoryBattleNode;
  stars: number;
  cleared: boolean;
  historyButton: React.ReactNode;
  onClose: () => void;
  onStart: () => void;
}) {
  const modifiers = getStoryModifierSummaries(battle.encounter);
  const isBoss = battle.encounter.phases && battle.encounter.phases.length > 0;

  return (
    <div className="story-briefing">
      <div className="story-briefing__bg">
        <img src={getAssetUrl('assets/venues/red-fence-night-court.webp')} alt="" />
      </div>
      <div className="story-briefing__container">
        <div className="story-briefing__header">
          <div className={`story-briefing__title ${isBoss ? 'is-boss' : ''}`}>
            {battle.optional && <span className="eyebrow">Mastery Node</span>}
            {!battle.optional && <span className="eyebrow">{cleared ? 'Mastery replay' : battle.battleType}</span>}
            <h2>{battle.encounter.enemy.name}</h2>
            <p>{battle.encounter.enemy.behaviorProfile} rival · {getMatchRoundLimit(battle.encounter)} rounds · first to two districts</p>
            <div className="story-briefing__history">{historyButton}</div>
          </div>
          <div className="story-briefing__enemy">
            <img src={getAssetUrl(battle.encounter.enemy.portraitAssetId)} alt={battle.encounter.enemy.name} />
          </div>
        </div>

        <div className="story-briefing__dossier">
          {battle.teaching && (
            <div className="story-briefing__section">
              <div className="story-briefing__section-title">Intel</div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm font-semibold">
                {battle.teaching.tips.map(tip => <li key={tip}>{tip}</li>)}
              </ul>
              {battle.teaching.focusMechanics.length > 0 && (
                <div className="mt-3 text-xs font-mono uppercase tracking-wider text-[#c63333] font-bold">
                  Focus: {battle.teaching.focusMechanics.join(', ')}
                </div>
              )}
            </div>
          )}

          {battle.encounter.passive && (
            <div className="story-briefing__section">
              <div className="story-briefing__section-title" style={{ background: '#7e22ce' }}>Enemy Passive</div>
              <div className="mt-2 font-bold text-sm text-purple-900">{battle.encounter.passive.name}</div>
              <p className="mt-1 text-sm font-medium">{battle.encounter.passive.description}</p>
            </div>
          )}

          <div className="story-briefing__grid">
            <div className="story-briefing__card taped">
              <div className="story-briefing__section-title">Encounter Rules</div>
              <div className="mt-2">
                {modifiers.length ? modifiers.map((modifier) => <p key={modifier} className="text-sm font-semibold mb-1">{modifier}</p>) : <p className="text-sm font-semibold">Standard district rules apply.</p>}
              </div>
              {battle.encounter.phases && battle.encounter.phases.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#c8bba3]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#c63333] mb-2 font-bold">Boss Phases</div>
                  <ul className="space-y-2 text-xs font-medium">
                    {battle.encounter.phases.map((phase, index) => <li key={phase.id}><strong>Phase {index + 1}:</strong> {phase.description}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="story-briefing__card taped">
              <div className="story-briefing__section-title">Objectives</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#555] mb-3 font-bold" data-testid="briefing-best-stars">
                Best clear: {Math.min(stars, battle.starObjectives.length)} / {battle.starObjectives.length} stars
              </div>
              <div>
                {battle.starObjectives.map((objective) => (
                  <div key={objective.id} className="story-briefing__objective">
                    <Check size={16} strokeWidth={3} />
                    <span>{objective.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="story-briefing__card taped">
              <div className="story-briefing__section-title">Rewards</div>
              <div className="mt-2 text-sm font-semibold">
                {battle.rewards.map((reward, index) => <p key={`${reward.id}-${index}`} className="mb-1">• {rewardLabel(reward)}</p>)}
                {battle.rewards.length === 0 && <p>No first-clear rewards.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="story-briefing__focus">
          <div className="story-briefing__section-title">
            {battle.teaching.focusCards.length ? 'Focus Cards' : 'Recommended gang cards'}
          </div>
          <div className="story-briefing__focus-cards">
            {(battle.teaching.focusCards.length ? battle.teaching.focusCards : battle.recommendedCollection).map((cardId) => {
              const rarity = catalogCardByEngineId[cardId].rarity;
              return <div key={cardId} aria-label={`${cards[cardId].name}. ${CARD_RARITY_DEFINITIONS[rarity].label} rarity`} className={`story-briefing__focus-card ${getRarityClass(rarity)}`} style={{ display: 'flex', flexDirection: 'column', padding: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                <img src={getCardImage(cards[cardId].id)} alt="" style={{ height: '70px', objectFit: 'contain', width: '100%' }} />
                <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', marginTop: '4px' }}>{cards[cardId].name}</span>
                <span className="story-briefing__focus-rarity">◆ {CARD_RARITY_DEFINITIONS[rarity].label}</span>
                <CardRarityTreatment rarity={rarity} compact />
              </div>
            })}
          </div>
        </div>

        <div className="story-briefing__actions">
          <button type="button" onClick={onClose} className="story-briefing__btn story-briefing__btn--back">
            <ArrowLeft size={24} /> Fall Back
          </button>
          <button type="button" onClick={onStart} className={`story-briefing__btn story-briefing__btn--start ${isBoss ? 'boss' : ''}`}>
            {cleared ? 'Replay Encounter' : 'Engage Target'}
          </button>
        </div>
      </div>
    </div>
  );
}
