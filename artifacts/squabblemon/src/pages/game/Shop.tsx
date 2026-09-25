import { DailyCloutPack } from '../../components/Notifications';
import { LayeredVenue } from '../../components/venue/LayeredVenue';
import { CornerStore } from './CornerStore';
import '../../styles/ui-polish.css';
import { CharacterUnlock } from '../../components/CharacterUnlock';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import { PropArt } from '../../components/venue/PropArt';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { CombatSprite } from '../../components/BattleArt';
import { useLocation, useSearch } from 'wouter';
import { Market } from './Market';
import '../../styles/market.css';
import '../../styles/gacha-stage.css';
import { useEffect, useRef, useState } from 'react';
import {
  getGetPlayerBootstrapQueryKey,
  useOpenPlayerPack,
  type PackOpening,
  type PackReward,
  type PlayerBootstrap,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cardCatalog, catalogCardById, CARD_RARITY_DEFINITIONS, type CardRarity } from '../../data';
import { CardView } from '../../components/CardView';
import { SceneFrame, sendScene } from '../../components/venue/SceneFrame';
import { e2eAuthEnabled } from '../../lib/auth';
import {
  finishPackOpening,
  loadPackOpening,
  loadPackRequest,
  reservePackRequest,
  savePackOpening,
  type PendingPackRequest,
} from '../../lib/packJournal';
import { playSoundEffect, playVoiceLine, stopSoundEffect, type SoundEffect, type VoiceLine } from '../../lib/sfx';
import { loadFeedbackPreferences } from '../../battleFeedback';
import { ArrowRight, Check, History, Info, Volume2, VolumeX, X, Star } from 'lucide-react';

type Phase = 'idle' | 'requesting' | 'punching' | 'tenPunching' | 'knockout' | 'tenKnockout' | 'reveal' | 'summary';
type Payment = 'softCurrency' | 'ticket';
type PullSize = 1 | 10;
const isTenPullOpening = (opening: Pick<PackOpening, 'oddsVersion' | 'pullCount'> | null | undefined) =>
  opening?.pullCount === 10 || /^street-pack-ten-v[12]$/.test(opening?.oddsVersion ?? '');

// Every opening is a three-beat fight: jab, hook, finisher. A ten-pull still
// lands three strikes per input, so its scene can hit harder without becoming
// a thirty-click chore. The awarded result is already secured before this runs.
const HITS_PER_PULL: Record<PullSize, number> = { 1: 3, 10: 9 };
const HITS_PER_CLICK: Record<PullSize, number> = { 1: 1, 10: 3 };
type StrikeIntensity = 'normal' | 'heavy' | 'finisher';
type ScenePunchMessage = { type: 'punch'; intensity?: StrikeIntensity };

const FIGHT_BEATS: readonly {
  round: string;
  move: string;
  direction: string;
  intensity: StrikeIntensity;
}[] = [
  { round: 'Round one', move: 'Test the leather', direction: 'Snap a clean jab.', intensity: 'normal' },
  { round: 'Round two', move: 'Break its guard', direction: 'Turn the shoulder. Land the hook.', intensity: 'heavy' },
  { round: 'Main event', move: 'Finish the bag', direction: 'Put the whole block behind it.', intensity: 'finisher' },
];

const RARITY_RANK: Record<string, number> = {
  SuperCommon: -1,
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythical: 5,
};

const RARITY_CEREMONY: Record<string, { signal: string; title: string; callout: string }> = {
  SuperCommon: { signal: 'Street print', title: 'A familiar face.', callout: 'Every gang starts on the block.' },
  Common: { signal: 'Corner lights', title: 'Someone stepped up.', callout: 'The neighborhood keeps producing fighters.' },
  Uncommon: { signal: 'Green room open', title: 'The room shifts.', callout: 'There is more technique in this one.' },
  Rare: { signal: 'Blue corner lit', title: 'The crowd gets louder.', callout: 'A rare name is walking through the ropes.' },
  Epic: { signal: 'Crimson pressure', title: 'The whole gym stands.', callout: 'A super rare fighter answers the bell.' },
  Legendary: { signal: 'Championship metal', title: 'History enters the ring.', callout: 'The chain only shines for a legend.' },
  Mythical: { signal: 'The block goes silent', title: 'A myth takes the floor.', callout: 'You will remember this pull.' },
  currency: { signal: 'Locker bonus', title: 'The corner came through.', callout: 'Put it back into the gang.' },
};
const PUBLIC_BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

const rewardRarity = (reward: PackReward | undefined) =>
  reward?.rarity && reward.rarity in RARITY_RANK ? reward.rarity : 'currency';

function highestRarity(rewards: readonly PackReward[]) {
  return rewards.reduce(
    (best, reward) => ((RARITY_RANK[reward.rarity ?? ''] ?? -2) > (RARITY_RANK[best] ?? -2) ? reward.rarity! : best),
    'Common',
  );
}

const resourceName = (reward: PackReward) =>
  reward.kind === 'styleShards' ? 'Style shards' : reward.kind === 'softCurrency' ? 'Clout' : (reward.name ?? 'Card');

// Find the index of the rarest reward (≥ Rare) in a haul. Used to badge the
// "GUARANTEED RARE" reward on the ten-pull reveal. Returns -1 if none —
// callers should still render the haul but skip the highlight.
function indexOfRarestReward(rewards: readonly PackReward[]): number {
  let bestIndex = -1;
  let bestRank = 1;
  for (let i = 0; i < rewards.length; i++) {
    const rarity = rewards[i].rarity ?? '';
    const rank = RARITY_RANK[rarity] ?? -2;
    if (rank > bestRank) {
      bestRank = rank;
      bestIndex = i;
    }
  }
  return bestIndex;
}

const rewardDisplayName = (reward: PackReward) => {
  const card = reward.cardId ? catalogCardById[reward.cardId] : undefined;
  return card?.name ?? reward.name ?? resourceName(reward);
};

function RewardCard({ reward, large = false }: { reward: PackReward; large?: boolean }) {
  const card = reward.cardId ? catalogCardById[reward.cardId] : undefined;
  const isDuplicate = reward.kind === 'styleShards' && Boolean(card);
  return (
    <div
      className={`gym-reward ${large ? 'gym-reward--large' : ''} ${isDuplicate ? 'gym-reward--duplicate' : ''}`}
      data-rarity={rewardRarity(reward).toLowerCase()}
    >
      {card && (reward.kind === 'card' || reward.kind === 'variant' || isDuplicate) ? (
        <CardView
          card={card}
          variantId={reward.variantId ?? undefined}
          isInspector={large}
          fillContainer
          presentationOnly
          inspectable={large}
          disableLayout
          className="w-full"
        />
      ) : (
        <div className="gym-reward__resource">
          <GameGlyph name={reward.kind === 'styleShards' ? 'shards' : 'clout'} />
          <strong>+{reward.amount}</strong>
          <span>{resourceName(reward)}</span>
        </div>
      )}
      {reward.isNew && reward.kind !== 'variant' && <span className="gym-reward__new">NEW FIND</span>}
      {reward.kind === 'variant' && <span className="gym-reward__new">STYLE UNLOCKED</span>}
      {isDuplicate && (
        <div className="gym-reward__conversion">
          <GameGlyph name="shards" />
          <span>
            Already on your gang
            <strong>+{reward.amount} Style Shards</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function PackGym({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const queryClient = useQueryClient();
  const openPack = useOpenPlayerPack();
  const frame = useRef<HTMLIFrameElement>(null);
  const arena = useRef<HTMLDivElement>(null);
  const rewardDialog = useRef<HTMLDialogElement>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const rushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealSound = useRef<HTMLAudioElement | null>(null);
  const revealSoundKey = useRef('');
  const rarityVoice = useRef<HTMLAudioElement | null>(null);
  const rarityVoiceKey = useRef('');
  const preview = e2eAuthEnabled && bootstrap.profile.id === 'e2e-player';
  const [pending, setPending] = useState<PendingPackRequest | null>(() =>
    loadPackRequest(sessionStorage, bootstrap.profile.id),
  );
  const [opening, setOpening] = useState<PackOpening | null>(() =>
    loadPackOpening(sessionStorage, bootstrap.profile.id),
  );
  const [phase, setPhase] = useState<Phase>(() =>
    loadPackOpening(sessionStorage, bootstrap.profile.id)?.rewards?.length ? 'summary' : 'idle',
  );
  const [pullSize, setPullSize] = useState<PullSize>(() =>
    isTenPullOpening(opening) ? 10 : pending?.pullCount ?? 1,
  );
  const [hits, setHits] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);
  const [sound, setSound] = useState(() => loadFeedbackPreferences().audioEnabled);
  const [rush, setRush] = useState(false);
  const [info, setInfo] = useState<'odds' | 'history'>('odds');
  const [error, setError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const reduced = bootstrap.profile.settings.reducedMotion || systemReduced;
  // Older production bootstrap payloads predate tenPullConfig. Keep the shop
  // usable during rolling deploys instead of dereferencing an absent config.
  const tenPullConfig = bootstrap.tenPullConfig ?? {
    id: `${bootstrap.packConfig.id}-ten`,
    name: `${bootstrap.packConfig.name} · 10×`,
    oddsVersion: bootstrap.packConfig.oddsVersion,
    pullCount: 10,
    ticketCost: STREET_PACK_RULES.ten.ticketCost,
    softCurrencyCost: STREET_PACK_RULES.ten.softCurrencyCost,
    rewardsPerPull: STREET_PACK_RULES.single.rewards,
    rarePityBonusPerPull: 1,
  };
  const rewards = Array.isArray(opening?.rewards) ? opening.rewards : [];
  const isTenPull = pullSize === 10;
  const selectedTier = isTenPull ? tenPullConfig : bootstrap.packConfig;
  const isPunching = phase === 'punching' || phase === 'tenPunching';
  const hitCap = HITS_PER_PULL[pullSize];
  const hitsPerClick = HITS_PER_CLICK[pullSize];
  const rareHighlightIndex = isTenPull ? indexOfRarestReward(rewards) : -1;
  const rareHighlightReward = rareHighlightIndex >= 0 ? rewards[rareHighlightIndex] : undefined;
  const arrangedRewards = rareHighlightReward
    ? [...rewards.filter((_, index) => index !== rareHighlightIndex), rareHighlightReward]
    : rewards;
  const landedStrikes = Math.min(3, Math.ceil(hits / hitsPerClick));
  const beatIndex = Math.min(2, landedStrikes);
  const fightBeat = FIGHT_BEATS[beatIndex];
  const strikeLabel = fightBeat.intensity === 'finisher'
    ? 'Launch the finisher'
    : isTenPull
      ? fightBeat.intensity === 'heavy' ? 'Triple hook' : 'Triple jab'
      : fightBeat.intensity === 'heavy' ? 'Throw the hook' : 'Snap the jab';
  const omenRarity = highestRarity(rewards);
  const currentReward = arrangedRewards[revealIndex];
  const currentRarity = rewardRarity(currentReward);
  const ceremony = RARITY_CEREMONY[currentRarity] ?? RARITY_CEREMONY.currency;
  const unownedGameplayCards = cardCatalog.filter(card => !bootstrap.profile.ownedCardIds.includes(card.catalogId)).length;
  const unownedCosmeticVariants = cardCatalog.reduce(
    (count, card) => count + card.variantSlots.filter(variant => !bootstrap.profile.ownedVariants.includes(variant.id)).length,
    0,
  );

  useEffect(() => {
    mounted.current = true;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => {
      mounted.current = false;
      preference.removeEventListener('change', update);
      if (rushTimer.current) clearInterval(rushTimer.current);
      stopSoundEffect(revealSound.current);
      stopSoundEffect(rarityVoice.current);
    };
  }, []);
  useEffect(() => {
    sendScene(frame, { type: 'settings', reducedMotion: reduced, sound });
  }, [reduced, sound]);
  useEffect(() => {
    if (phase === 'reveal' || phase === 'summary') {
      if (!rewardDialog.current?.open) rewardDialog.current?.showModal();
    } else rewardDialog.current?.close();
    if (!isPunching) {
      if (rushTimer.current) clearInterval(rushTimer.current);
      rushTimer.current = null;
      setRush(false);
    }
  }, [phase, isPunching]);
  useEffect(() => {
    if (reduced && isPunching) setPhase('summary');
  }, [reduced, isPunching]);
  useEffect(() => {
    if (phase !== 'knockout' && phase !== 'tenKnockout') return;
    playSoundEffect('pack-break', sound, 0.72);
    const timeout = window.setTimeout(() => setPhase(reduced ? 'summary' : 'reveal'), reduced ? 0 : 850);
    return () => clearTimeout(timeout);
  }, [phase, reduced, sound]);
  useEffect(() => {
    if (phase !== 'reveal' || !currentReward || !sound) return;
    const key = `${opening?.id ?? 'opening'}:${revealIndex}`;
    if (revealSoundKey.current === key) return;
    revealSoundKey.current = key;
    stopSoundEffect(revealSound.current);
    const soundName: SoundEffect =
      currentRarity === 'Legendary' || currentRarity === 'Mythical'
        ? 'gacha-legendary'
        : currentRarity === 'Epic'
          ? 'gacha-epic'
          : currentRarity === 'Rare'
            ? revealIndex % 2 ? 'gacha-rare-b' : 'gacha-rare-a'
            : 'gacha-common';
    revealSound.current = playSoundEffect(soundName, true, currentRarity === 'Mythical' ? 1 : 0.78);
  }, [currentRarity, currentReward, opening?.id, phase, revealIndex, sound]);
  useEffect(() => {
    if (phase !== 'reveal' || !currentReward || !sound) return;
    const key = `${opening?.id ?? 'opening'}:${revealIndex}`;
    if (rarityVoiceKey.current === key) return;
    const voiceName: VoiceLine | null =
      currentRarity === 'Rare' ? 'rarity-rare'
        : currentRarity === 'Epic' ? 'rarity-epic'
          : currentRarity === 'Legendary' ? 'rarity-legendary'
            : currentRarity === 'Mythical' ? 'rarity-mythical' : null;
    if (!voiceName) return;
    rarityVoiceKey.current = key;
    stopSoundEffect(rarityVoice.current);
    rarityVoice.current = playVoiceLine(voiceName, true, currentRarity === 'Mythical' ? 1 : 0.9);
  }, [currentRarity, currentReward, opening?.id, phase, revealIndex, sound]);

  const reveal = () => {
    sendScene(frame, { type: 'reset' });
    setRevealIndex(0);
    setPhase(reduced ? 'summary' : 'reveal');
  };
  const handleOpen = async (method: Payment, size: PullSize = 1) => {
    if (busy.current || phase !== 'idle') return;
    const payment = pending?.paymentMethod ?? method;
    const requestedSize = pending?.pullCount ?? size;
    const tier = requestedSize === 10 ? tenPullConfig : bootstrap.packConfig;
    const cost = payment === 'ticket' ? tier.ticketCost : tier.softCurrencyCost;
    const balance = payment === 'ticket' ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
    if (!pending && balance < cost) return;
    busy.current = true;
    playVoiceLine('gacha-intro', sound, 0.9);
    playSoundEffect(requestedSize === 10 ? 'pack-ten' : 'pack-tear', sound, 0.72);
    setPullSize(requestedSize);
    setPhase('requesting');
    setError(null);
    setHits(0);
    setRevealIndex(0);
    try {
      const nextRequest = reservePackRequest(
        sessionStorage,
        bootstrap.profile.id,
        payment,
        () => crypto.randomUUID(),
        requestedSize,
      );
      setPending(nextRequest);
      let result: PackOpening;
      if (preview) {
        // Curated visual fixtures, never a substitute for the server's reward RNG or odds.
        const cards = ['bodega-cat', 'leroy', 'og-dominican', 'big-zoey', 'crossing-guard']
          .map(id => catalogCardById[id]);
        const repeat = requestedSize === 10 ? Array.from({ length: 10 }) : [null];
        const baseCards = repeat.flatMap(() =>
          cards.map((card) => ({
            kind: 'card' as const,
            cardId: card.catalogId,
            variantId: null,
            name: card.name,
            rarity: card.rarity,
            isNew: true,
            amount: 1,
          })),
        );
        const bonusRewards = repeat.map(() => ({
          kind: 'styleShards' as const,
          cardId: null,
          variantId: null,
          name: 'Style shards',
          rarity: null,
          isNew: false,
          amount: 25,
        }));
        result = {
          id: nextRequest.idempotencyKey,
          oddsVersion: requestedSize === 10 ? 'street-pack-ten-v2' : 'preview',
          paymentMethod: payment,
          cost,
          pullCount: requestedSize,
          pityBefore: 0,
          pityAfter: 0,
          createdAt: new Date().toISOString(),
          rewards: [...baseCards, ...bonusRewards],
        };
        queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), {
          ...bootstrap,
          profile: {
            ...bootstrap.profile,
            packTickets: bootstrap.profile.packTickets - (payment === 'ticket' ? cost : 0),
            softCurrency: bootstrap.profile.softCurrency - (payment === 'softCurrency' ? cost : 0),
            packHistory: [result, ...bootstrap.profile.packHistory],
          },
        });
      } else {
        const response = await openPack.mutateAsync({
          data: { ...nextRequest },
        });
        if (!response?.opening?.rewards?.length || !response.bootstrap?.profile)
          throw new Error('Invalid pack response');
        result = response.opening;
        queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), response.bootstrap);
      }
      const guaranteeWasHit =
        requestedSize === 1 &&
        result.pityBefore >= Math.max(0, bootstrap.packConfig.pityLimit - 1);
      if (guaranteeWasHit) playSoundEffect('story-star', sound, 0.9);
      // Keep the awarded reveal resumable across refreshes; retries use the same payment intent.
      savePackOpening(sessionStorage, bootstrap.profile.id, result);
      if (!mounted.current) return;
      setPending(null);
      setOpening(result);
      if (reduced || !sceneReady) setPhase('summary');
      else {
        sendScene(frame, {
          type: 'arm',
          targetHits: HITS_PER_PULL[requestedSize],
          hitsPerPunch: HITS_PER_CLICK[requestedSize],
          omen: highestRarity(result.rewards),
        });
        setPhase(requestedSize === 10 ? 'tenPunching' : 'punching');
        if (window.matchMedia('(max-width: 760px)').matches)
          arena.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    } catch {
      if (mounted.current) {
        setError(
          'The opening could not be confirmed. Retry this opening to recover the result; it will use the same request.',
        );
        setPhase('idle');
      }
    } finally {
      busy.current = false;
    }
  };
  function finish() {
    finishPackOpening(sessionStorage, bootstrap.profile.id);
    setOpening(null);
    setPhase('idle');
    setHits(0);
    setPullSize(1);
    sendScene(frame, { type: 'reset' });
  }
  function toggleRush() {
    if (rushTimer.current) {
      clearInterval(rushTimer.current);
      rushTimer.current = null;
      setRush(false);
      return;
    }
    setRush(true);
    let strikeIndex = beatIndex;
    const punch = () => {
      const intensity = FIGHT_BEATS[Math.min(2, strikeIndex)].intensity;
      sendScene(frame, { type: 'punch', intensity } satisfies ScenePunchMessage);
      playSoundEffect(
        intensity === 'finisher' ? 'vs-impact-c' : intensity === 'heavy' ? 'vs-impact-b' : 'vs-impact-a',
        sound,
        intensity === 'finisher' ? 1 : 0.86,
      );
      strikeIndex += 1;
    };
    punch();
    // The 10-pull's auto-rush tempo is faster than the single pack's. Three
    // hits per tick keeps the bag "dismantling" feel rather than a slow
    // metronome of single punches.
    rushTimer.current = setInterval(
      punch,
      isTenPull ? 180 : 260,
    );
  }
  function landStrike() {
    if (!sceneReady) return;
    sendScene(frame, { type: 'punch', intensity: fightBeat.intensity } satisfies ScenePunchMessage);
    playSoundEffect(
      fightBeat.intensity === 'finisher' ? 'vs-impact-c' : fightBeat.intensity === 'heavy' ? 'vs-impact-b' : 'vs-impact-a',
      sound,
      fightBeat.intensity === 'finisher' ? 1 : 0.86,
    );
    if ('vibrate' in navigator) navigator.vibrate(fightBeat.intensity === 'finisher' ? [24, 35, 55] : 18);
  }
  const showInfo = (tab: 'odds' | 'history') => {
    setInfo(tab);
    infoDialog.current?.showModal();
  };

  return (
    <div
      className="gym venue-page studio-page gacha-stage world-decor-host"
      data-phase={phase}
      data-pull-size={pullSize}
      data-reduced-motion={reduced}
      data-round={isPunching ? beatIndex + 1 : undefined}
      data-omen={omenRarity.toLowerCase()}
    >
      <div className="gym__arena" ref={arena}>
        <LayeredVenue scene="gatcha-bg" />
        <SceneFrame
          kind="gym"
          frameRef={frame}
          onReady={() => {
            setSceneReady(true);
            sendScene(frame, { type: 'settings', reducedMotion: reduced, sound });
          }}
          onMessage={(message) => {
            if (message.type === 'hit') setHits(message.hits ?? 0);
            if (message.type === 'complete' && isPunching)
              setPhase(pullSize === 10 ? 'tenKnockout' : 'knockout');
            if (message.type === 'error') setSceneReady(false);
          }}
        />
        <div className="gym__vignette" />
      </div>
      {isPunching && (
        <header className="gacha-stage__heading">
          <span className="studio-eyebrow">
            <GameGlyph name="pack" /> The pack gym · Street edition
          </span>
          <h1>
            {isTenPull ? (
              <>
                Ten on the
                <br />
                <em>bag.</em>
              </>
            ) : (
              <>
                Unload the
                <br />
                <em>combo.</em>
              </>
            )}
          </h1>
        </header>
      )}
      <button
        className="studio-icon gacha-stage__sound"
        aria-label={sound ? 'Mute gym sound' : 'Enable gym sound'}
        aria-pressed={sound}
        onClick={() => setSound(!sound)}
        title={sound ? 'Sound on' : 'Sound off'}
      >
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <aside className="fight-bill gym__offer" aria-label="Open a pack">
        <div className="fight-bill__inner">
          <header className="fight-bill__header">
            <div className="fight-bill__stars-row">
              <Star size={14} fill="currentColor" strokeWidth={0} />
              <Star size={14} fill="currentColor" strokeWidth={0} />
              <Star size={14} fill="currentColor" strokeWidth={0} />
              <div className="fight-bill__stars-spacer" />
              <nav className="fight-bill__utility" aria-label="Gacha information">
                <button aria-label="Drop rates" onClick={() => showInfo('odds')}>RATES</button>
                <span aria-hidden="true">◆</span>
                <button aria-label="Your openings" onClick={() => showInfo('history')}>HISTORY</button>
              </nav>
            </div>

            <div className="fight-bill__title">
              <svg viewBox="0 0 100 100" className="fight-bill__burst-svg" fill="currentColor">
                <path d="M100 20 L0 0 L70 35 L-10 50 L70 65 L0 100 L100 80 Z" />
              </svg>
              <h2>
                <span className="fight-bill__title-top">FADE</span>
                <span className="fight-bill__title-bottom">RECRUITMENT</span>
              </h2>
              <svg viewBox="0 0 100 100" className="fight-bill__burst-svg" fill="currentColor">
                <path d="M0 20 L100 0 L30 35 L110 50 L30 65 L100 100 L0 80 Z" />
              </svg>
            </div>

            <div className="fight-bill__band">
              <div className="fight-bill__band-stars">
                <Star size={16} fill="currentColor" strokeWidth={0} />
                <Star size={16} fill="currentColor" strokeWidth={0} />
                <Star size={16} fill="currentColor" strokeWidth={0} />
              </div>
              <h3>FIGHT NIGHT</h3>
              <div className="fight-bill__band-stars">
                <Star size={16} fill="currentColor" strokeWidth={0} />
                <Star size={16} fill="currentColor" strokeWidth={0} />
                <Star size={16} fill="currentColor" strokeWidth={0} />
              </div>
            </div>

            <div className="fight-bill__season">
              <div className="fight-bill__season-lines" />
              <h4>
                {preview
                  ? (isTenPull ? 'STREET PACK · 10X' : 'PREVIEW DROP')
                  : (isTenPull ? tenPullConfig.name.toUpperCase() : bootstrap.packConfig.name.toUpperCase())}
              </h4>
              <div className="fight-bill__season-lines" />
            </div>
          </header>

          <div className="fight-bill__grid">
            {/* LEFT COLUMN: TICKET */}
            <div className="fight-bill__col fight-bill__col--side">
              <div className="fight-bill__col-stars">
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
              </div>
              <div className="fight-bill__action-wrap">
                {(() => {
                  const method = 'ticket';
                  const cost = selectedTier.ticketCost;
                  const balance = bootstrap.profile.packTickets;
                  const affordable = balance >= cost;
                  const pendingSize = pending?.pullCount ?? 1;
                  if (pending && (pending.paymentMethod !== method || pendingSize !== pullSize)) return null;
                  const actionLabel = phase === 'requesting'
                    ? `Securing ${isTenPull ? 'ten pulls' : 'your pull'}`
                    : pending
                      ? isTenPull ? 'Retry this 10-pull' : 'Retry this opening'
                      : `Open${isTenPull ? ' 10×' : ''} · ${cost} ${cost === 1 ? 'ticket' : 'tickets'}`;
                  return (
                    <button
                      type="button"
                      className="fight-bill__pay-btn gacha-stage__ticket-choice gacha-stage__ticket-choice--fight"
                      aria-label={actionLabel}
                      disabled={phase !== 'idle' || (!affordable && !pending)}
                      onClick={() => void handleOpen(method, pullSize)}
                    >
                      <img src={`${PUBLIC_BASE}assets/rewards/fight-ticket.webp`} alt="" aria-hidden="true" />
                      <div className="fight-bill__pay-info">
                        <strong>{cost} TICKET{cost === 1 ? '' : 'S'}</strong>
                        <small>{balance.toLocaleString()} OWNED</small>
                      </div>
                      <div className="fight-bill__pay-action">
                        {phase === 'requesting' ? 'SECURING' : pending ? 'RETRY' : 'ADMIT ONE'}
                      </div>
                    </button>
                  );
                })()}
              </div>
              <div className="fight-bill__col-stars">
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
              </div>
            </div>

            {/* MIDDLE COLUMN: SELECTOR & GUARANTEE */}
            <div className="fight-bill__col fight-bill__col--mid">
              <div className="fight-bill__mid-box fight-bill__switch gacha-stage__pull-switch" role="group" aria-label="Pull size">
                 <button
                  type="button"
                  aria-pressed={!isTenPull}
                  disabled={phase !== 'idle' || Boolean(pending)}
                  onClick={() => setPullSize(1)}
                 >
                   1 PULL
                 </button>
                 <button
                  type="button"
                  aria-pressed={isTenPull}
                  disabled={phase !== 'idle' || Boolean(pending)}
                  onClick={() => setPullSize(10)}
                 >
                   10 PULL
                 </button>
              </div>

              <div className="fight-bill__mid-box fight-bill__guarantee">
                 {preview ? (
                   <p className="fight-bill__preview-text">PREVIEW DROP<br/>SAMPLE REWARDS</p>
                 ) : (
                   <div className="fight-bill__guarantee-content">
                     <strong>GUARANTEE</strong>
                     <span
                       className="fight-bill__guarantee-bell"
                       role="progressbar"
                       aria-label="Pack guarantee progress"
                       aria-valuemin={0}
                       aria-valuemax={bootstrap.packConfig.pityLimit}
                       aria-valuenow={bootstrap.profile.packPity}
                       data-ready={bootstrap.profile.packPity >= bootstrap.packConfig.pityLimit - 1}
                     >
                       <span className="fight-bill__bell-handle" aria-hidden="true" />
                       <span className="fight-bill__bell-body">
                         {bootstrap.profile.packPity}/{bootstrap.packConfig.pityLimit}
                       </span>
                       <span className="fight-bill__bell-clapper" aria-hidden="true" />
                     </span>
                     <span>
                       {isTenPull
                         ? '1 RARE+ PER 10-PULL'
                         : unownedCosmeticVariants === 0
                           ? 'ALL FEATURED STYLES OWNED'
                           : `${bootstrap.profile.packPity} / ${bootstrap.packConfig.pityLimit}`}
                     </span>
                   </div>
                 )}
              </div>
            </div>

            {/* RIGHT COLUMN: CLOUT */}
            <div className="fight-bill__col fight-bill__col--side">
              <div className="fight-bill__col-stars">
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
              </div>
              <div className="fight-bill__action-wrap">
                {(() => {
                  const method = 'softCurrency';
                  const cost = selectedTier.softCurrencyCost;
                  const balance = bootstrap.profile.softCurrency;
                  const affordable = balance >= cost;
                  const pendingSize = pending?.pullCount ?? 1;
                  if (pending && (pending.paymentMethod !== method || pendingSize !== pullSize)) return null;
                  const actionLabel = phase === 'requesting'
                    ? `Securing ${isTenPull ? 'ten pulls' : 'your pull'}`
                    : pending
                      ? isTenPull ? 'Retry this 10-pull' : 'Retry this opening'
                      : `Open${isTenPull ? ' 10×' : ''} · ${cost.toLocaleString()} Clout`;
                  return (
                    <button
                      type="button"
                      className="fight-bill__pay-btn gacha-stage__ticket-choice gacha-stage__ticket-choice--clout"
                      aria-label={actionLabel}
                      disabled={phase !== 'idle' || (!affordable && !pending)}
                      onClick={() => void handleOpen(method, pullSize)}
                    >
                      <img src={`${PUBLIC_BASE}assets/rewards/clout-ticket.webp`} alt="" aria-hidden="true" />
                      <div className="fight-bill__pay-info">
                        <strong>{cost.toLocaleString()} CLOUT</strong>
                        <small>{balance.toLocaleString()} OWNED</small>
                      </div>
                      <div className="fight-bill__pay-action">
                        {phase === 'requesting' ? 'SECURING' : pending ? 'RETRY' : 'ADMIT ONE'}
                      </div>
                    </button>
                  );
                })()}
              </div>
              <div className="fight-bill__col-stars">
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
                <Star size={10} fill="currentColor" strokeWidth={0} />
              </div>
            </div>
          </div>

          {error && (
            <p className="fight-bill__error" role="alert">
              {error}
            </p>
          )}

          {isPunching && (
             <div className="fight-bill__secured-overlay">
               <Check size={40} strokeWidth={4} />
               <strong>{preview ? 'PREVIEW LOADED' : 'REWARDS SECURED'}</strong>
               <span>HIT THE BAG 3 TIMES TO REVEAL {isTenPull ? 'THE TEN-PULL' : 'YOUR PACK'}.</span>
             </div>
          )}

        </div>
      </aside>
      {isPunching && (
        <div className="gacha-stage__bag-cue" aria-hidden="true">
          <GameGlyph name="fight" />
          <span>
            <strong>Tap the bag</strong>
            <small>{3 - landedStrikes} hit{3 - landedStrikes === 1 ? '' : 's'} to the reveal</small>
          </span>
        </div>
      )}
      <div className="gacha-stage__ringside">
        {isPunching ? (
          <>
            <div
              className="gacha-stage__rounds"
              role="progressbar"
              aria-label="Rounds to reveal"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={landedStrikes}
            >
              {FIGHT_BEATS.map((beat, index) => (
                <span
                  key={beat.round}
                  className={index < landedStrikes ? 'is-landed' : index === beatIndex ? 'is-live' : ''}
                  title={beat.round}
                >
                  <b>{index + 1}</b>
                </span>
              ))}
            </div>
            <div className="gacha-stage__combo" key={hits} aria-live="polite">
              <span className="gacha-stage__hit-count">{landedStrikes}<small>/3</small></span>
              <div>
                <span className="studio-eyebrow">{fightBeat.round}</span>
                <strong>{landedStrikes === 0 ? 'Hit the bag' : fightBeat.move}</strong>
                <span>{landedStrikes === 0 ? 'Tap the bag itself or use the glove.' : fightBeat.direction}</span>
              </div>
            </div>
            <div className="gacha-stage__punch-actions">
              <button
                type="button"
                className={`gacha-stage__strike gacha-stage__strike--${fightBeat.intensity}`}
                aria-label={strikeLabel}
                title={strikeLabel}
                disabled={!sceneReady}
                onClick={landStrike}
              >
                <GameGlyph name="fight" />
                <span>Hit</span>
                {isTenPull && <small>×{hitsPerClick}</small>}
              </button>
              <div className="gacha-stage__secondary-actions">
                <button
                  type="button"
                  className="studio-text-action"
                  disabled={!sceneReady}
                  aria-pressed={rush}
                  onClick={toggleRush}
                >
                  {rush ? 'Pause rush' : 'Auto rush'}
                </button>
                <button type="button" className="studio-text-action" onClick={reveal}>
                  {isTenPull ? 'Skip to 10× reveal' : 'Skip animation & reveal'} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          phase === 'idle' && (
            <div className="gacha-stage__ready">
              <GameGlyph name="fight" />
              <span>
                Pick a pull. Use a ticket or Clout.
                <small>Then hit the bag three times to open it.</small>
              </span>
            </div>
          )
        )}
      </div>
      {(phase === 'knockout' || phase === 'tenKnockout') && (
        <div className="gacha-stage__knockout" data-pull-size={pullSize} role="status">
          <CombatSprite asset="fight-start-burst" />
          <span>{isTenPull ? 'Ten-pack unleashed' : 'Pack unleashed'}</span>
          <strong>{isTenPull ? 'K.O. ×10' : 'K.O.'}</strong>
          <small>{isTenPull ? 'The whole block felt that.' : 'The block felt that.'}</small>
        </div>
      )}
      <dialog
        ref={rewardDialog}
        className="gym-results studio-results gacha-results"
        data-pull-size={pullSize}
        data-phase={phase}
        data-rarity={currentRarity.toLowerCase()}
        aria-labelledby="gym-results-title"
        onCancel={(e) => {
          e.preventDefault();
          finish();
        }}
      >
        <div className="gacha-results__atmosphere" aria-hidden="true">
          <div className="gacha-results__venue">
            <LayeredVenue scene="gatcha-bg" />
          </div>
          <span className="gacha-results__spotlight gacha-results__spotlight--left" />
          <span className="gacha-results__spotlight gacha-results__spotlight--right" />
          <span className="gacha-results__smoke" />
          <img className="gacha-results__impact" src={`${PUBLIC_BASE}brand/gacha/knockout-impact.webp`} alt="" />
        </div>
        <div className="gym-results__header">
          <span className="studio-eyebrow">
            {isTenPull
              ? preview
                ? 'Preview 10× · Not saved'
                : 'The 10-bag delivered'
              : preview
                ? 'Preview drop · Not saved'
                : 'The bag delivered'}
          </span>
          <button className="studio-icon" aria-label="Close rewards" onClick={finish}>
            <X size={20} />
          </button>
        </div>
        <div className="gacha-results__signal" aria-hidden="true">
          <span />
          <b>{phase === 'reveal' ? ceremony.signal : 'Fight night haul'}</b>
          <span />
        </div>
        <GameGlyph name="pack" className="gacha-results__emblem" />
        <h2 id="gym-results-title">
          {phase === 'reveal' ? ceremony.title : isTenPull ? 'Your main event lineup.' : 'Meet the haul.'}
        </h2>
        <p>
          {phase === 'reveal'
            ? `${ceremony.callout} · Reveal ${revealIndex + 1} of ${arrangedRewards.length}`
            : preview
              ? 'A taste of the drop. Your real collection is unchanged.'
              : isTenPull
                ? 'Ten packs. Sixty rewards. One guaranteed Rare+ — find it highlighted.'
                : 'Added to your collection. Now put them to work.'}
        </p>
        {phase === 'reveal' && currentReward ? (
          <div className="gym-results__single" data-rarity={currentRarity.toLowerCase()}>
            {currentReward.kind === 'card' && currentReward.isNew && styleSetFor(currentReward.cardId) ? <CharacterUnlock key={revealIndex} cardId={currentReward.cardId!}><RewardCard reward={currentReward} large /></CharacterUnlock> : <RewardCard key={revealIndex} reward={currentReward} large />}
            <h3>{rewardDisplayName(currentReward)}</h3>
            <span className="studio-eyebrow">
              {CARD_RARITY_DEFINITIONS[currentReward.rarity as CardRarity]?.label ?? 'Gang resource'}
              {isTenPull && currentReward === rareHighlightReward && (
                <span className="gacha-results__badge"> · GUARANTEED RARE+</span>
              )}
            </span>
            {currentReward.kind === 'styleShards' && currentReward.cardId && (
              <p className="gacha-results__conversion-note">
                Full fighter reveal complete. The extra copy powered up your gang with {currentReward.amount} Style Shards.
              </p>
            )}
          </div>
        ) : (
          <div
            className={`gym-results__grid${isTenPull ? ' gym-results__grid--ten' : ''}`}
            data-pull-size={pullSize}
          >
            {arrangedRewards.map((reward, i) => (
              <button
                key={i}
                className={`gym-results__item${isTenPull && reward === rareHighlightReward ? ' gym-results__item--rare' : ''}`}
                aria-label={`Inspect ${rewardDisplayName(reward)}`}
                onClick={() => {
                  setRevealIndex(i);
                  setPhase('reveal');
                }}
              >
                <RewardCard reward={reward} />
                <strong>{rewardDisplayName(reward)}</strong>
                <small>
                  {CARD_RARITY_DEFINITIONS[reward.rarity as CardRarity]?.label ?? `+${reward.amount}`}
                  {isTenPull && reward === rareHighlightReward && (
                    <span className="gacha-results__badge"> · GUARANTEED</span>
                  )}
                </small>
              </button>
            ))}
          </div>
        )}
        <div className="gym-results__actions">
          {phase === 'reveal' ? (
            <>
              <button
                className="studio-action studio-action--gold"
                onClick={() => {
                  if (revealIndex + 1 < arrangedRewards.length) setRevealIndex(revealIndex + 1);
                  else setPhase('summary');
                }}
              >
                {revealIndex + 1 < arrangedRewards.length
                  ? revealIndex + 2 === arrangedRewards.length && rareHighlightReward
                    ? 'Reveal the headliner'
                    : 'Next reveal'
                  : 'View the haul'}
                <ArrowRight size={18} />
              </button>
              <button className="studio-text-action" onClick={() => setPhase('summary')}>
                Reveal all
              </button>
            </>
          ) : (
            <button className="studio-action studio-action--gold" onClick={finish}>
              {isTenPull ? 'Back to gacha · 10× earned' : 'Back to gacha'}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </dialog>
      <dialog
        ref={infoDialog}
        className="venue-info studio-results gacha-info"
        aria-labelledby="gym-info-title"
        onClick={(e) => {
          if (e.target === infoDialog.current) infoDialog.current.close();
        }}
      >
        <header>
          <div>
            <span className="studio-eyebrow">Know your drop</span>
            <h2 id="gym-info-title">{info === 'odds' ? 'The odds.' : 'Your openings.'}</h2>
          </div>
          <button
            className="studio-icon"
            aria-label="Close pack information"
            onClick={() => infoDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {info === 'odds' ? (
          <>
            {preview ? (
              <p>
                Local preview uses curated sample rewards to test the reveal. Live drop rates and guarantees come from
                your connected account.
              </p>
            ) : (
              <>
                <p>Punches are for the presentation. Your rewards are decided and saved by the server when you open.</p>
                <p data-testid="text-pack-collection-state">
                  {unownedGameplayCards > 0
                    ? `${unownedGameplayCards} gameplay cards remain. The first two card slots protect missing cards when the rolled rarity still has one; they do not silently jump rarity tiers.`
                    : `You own every gameplay card. Card repeats convert to ${STREET_PACK_RULES.duplicateStyleShards} Style Shards.`}
                  {' '}
                  {unownedCosmeticVariants > 0
                    ? `${unownedCosmeticVariants} featured cosmetic variants remain.`
                    : `You own every featured cosmetic variant, so a featured-style result converts to ${STREET_PACK_RULES.bonus.exhaustedStyleClout} Clout and cosmetic pity resets.`}
                </p>
                <div className="gym-odds">
                  {bootstrap.packConfig.odds.map((odd, i) => (
                    <div key={i}>
                      <span>
                        <strong>{odd.label}</strong>
                        <small>{odd.detail}</small>
                      </span>
                      <b>{odd.chance}%</b>
                    </div>
                  ))}
                </div>
                <p className="gacha-info__version">
                  Odds version {bootstrap.packConfig.oddsVersion} · Guarantee limit {bootstrap.packConfig.pityLimit}
                </p>
              </>
            )}
          </>
        ) : bootstrap.profile.packHistory.length ? (
          <div className="gym-history">
            {bootstrap.profile.packHistory.map((item) => (
              <article key={item.id}>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <strong>
                  {isTenPullOpening(item) ? '10× · ' : ''}{item.cost} {item.paymentMethod === 'ticket' ? 'ticket(s)' : 'Clout'}
                </strong>
                <p>{item.rewards.map((r) => r.name ?? resourceName(r)).join(' · ')}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="gacha-info__empty">
            <GameGlyph name="pack" />
            <h3>Your first drop is waiting.</h3>
            <p>Every opening will show up here.</p>
          </div>
        )}
      </dialog>
    </div>
  );
}

export function Shop({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const tab = view === 'corner' ? 'corner' :
    view === 'training' || view === 'market' || (view !== 'packs' && (params.has('item') || params.has('card')))
      ? 'market'
      : 'packs';
  function selectTab(next: 'market' | 'packs' | 'corner') {
    const query = new URLSearchParams(search);
    query.set('view', next === 'market' ? 'training' : next);
    navigate(`/game/shop?${query}`);
  }
  return (
    <div className="trading-post">
      <nav className="market-tabs" aria-label="Shop departments">
        <button aria-pressed={tab === 'packs'} onClick={() => selectTab('packs')}>
          <GameGlyph name="pack" />
          Recruit
        </button>
        <button aria-pressed={tab === 'market'} onClick={() => selectTab('market')}>
          <GameGlyph name="motion" />
          Training
        </button>
        <button aria-pressed={tab === 'corner'} onClick={() => selectTab('corner')}><GameGlyph name="cloutBag" />Fade Market</button>
      </nav>
      <DailyCloutPack playerId={bootstrap.profile.id} />
      {tab === 'corner' ? <CornerStore key={bootstrap.profile.id} bootstrap={bootstrap} /> : tab === 'market' ? (
        <Market bootstrap={bootstrap} openPacks={() => selectTab('packs')} />
      ) : (
        <PackGym bootstrap={bootstrap} />
      )}
    </div>
  );
}
