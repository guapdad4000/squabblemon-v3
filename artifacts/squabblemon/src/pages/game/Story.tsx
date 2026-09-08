import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
  getStoryChapter,
  getStoryNode,
  type StoryBattleNode,
  type StoryDialogueLine,
  type StoryNode,
  type StoryReward,
} from '@workspace/squabblemon-engine/story';
import { cards, catalogCardByEngineId, getAssetUrl, getCardImage } from '../../data';
import { getStoryModifierSummaries } from '../../gameEngine';
import { StoryCinematic } from '../../components/StoryCinematic';
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
        token: `${node.id}:pre:${index}`,
        section: 'pre' as const,
        line,
      })),
      ...node.postDialogue.map((line, index) => ({
        token: `${node.id}:post:${index}`,
        section: 'post' as const,
        line,
      })),
    ];
  }
  return node.scenes.map((line, index) => ({
    token: `${node.id}:main:${index}`,
    section: 'main' as const,
    line,
  }));
}

function rewardLabel(reward: StoryReward | StoryGrantedReward) {
  if (reward.kind === 'card') return `${cards[reward.id]?.name ?? reward.id} card`;
  if (reward.kind === 'chapter-key') return 'Next chapter key';
  if (reward.kind === 'pack-ticket') return `${reward.amount}x Pack Ticket${reward.amount === 1 ? '' : 's'}`;
  if (reward.kind === 'cosmetic') return `Cosmetic: ${reward.id}`;
  return `+${reward.amount} Street XP`;
}

export function Story({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const storyQuery = useGetPlayerStory();
  const [location, setLocation] = useLocation();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [introCinematicVisible, setIntroCinematicVisible] = useState(false);

  const campaign = storyQuery.data;
  useEffect(() => {
    if (!campaign) return;
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

  const currentChapter = campaign?.chapters.find((chapter) => chapter.id === activeChapterId) ??
    campaign?.chapters.find((chapter) => chapter.status !== 'locked') ??
    campaign?.chapters[0];

  useEffect(() => {
    if (campaign && currentChapter) {
      const key = `chapter_intro_${currentChapter.id}_${campaign.contentVersion}`;
      if (!sessionStorage.getItem(key) && currentChapter.status !== 'cleared') {
        setIntroCinematicVisible(true);
        sessionStorage.setItem(key, 'true');
        sessionStorage.setItem('block_party_opening_seen', 'true');
      }
    }
  }, [campaign, currentChapter]);

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
  if (!campaign.chapters.length) {
    return <div className="h-full grid place-items-center bg-black text-sm text-white/55">No chapters are active.</div>;
  }

  if (introCinematicVisible && currentChapter) {
    return (
      <StoryCinematic
        source="assets/story/chapter-one/media/chapter-opening.mp4"
        poster="assets/story/chapter-one/media/chapter-opening.webp"
        title={currentChapter.title}
        eyebrow={currentChapter.subtitle}
        onComplete={() => setIntroCinematicVisible(false)}
        onSkip={() => setIntroCinematicVisible(false)}
      />
    );
  }

  const nodes = campaign.nodes.filter((node) => node.chapterId === currentChapter!.id);
  const chapterContent = currentChapter ? getStoryChapter(currentChapter.id) : undefined;
  const maxStars = (chapterContent?.nodes.filter((node) => node.kind === 'battle').length ?? 0) * 3;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-black text-white">
      <div
        className="relative flex-1 touch-pan-x touch-pan-y overflow-auto border-b border-white/10 bg-cover bg-center hide-scrollbar"
        style={{ backgroundImage: `url("${getAssetUrl(currentChapter?.mapAssetId || '')}")` }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
        <div className="relative mx-auto h-full min-h-[600px] w-full min-w-[800px] p-12">
          <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden="true">
            {nodes.flatMap((node) =>
              node.prerequisites.map((prerequisiteId) => {
                const prerequisite = nodes.find((item) => item.nodeId === prerequisiteId);
                if (!prerequisite) return null;
                return (
                  <line
                    key={`${prerequisiteId}-${node.nodeId}`}
                    x1={`${prerequisite.mapPosition.x}%`}
                    y1={`${prerequisite.mapPosition.y}%`}
                    x2={`${node.mapPosition.x}%`}
                    y2={`${node.mapPosition.y}%`}
                    stroke={node.status === 'locked' ? 'rgba(255,255,255,.12)' : 'rgba(250,204,21,.58)'}
                    strokeWidth="3"
                    strokeDasharray={node.status === 'locked' ? '5 7' : undefined}
                  />
                );
              }),
            )}
          </svg>

          {nodes.map((node) => {
            const locked = node.status === 'locked';
            const cleared = node.status === 'cleared';
            const recommended = node.nodeId === campaign.recommendedNodeId;
            const isOptionalNode = node.optional;
            return (
              <motion.button
                key={node.nodeId}
                type="button"
                whileHover={locked ? undefined : { scale: 1.12 }}
                whileTap={locked ? undefined : { scale: 0.94 }}
                onClick={() => !locked && setSelectedNodeId(node.nodeId)}
                disabled={locked}
                aria-label={`${node.title}, ${node.status}`}
                className={`absolute z-10 -ml-7 -mt-7 grid h-14 w-14 rotate-45 place-items-center border-[3px] shadow-2xl ${
                  locked
                    ? 'cursor-not-allowed border-zinc-800 bg-zinc-950 text-white/30'
                    : cleared
                      ? (isOptionalNode ? 'border-accent bg-black text-accent' : 'border-primary bg-black text-primary')
                      : (isOptionalNode ? 'border-black bg-accent text-black shadow-[0_0_25px_rgba(225,29,72,.5)]' : 'border-black bg-primary text-black shadow-[0_0_25px_rgba(250,204,21,.5)]')
                }`}
                style={{ left: `${node.mapPosition.x}%`, top: `${node.mapPosition.y}%` }}
              >
                <span className="-rotate-45 font-display text-2xl font-black leading-none">
                  {locked ? '?' : node.kind === 'battle' ? '!' : '·'}
                </span>
                <span className="absolute left-1/2 top-[120%] flex -translate-x-1/2 -rotate-45 flex-col items-center whitespace-nowrap">
                  <span className={`border border-white/10 bg-black/80 px-2 py-1 font-display text-sm font-black italic uppercase ${recommended ? (isOptionalNode ? 'text-accent' : 'text-primary') : 'text-white/75'}`}>
                    {node.title}
                  </span>
                  {recommended && <span className={`mt-1 px-2 py-0.5 font-mono text-[7px] uppercase tracking-widest text-black ${isOptionalNode ? 'bg-accent' : 'bg-primary'}`}>Up next</span>}
                  {node.kind === 'battle' && (
                    <span className="mt-1 flex gap-1 border border-white/10 bg-black/80 px-1.5 py-1">
                      {[1, 2, 3].map((star) => (
                        <span
                          key={star}
                          className={`h-2.5 w-2.5 ${star <= node.stars ? (isOptionalNode ? 'bg-accent' : 'bg-primary') : 'bg-white/20'}`}
                          style={{ clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black via-black/75 to-transparent p-4 pb-16 md:p-6 md:pb-20">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
          <div>
            <div className="pointer-events-auto mb-2 flex max-w-[70vw] gap-1 overflow-x-auto hide-scrollbar">
              {campaign.chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  disabled={chapter.status === 'locked'}
                  onClick={() => setActiveChapterId(chapter.id)}
                  className={`border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${
                    chapter.id === currentChapter?.id
                      ? 'border-primary bg-primary text-black'
                      : chapter.status === 'locked'
                        ? 'border-white/10 text-white/25'
                        : 'border-white/20 bg-black/60 text-white/65'
                  }`}
                >
                  Chapter {chapter.order || 1}
                </button>
              ))}
            </div>
            <h1 className="max-w-[70vw] font-display text-3xl font-black italic uppercase leading-none drop-shadow-md md:text-5xl">
              {currentChapter?.title}
            </h1>
            <p className="mt-1 max-w-[70vw] font-mono text-[9px] uppercase tracking-widest text-primary md:text-xs">
              {currentChapter?.subtitle}
            </p>
          </div>
          <div className="border border-white/10 bg-black/75 px-3 py-2 text-right">
            <div className="font-mono text-[8px] uppercase tracking-widest text-white/50">Progression</div>
            <div className="font-display text-2xl font-black leading-none text-primary">
              {currentChapter?.completedRequiredNodes ?? 0}<span className="text-base text-white/30">/{currentChapter?.totalRequiredNodes ?? 0}</span>
            </div>
            <div className="mt-1 font-mono text-[7px] uppercase text-white/35">
              Boss {currentChapter?.bossStatus}
            </div>
          </div>
        </div>
      </header>

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

function NodeOverlay({
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
  const [sceneIndex, setSceneIndex] = useState(0);
  const [screen, setScreen] = useState<'dialogue' | 'briefing' | 'completed'>('dialogue');
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [grantedRewards, setGrantedRewards] = useState<StoryGrantedReward[]>([]);

  const entries = useMemo(() => (storyNode ? sceneEntries(storyNode) : []), [storyNode]);
  const seen = useMemo(() => new Set(nodeProgress?.dialogueSeen ?? []), [nodeProgress?.dialogueSeen]);
  const pendingEntries = useMemo(() => {
    if (!storyNode) return [];
    const targetSection =
      storyNode.kind !== 'battle' ? 'main' : nodeProgress?.cleared ? 'post' : 'pre';
    return entries.filter((entry) => entry.section === targetSection && !seen.has(entry.token));
  }, [entries, nodeProgress?.cleared, seen, storyNode]);
  const history = entries.filter((entry) => seen.has(entry.token));
  const isBattle = storyNode?.kind === 'battle';
  const pending = completeNode.isPending || saveDialogue.isPending;

  useEffect(() => {
    setSceneIndex(0);
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
    const current = pendingEntries[sceneIndex];
    if (!current) return;
    const remaining = skipRemaining ? pendingEntries.slice(sceneIndex) : [current];
    setActionError(null);
    try {
      if (!isBattle && sceneIndex === pendingEntries.length - 1 || !isBattle && skipRemaining) {
        const result = await completeNode.mutateAsync({
          nodeId,
          data: {
            idempotencyKey: crypto.randomUUID(),
            dialogueSeen: remaining.map((entry) => entry.token),
          },
        });
        applyCampaign(result.campaign, result.bootstrap);
        setGrantedRewards(result.rewards);
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
      if (skipRemaining || sceneIndex === pendingEntries.length - 1) setScreen('briefing');
      else setSceneIndex((index) => index + 1);
    } catch {
      setActionError('Progress could not be saved. Try again before continuing.');
    }
  };

  const historyButton = (
    <button
      type="button"
      onClick={() => setShowHistory(true)}
      disabled={!history.length}
      className="border border-white/15 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-white/55 disabled:opacity-30"
    >
      Dialogue History
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black/95"
    >
      {screen === 'dialogue' && pendingEntries[sceneIndex] && (
        <DialogueView
          entry={pendingEntries[sceneIndex]}
          position={sceneIndex + 1}
          total={pendingEntries.length}
          pending={pending}
          error={actionError}
          onClose={onClose}
          onHistory={() => setShowHistory(true)}
          historyDisabled={!history.length}
          onNext={() => void advanceDialogue(false)}
          onSkip={() => void advanceDialogue(true)}
        />
      )}

      {screen === 'briefing' && isBattle && (
        <BattleBriefing
          battle={storyNode as StoryBattleNode}
          stars={nodeProgress.stars}
          cleared={nodeProgress.cleared}
          historyButton={historyButton}
          onClose={onClose}
          onStart={() => onStartBattle(nodeId)}
        />
      )}

      {screen === 'completed' && !isBattle && (
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
  return (
    <div className="flex h-full flex-col justify-end overflow-hidden">
      <motion.img
        key={entry.line.portraitAssetId}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 0.82, x: 0 }}
        src={getAssetUrl(entry.line.portraitAssetId)}
        alt={entry.line.speaker}
        className="absolute bottom-[28%] left-1/2 max-h-[70%] w-[130%] max-w-[680px] -translate-x-1/2 object-contain object-bottom drop-shadow-2xl"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/30" />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex justify-between">
          <button type="button" onClick={onClose} className="font-mono text-[8px] uppercase tracking-widest text-white/50">Back to map</button>
          <button type="button" onClick={onHistory} disabled={historyDisabled} className="font-mono text-[8px] uppercase tracking-widest text-white/50 disabled:opacity-30">History</button>
        </div>
        <div className="border-l-4 border-primary bg-zinc-950/90 p-5 backdrop-blur-md md:p-8">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl font-black italic uppercase text-primary">{entry.line.speaker}</div>
            <div className="font-mono text-[8px] text-white/35">{position}/{total}</div>
          </div>
          <p className="mt-3 text-lg leading-relaxed text-white md:text-2xl">{entry.line.text}</p>
          {error && <p role="alert" className="mt-3 text-xs text-accent">{error}</p>}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={onSkip} disabled={pending} className="px-2 py-3 font-mono text-[9px] uppercase tracking-widest text-white/45 disabled:opacity-40">Skip remaining</button>
          <button type="button" onClick={onNext} disabled={pending} className="bg-white px-8 py-3 font-display font-black italic uppercase text-black disabled:opacity-50">
            {pending ? 'Saving' : position < total ? 'Next' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
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
            <p className="mt-3 text-sm text-white/55">{battle.encounter.enemy.behaviorProfile} rival · six rounds · first to two districts</p>
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
            <div className="mt-3 space-y-2 text-xs text-white/70">
              {battle.starObjectives.map((objective, index) => (
                <div key={objective.id} className="flex gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rotate-45 ${index < stars ? 'bg-primary' : 'border border-white/25'}`} />
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
            {battle.teaching.focusCards.length ? 'Focus Cards' : 'Recommended crew cards'}
          </h3>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {(battle.teaching.focusCards.length ? battle.teaching.focusCards : battle.recommendedCollection).map((cardId) => {
              const rarity = catalogCardByEngineId[cardId].rarity;
              return <div key={cardId} aria-label={`${cards[cardId].name}. ${rarity} rarity`} className={`relative flex min-w-24 items-center gap-2 border border-white/10 bg-white/5 p-2 overflow-hidden ${getRarityClass(rarity)}`}>
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