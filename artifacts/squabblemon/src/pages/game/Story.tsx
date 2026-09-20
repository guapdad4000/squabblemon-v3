import { rewardReceipts } from '../../lib/rewardReceipts';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { PageDecor } from '../../components/venue/PageDecor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Crown, LockKeyhole, MessageCircle, Star, Ticket } from 'lucide-react';
import '../../styles/studio.css';
import '../../styles/story-map.css';
import '../../styles/cinema-atlas.css';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
  type StoryBattleNode,
  type StoryDialogueLine,
  type StoryNode,
  type StoryReward,
} from '@workspace/squabblemon-engine/story';
import { cards, catalogCardByEngineId, getAssetUrl, getCardImage, CARD_RARITY_DEFINITIONS } from '../../data';
import { getMatchRoundLimit, getStoryModifierSummaries } from '../../gameEngine';
import { StoryStage } from '../../components/story/StoryStage';
import {
  ChapterTicketProgress,
  ThreeStarResults,
} from '../../components/story';
import { CardRarityTreatment, getRarityClass } from '../../components/CardRarityTreatment';

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
  if (reward.kind === 'card') return `${cards[reward.id]?.name ?? reward.id} card`;
  if (reward.kind === 'chapter-key') return 'Next chapter key';
  if (reward.kind === 'pack-ticket')
    return reward.amount === 10
      ? '10× Street Pack Tickets · One upgraded ten-pull'
      : `${reward.amount}x Pack Ticket${reward.amount === 1 ? '' : 's'}`;
  if (reward.kind === 'cosmetic') return `Cosmetic: ${reward.id}`;
  if (reward.kind === 'character-unlock') return `${STORY_CHARACTERS.find((character) => character.id === reward.id)?.name ?? reward.id} unlocked`;
  return `+${reward.amount} Street XP`;
}

export function Story({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const storyQuery = useGetPlayerStory();
  const mapViewport = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useLocation();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);

  const campaign = storyQuery.data;
  useEffect(() => {
    if (!campaign || typeof campaign !== 'object' || !Array.isArray(campaign.nodes)) return;
    const requestedNode = new URLSearchParams(window.location.search).get('node');
    const requestedProgress = campaign.nodes.find((node) => node.nodeId === requestedNode);
    if (requestedProgress && requestedProgress.status !== 'locked') {
      setSelectedNodeId(requestedProgress.nodeId);
      setActiveChapterId(requestedProgress.chapterId);
      return;
    }
    const recommended = campaign.nodes.find((node) => node.nodeId === campaign.recommendedNodeId);
    setActiveChapterId((current) => current ?? recommended?.chapterId ?? campaign.chapters[0]?.id ?? null);
  }, [campaign, location]);

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
  }, [currentChapter?.id, campaign?.recommendedNodeId, campaign?.nodes]);
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
        <Link href="/game" className="story-atlas__back" aria-label="Back to Safehouse">
          <ArrowLeft size={14} /> Safehouse
        </Link>
        <nav className="story-reels" aria-label="Chapters">
          {campaign.chapters.filter(chapter => chapter.status !== 'locked').map((chapter) => {
            const active = chapter.id === currentChapter?.id;
            return (
              <button
                key={chapter.id}
                type="button"
                disabled={chapter.status === 'locked'}
                aria-pressed={active}
                aria-current={active ? 'true' : undefined}
                onClick={() => setActiveChapterId(chapter.id)}
                className={`story-reel ${active ? 'is-active' : ''} ${chapter.status === 'locked' ? 'is-locked' : ''}`}
              >
                <span className="story-reel__sprockets" aria-hidden="true" />
                <span className="story-reel__label">
                  <small>Chapter {String(chapter.order || 1).padStart(2, '0')}</small>
                  <strong>{chapter.title}</strong>
                </span>
                {chapter.status === 'locked' && <LockKeyhole size={11} className="story-reel__lock" />}
              </button>
            );
          })}
        </nav>
        <h1 className="story-title">{currentChapter?.title}</h1>
      </header>

      <div ref={mapViewport} className="story-atlas__viewport" aria-label="Campaign map. Scroll to explore the territory.">
        <div className="story-atlas__terrain" style={{ backgroundImage: `url("${getAssetUrl(currentChapter?.mapAssetId || '')}")` }}>
          <div className="story-atlas__wash" />
          <img
            src={getAssetUrl('brand/story-cinematic/projector-beam.jpg')}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, mixBlendMode: 'screen', pointerEvents: 'none', zIndex: 0 }}
          />
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
                  if (!locked) setSelectedNodeId(node.nodeId);
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
                    setSelectedNodeId(nodeId);
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
            nodeId={selectedNodeId}
            campaign={campaign}
            onClose={() => {
              setSelectedNodeId(null);
              if (window.location.search) setLocation('/game/story', { replace: true });
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
  const [screen, setScreen] = useState<'dialogue' | 'briefing' | 'completed'>('dialogue');
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
  const pending = completeNode.isPending || saveDialogue.isPending;

  useEffect(() => {
    setActionError(null);
    if (pendingEntries.length) setScreen('dialogue');
    else setScreen(isBattle ? 'briefing' : 'completed');
  }, [isBattle, nodeId, pendingEntries.length]);

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
      if (!isBattle && (pendingEntries.length === 1 || skipRemaining)) {
        const result = await completeNode.mutateAsync({
          nodeId,
          data: {
            idempotencyKey: crypto.randomUUID(),
            dialogueSeen: remaining.map((entry) => entry.token),
          },
        });
        applyCampaign(result.campaign, result.bootstrap);
        setGrantedRewards(result.rewards);
        rewardReceipts.show({ id: `story:${nodeId}:${result.rewards.map(reward => reward.id).join(',')}`, title: 'Story rewards', items: result.rewards.map(reward => ({ label: rewardLabel(reward), glyph: reward.kind === 'pack-ticket' ? 'ticket' as const : reward.kind === 'currency' ? 'xp' as const : 'mastery' as const, image: reward.kind === 'card' ? getCardImage(cards[reward.id]?.id ?? reward.id) : undefined })) });
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
      if (skipRemaining || pendingEntries.length === 1) setScreen('briefing');
    } catch {
      setActionError('Progress could not be saved. Try again before continuing.');
    } finally {
      actionLock.current = false;
    }
  };

  const historyButton = (
    <div className="flex flex-wrap gap-2">
    <button
      type="button"
      onClick={() => setShowHistory(true)}
      disabled={!history.length}
      className="border border-white/15 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-white/55 disabled:opacity-30"
    >
      Dialogue History
    </button>
    <button type="button" onClick={() => setReplayIndex(0)} className="border border-white/15 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-white/55">Replay scenes</button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="story-node-overlay absolute inset-0 z-50 bg-black/95"
    >
      {replayIndex !== null && replayEntries[replayIndex] ? (
        <DialogueView entry={replayEntries[replayIndex]}
          position={replayEntries.slice(0, replayIndex + 1).filter((entry) => entry.section === replayEntries[replayIndex].section).length}
          total={replayEntries.filter((entry) => entry.section === replayEntries[replayIndex].section).length}
          pending={false} error={null} onClose={() => setReplayIndex(null)} onHistory={() => setShowHistory(true)} historyDisabled={!history.length}
          onNext={() => setReplayIndex(replayIndex + 1 < replayEntries.length ? replayIndex + 1 : null)} onSkip={() => setReplayIndex(null)} />
      ) : screen === 'dialogue' && pendingEntries[0] && (
        <DialogueView
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
            <div className="mt-6 flex justify-center gap-2">
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
  return <StoryStage nodeId={entry.token.split(':')[0]} section={entry.section} line={entry.line}
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
    <div className="h-full overflow-y-auto p-4 pb-[max(2rem,env(safe-area-inset-bottom))] md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className={`grid min-h-56 overflow-hidden border border-white/10 ${isBoss ? 'bg-[radial-gradient(circle_at_20%_30%,rgba(225,29,72,.15),transparent_45%),#090909]' : 'bg-[radial-gradient(circle_at_20%_30%,rgba(250,204,21,.15),transparent_45%),#090909]'} md:grid-cols-[260px_1fr]`}>
          <img src={getAssetUrl(battle.encounter.enemy.portraitAssetId)} alt={battle.encounter.enemy.name} className="h-56 w-full object-contain object-bottom md:h-full" />
          <div className="p-5 md:p-8">
            {battle.optional && <div className="font-mono text-[9px] uppercase tracking-[.22em] text-accent mb-2 border border-accent/30 bg-accent/10 inline-block px-2 py-0.5">Mastery Node</div>}
            <div className={`font-mono text-[9px] uppercase tracking-[.22em] ${isBoss ? 'text-accent' : 'text-primary'}`}>{cleared ? 'Mastery replay' : battle.battleType}</div>
            <h2 className={`mt-2 font-display text-4xl font-black italic uppercase leading-none md:text-6xl ${isBoss ? 'text-white drop-shadow-[0_2px_12px_rgba(225,29,72,0.8)]' : ''}`}>{battle.encounter.enemy.name}</h2>
            <p className="mt-3 text-sm text-white/55">{battle.encounter.enemy.behaviorProfile} rival · {getMatchRoundLimit(battle.encounter)} rounds · first to two districts</p>
            <div className="mt-5 flex gap-2">{historyButton}</div>
          </div>
        </div>

        {battle.teaching && (
          <section className="border border-primary/20 bg-primary/5 p-4 mt-4">
            <h3 className="font-mono text-[8px] uppercase tracking-widest text-primary">Intel</h3>
            <ul className="mt-3 space-y-2 text-xs text-white/80 list-disc pl-4">
              {battle.teaching.tips.map(tip => <li key={tip}>{tip}</li>)}
            </ul>
            {battle.teaching.focusMechanics.length > 0 && (
              <div className="mt-3 text-[10px] text-white/50 font-mono uppercase tracking-wider border-t border-primary/20 pt-2">Focus: {battle.teaching.focusMechanics.join(', ')}</div>
            )}
          </section>
        )}

        {battle.encounter.passive && (
          <section className="border border-purple-500/30 bg-purple-500/10 p-4 mt-4">
            <h3 className="font-mono text-[8px] uppercase tracking-widest text-purple-400">Enemy Passive</h3>
            <div className="mt-2 font-bold text-sm text-purple-200">{battle.encounter.passive.name}</div>
            <p className="mt-1 text-xs text-white/70">{battle.encounter.passive.description}</p>
          </section>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <section className="border border-white/10 bg-white/5 p-4">
            <h3 className="font-mono text-[8px] uppercase tracking-widest text-primary">Encounter rules</h3>
            <div className="mt-3 space-y-2 text-xs text-white/70">
              {modifiers.length ? modifiers.map((modifier) => <p key={modifier}>{modifier}</p>) : <p>Standard district rules apply.</p>}
            </div>
            {battle.encounter.phases && battle.encounter.phases.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <h4 className="font-mono text-[8px] uppercase text-accent mb-2">Boss Phases</h4>
                <ul className="space-y-2 text-[10px] text-white/60">
                  {battle.encounter.phases.map((phase, index) => <li key={phase.id}><span className="text-white">Phase {index + 1}:</span> {phase.description}</li>)}
                </ul>
              </div>
            )}
          </section>
          <section className="border border-white/10 bg-white/5 p-4">
            <h3 className="font-mono text-[8px] uppercase tracking-widest text-primary">Star objectives</h3>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-white/45" data-testid="briefing-best-stars">
              Best clear: {Math.min(stars, battle.starObjectives.length)} / {battle.starObjectives.length} stars
            </p>
            <div className="mt-3 space-y-2 text-xs text-white/70">
              {battle.starObjectives.map((objective) => (
                <div key={objective.id} className="flex gap-2">
                  <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rotate-45 border border-white/30 bg-white/5" />
                  <span>{objective.description}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="border border-white/10 bg-white/5 p-4">
            <h3 className="font-mono text-[8px] uppercase tracking-widest text-primary">First-clear rewards</h3>
            <div className="mt-3 space-y-2 text-xs text-white/70">
              {battle.rewards.map((reward, index) => <p key={`${reward.id}-${index}`}>{rewardLabel(reward)}</p>)}
            </div>
          </section>
        </div>

        <section className="mt-3 border border-white/10 bg-black p-4">
          <h3 className="font-mono text-[8px] uppercase tracking-widest text-primary">
            {battle.teaching.focusCards.length ? 'Focus Cards' : 'Recommended gang cards'}
          </h3>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {(battle.teaching.focusCards.length ? battle.teaching.focusCards : battle.recommendedCollection).map((cardId) => {
              const rarity = catalogCardByEngineId[cardId].rarity;
              return <div key={cardId} aria-label={`${cards[cardId].name}. ${CARD_RARITY_DEFINITIONS[rarity].label} rarity`} className={`relative flex min-w-24 items-center gap-2 border border-white/10 bg-white/5 p-2 overflow-hidden ${getRarityClass(rarity)}`}>
                <img src={getCardImage(cards[cardId].id)} alt="" className="h-12 w-9 object-cover" />
                <span className="font-display text-xs font-bold uppercase">{cards[cardId].name}</span>
                <CardRarityTreatment rarity={rarity} compact />
              </div>
            })}
          </div>
        </section>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-white/20 bg-black py-4 font-display font-black italic uppercase hover:bg-white/5 transition-colors">Fall Back</button>
          <button type="button" onClick={onStart} className={`flex-[2] py-4 font-display font-black italic uppercase text-black transition-transform active:translate-y-1 ${isBoss ? 'bg-accent shadow-[0_4px_0_#9f1239]' : 'bg-primary shadow-[0_4px_0_#854d0e]'}`}>
            {cleared ? 'Replay Encounter' : 'Engage Target'}
          </button>
        </div>
      </div>
    </div>
  );
}
