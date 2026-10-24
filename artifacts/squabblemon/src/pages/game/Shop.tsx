import { playTutorialSequence } from '../../lib/tutorialVoice';
import { WELCOME_PULL_KEY, WELCOME_PULL_LINES } from '../../lib/welcomePull';
import { rewardReceipts } from '../../lib/rewardReceipts';
import { warmPackRewardArtwork } from '../../lib/packRewardArtwork';
import { highestPackRewardRarity as highestRarity, PACK_REWARD_RARITY_RANK as RARITY_RANK } from '../../lib/packRewardRarity';
import { GymVenue, GYM_BAG_POSTER } from '../../components/venue/GymVenue';
import { CornerStore } from './CornerStore';
import '../../styles/ui-polish.css';
import { PULL_BANNERS, getPullBannerSchedule, getPullBannerOccurrence, isPullBannerActive, pullBannerOddsVersion, pullBannerReceiptIdentity } from "@workspace/squabblemon-engine/pullBanners";
import { STREET_PACK_RULES, affordableStreetPacks, streetPackCost, packReceiptPullCount, isPullCount, type PullCount, type PullSeasonProgress } from '@workspace/squabblemon-engine/packRules';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { useLocation, useSearch } from 'wouter';
import { Market } from './Market';
import { NeighborhoodRecruit } from '../../components/NeighborhoodRecruit';
import { LegacyTicketRecovery } from '../../components/LegacyTicketRecovery';
import { readShopRequest } from '../../lib/shopJournal';
import { shopPurchaseDestination } from '../../lib/shopDestination';
import '../../styles/market.css';
import '../../styles/gacha-stage.css';
import '../../styles/gacha-cinematic.css';
import '../../styles/paper-tabs.css';
import { GachaRevealSequence, rewardResourceName as resourceName } from '../../components/GachaRevealSequence';
import { PackGymFinale, preloadPackGymFinale } from '../../components/PackGymFinale';
export { RewardCard } from '../../components/GachaRevealSequence';
import '../../styles/pull-banners.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  useOpenPlayerPack,
  type PackOpening,
  type PackReward,
  type PlayerBootstrap,
} from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cardCatalog, catalogCardById, getCardImage, CARD_RARITY_DEFINITIONS } from '../../data';
import { SceneFrame, sendScene } from '../../components/venue/SceneFrame';
import { e2eAuthEnabled } from '../../lib/auth';
import {
  finishPackOpening,
  loadPackOpening,
  loadPackRequest,
  reservePackRequest,
  saveCurrentPackOpening,
  type PendingPackRequest,
} from '../../lib/packJournal';
import { playSoundEffect, playVoiceLine, stopSoundEffect, type SoundEffect, type VoiceLine } from '../../lib/sfx';
import { loadFeedbackPreferences, FEEDBACK_CHANGE_EVENT } from '../../battleFeedback';
import { ArrowLeft, ArrowRight, Star, X } from 'lucide-react';

type Phase = 'idle' | 'requesting' | 'punching' | 'tenPunching' | 'knockout' | 'tenKnockout' | 'reveal' | 'summary';
type Payment = 'softCurrency' | 'ticket';
type PullSize = PullCount;
const bannerDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
const bannerDateLabel = (value: string) => `${bannerDateFormat.format(new Date(value))} UTC`;

// Every opening is a three-beat fight: jab, hook, finisher. A ten-pull still
// lands three strikes per input, so its scene can hit harder without becoming
// a thirty-click chore. The awarded result is already secured before this runs.
const hitsForPull = (count: PullSize) => count === 10 ? 9 : 3;
const hitsPerPunch = (count: PullSize) => count === 10 ? 3 : 1;
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

const PUBLIC_BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

const rewardRarity = (reward: PackReward | undefined) =>
  reward?.rarity && reward.rarity in RARITY_RANK ? reward.rarity : 'currency';

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

function PackGym({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const queryClient = useQueryClient();
  const openPack = useOpenPlayerPack();
  const frame = useRef<HTMLIFrameElement>(null);
  const arena = useRef<HTMLDivElement>(null);
  const rewardDialog = useRef<HTMLDialogElement>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const revealSound = useRef<HTMLAudioElement | null>(null);
  const revealSoundKey = useRef('');
  const rarityVoice = useRef<HTMLAudioElement | null>(null);
  const rarityVoiceKey = useRef('');
  const preview = e2eAuthEnabled && bootstrap.profile.id === 'e2e-player';
  const welcome = useQuery({ queryKey: ['welcome-pull', bootstrap.profile.id],
    queryFn: async () => {
      const response = await customFetch<{ available: boolean; serverNow?: number; supportsFlexibleBatches?: boolean; pullSeason?: PullSeasonProgress }>('/api/player/packs/welcome');
      return { ...response, receivedAt: performance.now() };
    }, enabled: !preview,
    staleTime: 0, retry: 1 });
  const [welcomeStep, setWelcomeStep] = useState<'intro' | 'ticket'>('intro');
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
    opening ? (isPullCount(opening.pullCount) ? opening.pullCount : packReceiptPullCount(opening.oddsVersion)) : pending?.pullCount ?? 1,
  );
  // Restored receipts bypass punching; warm their actual art as soon as mounted.
  useEffect(() => { if (opening) void warmPackRewardArtwork(opening.rewards); }, [opening]);
  const isWelcomeOpening = opening?.oddsVersion === WELCOME_PULL_KEY;
  const [bannerId, setBannerId] = useState<string>(() => pending?.bannerId ?? (opening ? pullBannerReceiptIdentity(opening.oddsVersion).bannerId : new URLSearchParams(location.search).get('banner') === 'neighborhood' || readShopRequest(sessionStorage, bootstrap.profile.id)?.itemId === 'common-recruit' ? 'neighborhood' : 'standard'));
  const [directPurchaseBusy, setDirectPurchaseBusy] = useState(false);
  const neighborhood = bannerId === 'neighborhood' && !pending && !opening;
  const welcomeOffer = !neighborhood && !opening && !preview && (pending?.idempotencyKey === WELCOME_PULL_KEY || (!pending && welcome.data?.available));
  const [bannerNow, setBannerNow] = useState(Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      // Server time plus monotonic elapsed time survives a wrong or changing device clock.
      // Older API responses and visual fixtures retain the local-clock fallback; purchases
      // are still checked against the server's occurrence before any wallet mutation.
      const serverNow = welcome.data?.serverNow;
      const receivedAt = welcome.data?.receivedAt;
      const now = typeof serverNow === 'number' && Number.isFinite(serverNow) && typeof receivedAt === 'number' && Number.isFinite(receivedAt)
        ? serverNow + Math.max(0, performance.now() - receivedAt)
        : Date.now();
      setBannerNow(now);
      const boundary = Date.parse(getPullBannerSchedule(now).next.startsAt!);
      timer = setTimeout(update, Math.max(1, Math.min(10000, boundary - now)));
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [welcome.data?.serverNow, welcome.data?.receivedAt]);
  const schedule = getPullBannerSchedule(bannerNow);
  const availableBanners = [schedule.standard, ...(schedule.featured ? [schedule.featured] : [])];
  const savedOccurrence = pending?.bannerOccurrenceId ?? pullBannerReceiptIdentity(opening?.oddsVersion).occurrenceId;
  const banner = getPullBannerOccurrence(savedOccurrence)
    ?? availableBanners.find(item => item.id === bannerId)
    ?? { ...(PULL_BANNERS.find(item => item.id === bannerId) ?? PULL_BANNERS[0]), startsAt: null, endsAt: null, occurrenceId: null };
  const bannerIds = [...availableBanners.map(item => item.id), 'neighborhood'];
  const bannerIndex = neighborhood ? availableBanners.length : availableBanners.findIndex(item => item.id === banner.id);
  const browseLocked = phase !== 'idle' || Boolean(pending) || directPurchaseBusy;
  const cycleBanner = (direction: number) => {
    if (browseLocked || !availableBanners.length) return;
    const nextIndex = bannerIndex < 0 ? 0 : (bannerIndex + direction + bannerIds.length) % bannerIds.length;
    setBannerId(bannerIds[nextIndex]);
    setError(null);
  };
  useEffect(() => {
    const current = getPullBannerSchedule(bannerNow);
    const active = [current.standard, ...(current.featured ? [current.featured] : [])];
    const index = active.findIndex(item => item.id === banner.id);
    for (const direction of [-1, 1]) {
      const neighbor = active[(Math.max(0, index) + direction + active.length) % active.length];
      if (neighbor && neighbor.id !== banner.id) {
        const image = new Image();
        image.src = `${PUBLIC_BASE}assets/gacha-banners/${neighbor.id}-v1.webp`;
      }
    }
  }, [banner.id, schedule.featured?.occurrenceId]);
  const bannerActive = isPullBannerActive(banner, bannerNow);
  const bannerRemaining = banner.endsAt ? Math.max(0, Date.parse(banner.endsAt) - bannerNow) : 0;
  const bannerTime = !bannerActive ? (banner.startsAt && bannerNow < Date.parse(banner.startsAt) ? 'Coming soon' : 'Ended') : `${Math.floor(bannerRemaining / 86400000)}d ${Math.floor(bannerRemaining / 3600000) % 24}h ${Math.floor(bannerRemaining / 60000) % 60}m left`;
  const [hits, setHits] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);
  const [revealPrepared, setRevealPrepared] = useState(false);
  const [sound, setSound] = useState(() => loadFeedbackPreferences().audioEnabled);
  // The gym opening has its own authored pace; PvE battle speed must not rush its shots.
  const presentationSpeed = 1;
  const pullSound = useRef<HTMLAudioElement | null>(null);
  const playPullCue = (name: 'pack-tear' | 'pack-ten' | 'pack-break', volume: number) => {
    stopSoundEffect(pullSound.current);
    pullSound.current = playSoundEffect(name, sound, volume, { playbackRate: presentationSpeed });
  };
  useEffect(() => {
    const update = () => setSound(loadFeedbackPreferences().audioEnabled);
    window.addEventListener(FEEDBACK_CHANGE_EVENT, update);
    return () => { window.removeEventListener(FEEDBACK_CHANGE_EVENT, update); stopSoundEffect(pullSound.current); };
  }, []);
  const [info, setInfo] = useState<'odds' | 'history'>('odds');
  const [error, setError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => { if (neighborhood) setSceneReady(false); }, [neighborhood]);
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
  const selectedTier = isTenPull ? tenPullConfig : { ...bootstrap.packConfig, ...streetPackCost(pullSize) };
  const isPunching = phase === 'punching' || phase === 'tenPunching';
  const isFinale = phase === 'knockout' || phase === 'tenKnockout';
  const preparingReveal = isFinale && revealPrepared;
  const hitsPerClick = hitsPerPunch(pullSize);
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
  const welcomeVoiceCue = welcomeOffer && phase === 'idle'
    ? `welcome-pull-${pending ? 'ticket' : welcomeStep}`
    : isWelcomeOpening && isPunching && landedStrikes < 3
      ? `welcome-pull-${(['jab', 'hook', 'finish'] as const)[beatIndex]}`
      : isWelcomeOpening && (phase === 'reveal' || phase === 'summary')
        ? ['welcome-pull-reveal', ...(rewards[0]?.kind === 'styleShards' ? ['welcome-pull-duplicate'] : []), 'welcome-pull-done'].join(',')
        : '';
  useEffect(() => {
    if (!sound || !welcomeVoiceCue) return;
    return playTutorialSequence(welcomeVoiceCue.split(','));
  }, [sound, welcomeVoiceCue]);
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
      stopSoundEffect(revealSound.current);
      stopSoundEffect(rarityVoice.current);
    };
  }, []);
  useEffect(() => {
    sendScene(frame, { type: 'settings', reducedMotion: reduced, sound, speed: presentationSpeed });
  }, [reduced, sound, presentationSpeed]);
  // Move the saved result into the top layer in the same paint that removes
  // the final arena plate; an ordinary effect flashes the idle shop in between.
  useLayoutEffect(() => {
    if (phase === 'reveal' || phase === 'summary') {
      if (!rewardDialog.current?.open) rewardDialog.current?.showModal();
    } else rewardDialog.current?.close();
  }, [phase]);
  useEffect(() => {
    // The receipt is already saved; a lost or reloading room cannot strand it.
    if ((reduced || !sceneReady) && (isPunching || isFinale)) {
      sendScene(frame, { type: 'reset' });
      setPhase('summary');
    }
  }, [reduced, sceneReady, isPunching, isFinale]);
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
  }, [currentRarity, currentReward, opening?.id, phase, revealIndex, sound, isWelcomeOpening]);
  useEffect(() => {
    if (phase !== 'reveal' || !currentReward || !sound || isWelcomeOpening) return;
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
  }, [currentRarity, currentReward, opening?.id, phase, revealIndex, sound, isWelcomeOpening]);

  const reveal = () => {
    sendScene(frame, { type: 'reset' });
    setRevealIndex(0);
    setPhase(reduced ? 'summary' : 'reveal');
  };
  const handleOpen = async (method: Payment, size: PullSize = 1, welcomeTicket = false) => {
    if (busy.current || phase !== 'idle' || neighborhood) return;
    const freeWelcome = welcomeTicket || pending?.idempotencyKey === WELCOME_PULL_KEY;
    const payment = pending?.paymentMethod ?? method;
    const requestedSize = pending?.pullCount ?? size;
    const tier = requestedSize === 10 ? tenPullConfig : { ...bootstrap.packConfig, ...streetPackCost(requestedSize) };
    const cost = payment === 'ticket' ? tier.ticketCost : tier.softCurrencyCost;
    const balance = payment === 'ticket' ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
    if (!freeWelcome && !pending && balance < cost) return;
    if (!preview && !pending && requestedSize > 1 && requestedSize < 10 && !welcome.data?.supportsFlexibleBatches) { setError('Batch pulls are updating. Single packs and ten-pulls remain available.'); return; }
    if (!freeWelcome && !pending && !bannerActive) { setError('This banner is unavailable. Choose an active banner.'); return; }
    busy.current = true;
    if (!reduced && sceneReady) preloadPackGymFinale(requestedSize);
    if (!freeWelcome) playVoiceLine('gacha-intro', sound, 0.9);
    playPullCue(requestedSize === 10 ? 'pack-ten' : 'pack-tear', reduced ? 0.35 : 0.72);
    setPullSize(requestedSize);
    setPhase('requesting');
    setError(null);
    setHits(0);
    setRevealIndex(0);
    setRevealPrepared(false);
    try {
      const nextRequest = reservePackRequest(
        sessionStorage,
        bootstrap.profile.id,
        payment,
        () => freeWelcome ? WELCOME_PULL_KEY : crypto.randomUUID(),
        requestedSize,
        banner.id,
        freeWelcome ? undefined : banner.occurrenceId ?? undefined,
      );
      setPending(nextRequest);
      let result: PackOpening;
      let responseBootstrap: PlayerBootstrap;
      let responsePullSeason: PullSeasonProgress | undefined;
      if (preview) {
        // Curated visual fixtures, never a substitute for the server's reward RNG or odds.
        const cards = ['bodega-cat', 'leroy', 'og-dominican', 'big-zoey', 'crossing-guard']
          .map(id => catalogCardById[id]);
        const repeat = Array.from({ length: requestedSize });
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
          oddsVersion: pullBannerOddsVersion(requestedSize === 10 ? 'street-pack-ten-v2' : 'preview', banner),
          paymentMethod: payment,
          cost,
          pullCount: requestedSize,
          pityBefore: 0,
          pityAfter: 0,
          createdAt: new Date().toISOString(),
          rewards: [...baseCards, ...bonusRewards],
        };
        responseBootstrap = {
          ...bootstrap,
          profile: {
            ...bootstrap.profile,
            packTickets: bootstrap.profile.packTickets - (payment === 'ticket' ? cost : 0),
            softCurrency: bootstrap.profile.softCurrency - (payment === 'softCurrency' ? cost : 0),
            packHistory: [result, ...bootstrap.profile.packHistory],
          },
        };
      } else {
        const response = freeWelcome
          ? await customFetch<{ opening: PackOpening; bootstrap: PlayerBootstrap }>('/api/player/packs/welcome', { method: 'POST' })
          : await openPack.mutateAsync({ data: { ...nextRequest } });
        if (!response?.opening?.rewards?.length || !response.bootstrap?.profile)
          throw new Error('Invalid pack response');
        if (response.bootstrap.profile.id !== bootstrap.profile.id) throw new Error('Pack response belongs to a different account.');
        result = response.opening;
        responseBootstrap = response.bootstrap;
        if ('pullSeason' in response && response.pullSeason) responsePullSeason = response.pullSeason as PullSeasonProgress;
      }
      if (!preview && result.oddsVersion.startsWith('street-pack-')) {
        result = { ...result, pullCount: packReceiptPullCount(result.oddsVersion) };
      }
      const bootstrapKey = getGetPlayerBootstrapQueryKey();
      const currentAccount = () => mounted.current &&
        (!queryClient.getQueryData<PlayerBootstrap>(bootstrapKey)?.profile.id || queryClient.getQueryData<PlayerBootstrap>(bootstrapKey)!.profile.id === bootstrap.profile.id);
      // Keep the original account's receipt after navigation, unless a newer
      // request/reveal already owns its journal. Never erase that newer intent.
      if (!saveCurrentPackOpening(sessionStorage, bootstrap.profile.id, nextRequest, result)) {
        if (currentAccount()) {
          const latestRequest = loadPackRequest(sessionStorage, bootstrap.profile.id);
          const latestOpening = loadPackOpening(sessionStorage, bootstrap.profile.id);
          setPending(latestRequest); setOpening(latestOpening);
          setPullSize(latestOpening ? (isPullCount(latestOpening.pullCount) ? latestOpening.pullCount : packReceiptPullCount(latestOpening.oddsVersion)) : latestRequest?.pullCount ?? 1);
          setBannerId(latestOpening ? pullBannerReceiptIdentity(latestOpening.oddsVersion).bannerId : latestRequest?.bannerId ?? 'standard');
          setPhase(latestOpening ? 'summary' : 'idle');
          void queryClient.invalidateQueries({ queryKey:bootstrapKey });
        }
        return;
      }
      if (!currentAccount()) return;
      await queryClient.cancelQueries({ queryKey:bootstrapKey });
      if (!currentAccount()) return;
      queryClient.setQueryData(bootstrapKey, responseBootstrap);
      if (responsePullSeason || freeWelcome) queryClient.setQueryData(['welcome-pull', bootstrap.profile.id], {
        ...welcome.data, ...(responsePullSeason ? {pullSeason:responsePullSeason} : {}), ...(freeWelcome ? {available:false} : {}),
      });
      const guaranteeWasHit =
        !freeWelcome && requestedSize === 1 &&
        result.pityBefore >= Math.max(0, bootstrap.packConfig.pityLimit - 1);
      if (guaranteeWasHit) playSoundEffect('story-star', sound, 0.9);
      setPullSize(isPullCount(result.pullCount) ? result.pullCount : requestedSize);
      void warmPackRewardArtwork(result.rewards);
      setPending(null);
      setOpening(result);
      if (reduced || !sceneReady) { playPullCue('pack-break', reduced ? 0.35 : 0.72); setPhase('summary'); }
      else {
        sendScene(frame, {
          type: 'arm',
          targetHits: hitsForPull(requestedSize),
          hitsPerPunch: hitsPerPunch(requestedSize),
          omen: highestRarity(result.rewards),
        });
        setPhase(requestedSize === 10 ? 'tenPunching' : 'punching');
        if (window.matchMedia('(max-width: 760px)').matches)
          arena.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    } catch (cause) {
      const cachedPlayer = queryClient.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey())?.profile.id;
      if (mounted.current && (!cachedPlayer || cachedPlayer === bootstrap.profile.id)) {
        if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 400) {
          sessionStorage.removeItem(`squabblemon:pack-request:${bootstrap.profile.id}`);
          setPending(null);
          if (cause instanceof Error && cause.message.toLowerCase().includes('banner')) {
            setBannerId('standard');
            void welcome.refetch();
            setError('This banner is unavailable. No charge was made. Choose an active banner, or refresh the page if the schedule looks wrong.');
          } else {
            setError('This opening was declined without a charge. Check your balance and select an active banner.');
          }
          setPhase('idle');
          return;
        }
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
    if (opening?.rewards.some(reward => reward.cardId === 'john-henry' && reward.kind === 'card' && reward.isNew)) {
      rewardReceipts.show({
        id: `john-henry:${opening.id}`,
        title: 'John Henry joins your crew',
        characterId: 'john-henry',
        items: [{ label: 'John Henry' }],
      });
    }
    finishPackOpening(sessionStorage, bootstrap.profile.id);
    setOpening(null);
    setRevealPrepared(false);
    setPhase('idle');
    setHits(0);
    setPullSize(1);
    sendScene(frame, { type: 'reset' });
  }
  function landStrike() {
    if (!sceneReady) return;
    sendScene(frame, { type: 'punch', intensity: fightBeat.intensity } satisfies ScenePunchMessage);
    if (!reduced && loadFeedbackPreferences().hapticsEnabled && 'vibrate' in navigator) navigator.vibrate(fightBeat.intensity === 'finisher' ? [24, 35, 55] : 18);
  }
  const showInfo = (tab: 'odds' | 'history') => {
    setInfo(tab);
    infoDialog.current?.showModal();
  };

  return (
    <div
      className="gym venue-page studio-page gacha-stage world-decor-host"
      data-phase={phase}
      data-banner-view={false}
      data-neighborhood={neighborhood || undefined}
      data-pull-size={pullSize}
      data-reduced-motion={reduced}
      data-round={isPunching ? beatIndex + 1 : undefined}
      data-strike-intensity={isPunching ? fightBeat.intensity : undefined}
      data-omen={omenRarity.toLowerCase()}
    >
      <div className="gym__arena" ref={arena}>
        <GymVenue />
        {!neighborhood && <SceneFrame
          kind="gym"
          poster={GYM_BAG_POSTER}
          frameRef={frame}
          onReady={() => {
            setSceneReady(true);
            sendScene(frame, { type: 'settings', reducedMotion: reduced, sound, speed: presentationSpeed });
          }}
          onMessage={(message) => {
            if (message.type === 'hit') setHits(message.hits ?? 0);
            if (message.type === 'complete' && isPunching)
              setPhase(pullSize === 10 ? 'tenKnockout' : 'knockout');
            if (message.type === 'error' || message.type === 'static' || message.type === 'loading') {
              setSceneReady(false);
            }
          }}
        />}
        <div className="gym__vignette" />
      </div>
      {phase === 'idle' && <LegacyTicketRecovery key={bootstrap.profile.id} bootstrap={bootstrap}/>}
      {!preview && !pending && !opening && (welcome.isPending || welcome.isError) && <aside className="welcome-pull" role="status"><div><h2>{welcome.isError ? 'Your ticket needs a moment.' : 'Checking your welcome ticket…'}</h2>{welcome.isError && <><p>We could not check your first-pull reward. Reconnect and try again.</p><button className="studio-action" onClick={() => void welcome.refetch()}>Retry ticket check</button></>}</div></aside>}
      {welcomeOffer && <aside className="welcome-pull" aria-label="Dr. Fade first pull">
        <img src={`${PUBLIC_BASE}assets/characters/dr-fade.webp`} alt="Dr. Fade" />
        <div><span className="studio-eyebrow">Dr. Fade · Your first pull</span>
          <h2>{welcomeStep === 'intro' && !pending ? 'Meet your recruiter.' : 'One ticket. One doctor.'}</h2>
          <p>{WELCOME_PULL_LINES[welcomeStep === 'intro' && !pending ? 'intro' : 'ticket']}</p>
          {welcomeStep === 'ticket' || pending ? <>
            <strong className="welcome-pull__ticket">FREE WELCOME TICKET · DR. FADE GUARANTEED</strong>
            <small>One per account. No Clout or regular tickets used. Already own him? Receive {STREET_PACK_RULES.duplicateStyleShards} Universal Style Shards.</small>
            <button className="studio-action studio-action--gold" disabled={phase !== 'idle'} onClick={() => void handleOpen('ticket', 1, true)}>{phase === 'requesting' ? 'Saving your free pull…' : pending ? 'Retry free pull' : 'Use free welcome ticket'}</button>
          </> : <button className="studio-action studio-action--gold" onClick={() => setWelcomeStep('ticket')}>Show me my ticket <ArrowRight size={16} /></button>}
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>}
      <aside className="fight-bill gym__offer" data-neighborhood={neighborhood || undefined} data-focus={neighborhood || banner.id !== 'standard'} aria-label="Open a pack" hidden={(phase !== 'idle' && phase !== 'requesting') || Boolean(welcomeOffer) || (!preview && (welcome.isPending || welcome.isError) && !pending && !opening)}>
        <div className="fight-bill__inner" aria-hidden={neighborhood || banner.id !== 'standard'} inert={neighborhood || banner.id !== 'standard'}>
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
                      : `Open${pullSize > 1 ? ` ${pullSize}×` : ''} · ${cost} ${cost === 1 ? 'ticket' : 'tickets'}`;
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
                  aria-pressed={pullSize === 1}
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
                      : `Open${pullSize > 1 ? ` ${pullSize}×` : ''} · ${cost.toLocaleString()} Clout`;
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


        </div>
      <section className="pull-feature" data-banner={neighborhood ? 'neighborhood' : banner.id} aria-label="Open a pack"
        hidden={Boolean(welcomeOffer) || (phase !== 'idle' && phase !== 'requesting') || (!preview && (welcome.isPending || welcome.isError) && !pending && !opening)}>
        {(neighborhood || banner.id !== 'standard') && <div className="pull-feature__backdrop" aria-hidden="true">
          <img key={banner.id} src={`${PUBLIC_BASE}assets/gacha-banners/${neighborhood ? 'standard' : banner.id}-v1.webp`} alt="" />
        </div>}
        <nav className="pull-feature__arrows" aria-label="Pull banners">
          <button type="button" className="pull-feature__previous" aria-label="Previous banner"
            disabled={browseLocked || (bannerIds.length < 2 && bannerIndex >= 0)} onClick={() => cycleBanner(-1)}><ArrowLeft /></button>
          <button type="button" className="pull-feature__next" aria-label="Next banner"
            disabled={browseLocked || (bannerIds.length < 2 && bannerIndex >= 0)} onClick={() => cycleBanner(1)}><ArrowRight /></button>
        </nav>
        {neighborhood ? <NeighborhoodRecruit bootstrap={bootstrap} onBusyChange={setDirectPurchaseBusy}/> : banner.id !== 'standard' && <><div className="pull-feature__composition" key={banner.id}>
          <img className="pull-feature__poster-art" src={`${PUBLIC_BASE}assets/gacha-banners/${neighborhood ? 'standard' : banner.id}-v1.webp`} alt="" aria-hidden="true" />
          <header className="pull-feature__billing">
            <p className="pull-feature__edition">{banner.id === 'standard' ? 'THE ORIGINAL STREET PACK' : `${banner.name} · WEEKLY FEATURE`}</p>
            <h2 className="pull-feature__title">{banner.headline}</h2>
            <p className="pull-feature__schedule">{banner.endsAt
              ? <time dateTime={banner.endsAt} title={`Ends ${new Date(banner.endsAt).toLocaleString()}`}>{bannerTime}</time>
              : bannerActive ? 'EVERY FIGHT STARTS SOMEWHERE' : 'FEATURE ENDED · CHOOSE ANOTHER BANNER'}</p>
          </header>
          <div className="pull-feature__cast" aria-label={`${banner.name} showcase`}>
            {banner.showcaseCardIds.map((id, index) => <figure key={id} data-position={index}>
              <img src={getCardImage(id)} alt={catalogCardById[id]?.name ?? id} draggable={false} />
              <figcaption>{catalogCardById[id]?.name}</figcaption>
            </figure>)}
          </div>
          <div className="pull-feature__offer">
            <div className="pull-feature__size" role="group" aria-label="Pull size">
              <button type="button" aria-pressed={pullSize === 1} disabled={browseLocked} onClick={() => setPullSize(1)}>1 PULL</button>
              <span aria-hidden="true">/</span>
              <button type="button" aria-pressed={isTenPull} disabled={browseLocked} onClick={() => setPullSize(10)}>10 PULLS</button>
            </div>
            <div className="pull-feature__payments">
              {(['ticket', 'softCurrency'] as const).map(method => {
                const cost = method === 'ticket' ? selectedTier.ticketCost : selectedTier.softCurrencyCost;
                const balance = method === 'ticket' ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
                if (pending && (pending.paymentMethod !== method || (pending.pullCount ?? 1) !== pullSize)) return null;
                const currency = method === 'ticket' ? (cost === 1 ? 'ticket' : 'tickets') : 'Clout';
                const label = phase === 'requesting' ? 'Securing your pull' : pending ? 'Retry this opening'
                  : `Open${pullSize > 1 ? ` ${pullSize}×` : ''} · ${cost.toLocaleString()} ${currency}`;
                return <button key={method} type="button" className="pull-feature__pay" aria-label={label}
                  disabled={phase !== 'idle' || (!pending && (balance < cost || !bannerActive))}
                  onClick={() => void handleOpen(method, pullSize)}>
                  <img src={`${PUBLIC_BASE}assets/rewards/${method === 'ticket' ? 'fight' : 'clout'}-ticket.webp`} alt="" />
                  <span><strong>{phase === 'requesting' ? 'SECURING…' : pending ? 'RETRY PULL' : `${cost.toLocaleString()} ${currency.toUpperCase()}`}</strong>
                    <small>{balance.toLocaleString()} owned</small></span>
                  <ArrowRight aria-hidden="true" />
                </button>;
              })}
            </div>
            <p className="pull-feature__pity">{preview ? 'Preview · sample rewards' : isTenPull ? 'Every 10-pull includes Rare or better'
              : unownedCosmeticVariants === 0 ? 'All featured styles owned'
              : `Style guarantee ${bootstrap.profile.packPity} / ${bootstrap.packConfig.pityLimit}`}</p>
            {error && <p className="pull-feature__error" role="alert">{error}</p>}
            <nav className="pull-feature__utility" aria-label="Gacha information">
              <button type="button" aria-label="Drop rates" onClick={() => showInfo('odds')}>DROP RATES</button>
              <span aria-hidden="true">·</span>
              <button type="button" aria-label="Your openings" onClick={() => showInfo('history')}>PULL HISTORY</button>
              <span className="pull-feature__page">{Math.max(0, bannerIndex) + 1} / {bannerIds.length}</span>
            </nav>
          </div>
          </div>
        </>}
        <p className="pull-feature__description" data-testid="banner-rotation" hidden={neighborhood}>
          {banner.id !== 'standard' && <span className="pull-feature__boost">1.5× featured weight · Same rarity odds</span>}
          {schedule.featured && <span>This week: {schedule.featured.name} · Ends <time dateTime={schedule.featured.endsAt!}>{bannerDateLabel(schedule.featured.endsAt!)}</time></span>}
          <span>Next: {schedule.next.name} · <time dateTime={schedule.next.startsAt!}>{bannerDateLabel(schedule.next.startsAt!)}</time></span>
        </p>
      </section>
      </aside>
      {(preview || welcome.data?.supportsFlexibleBatches) && !welcomeOffer && !pending && !opening && phase === 'idle' && bannerActive && !neighborhood && <section className="gacha-batch-options" aria-label="Use your available packs">
        {(['ticket', 'softCurrency'] as const).map(method => {
          const balance = method === 'ticket' ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
          const count = affordableStreetPacks(balance, method);
          if (!isPullCount(count) || count === 1 || count === 10) return null;
          const cost = streetPackCost(count);
          return <button key={method} className="studio-action" type="button" onClick={() => void handleOpen(method, count)}>
            Open {count} packs · {method === 'ticket' ? `${cost.ticketCost} tickets` : `${cost.softCurrencyCost.toLocaleString()} Clout`}
          </button>;
        })}
        <small>10-pull: discount + Rare or better.</small>
      </section>}
      {phase === 'idle' && !welcomeOffer && !preview && welcome.data?.pullSeason && <section className="pull-season-track" aria-label="Monthly pull milestones">
        <header><h3>{welcome.data.pullSeason.name}</h3><strong>{welcome.data.pullSeason.count} packs opened</strong></header>
        <p>Ends <time dateTime={welcome.data.pullSeason.endsAt}>{bannerDateLabel(welcome.data.pullSeason.endsAt)}</time>.</p>
        <ol>{welcome.data.pullSeason.milestones.map(milestone => <li key={milestone.threshold} data-claimed={milestone.claimed}>
          <b>{milestone.threshold} packs</b><span>{milestone.softCurrency ? `${milestone.softCurrency} Clout` : milestone.packTickets ? `${milestone.packTickets} Street Pack ${milestone.packTickets === 1 ? 'ticket' : 'tickets'}` : `${milestone.styleShards} Universal Style Shards`}</span>
          <small>{milestone.claimed ? 'Delivered' : welcome.data.pullSeason!.count >= milestone.threshold ? 'Delivered with your next pack' : `${milestone.threshold - welcome.data.pullSeason!.count} to go`}</small>
        </li>)}</ol>
      </section>}

      {isPunching && <div className="pack-gym-controls">
        <div className="pack-gym-controls__beats" role="progressbar" aria-label="Punches landed" aria-valuemin={0} aria-valuemax={3} aria-valuenow={landedStrikes}>
          {FIGHT_BEATS.map((beat,index)=><span key={beat.round} data-landed={index<landedStrikes} data-current={index===beatIndex}>{index<landedStrikes ? '✓' : index+1}</span>)}
        </div>
        <button className="pack-gym-controls__strike" type="button" aria-label={strikeLabel} disabled={!sceneReady} onClick={landStrike}>
          <GameGlyph name="fight"/><span>{beatIndex===0 ? 'Jab' : beatIndex===1 ? 'Hook' : 'Finish it'}</span>
        </button>
        <button className="pack-gym-controls__skip" type="button" onClick={reveal}>Skip <ArrowRight size={15}/></button>
      </div>}
      {(isPunching || isFinale) && <PackGymFinale active={isFinale} pullCount={pullSize} rarity={omenRarity} reducedMotion={reduced} speed={presentationSpeed} onSkip={reveal} onPrepareReveal={() => setRevealPrepared(true)} onComplete={() => setPhase(reduced ? 'summary' : 'reveal')}/>}
      <dialog
        ref={rewardDialog}
        className="gacha-reveal-dialog"
        data-preparing={preparingReveal || undefined}
        inert={preparingReveal}
        aria-hidden={preparingReveal || undefined}
        data-pull-size={pullSize}
        data-phase={phase}
        data-rarity={currentRarity.toLowerCase()}
        aria-labelledby="gym-results-title"
        onCancel={(e) => {
          e.preventDefault();
          finish();
        }}
      >
        <GachaRevealSequence phase={phase} preparing={preparingReveal} rewards={arrangedRewards} revealIndex={revealIndex} pullSize={pullSize} preview={preview} isWelcomeOpening={isWelcomeOpening} rareHighlightReward={rareHighlightReward} seasonRewards={opening?.seasonRewards}
          onReveal={index => { setRevealIndex(index); setPhase('reveal'); }} onSummary={() => setPhase('summary')} onFinish={finish}/>
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
            <p><strong>{banner.name} banner.</strong> {banner.id === 'standard' ? 'Standard card selection.' : 'Featured cards receive 1.5× relative selection weight within the rolled rarity. Rarity odds stay the same. A featured card is not guaranteed. New-card protection and within-pack repeat protection apply before the featured weights. The ten-pull guarantee uses the same featured weights.'}</p>
            <p>One featured theme rotates every Monday at 00:00 UTC. Street Pack stays available. Style pity carries across every banner and rotation.</p>
            {banner.id !== 'standard' && <div className="pull-banner-roster">
              <h3>{banner.featuredCardIds.length} featured cards</h3>
              <p>Story-exclusive rewards keep their story unlocks and are excluded from all random pulls.</p>
              <ul>{banner.featuredCardIds.map(id => <li key={id}>{catalogCardById[id].name} <small>{CARD_RARITY_DEFINITIONS[catalogCardById[id].rarity].label}</small></li>)}</ul>
            </div>}
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
                    : `You own every gameplay card. Extra copies become matching rarity shards; rarer copies give more.`}
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
                  {PULL_BANNERS.find(b => b.id === pullBannerReceiptIdentity(item.oddsVersion).bannerId)?.name ?? 'Street Pack'} · {item.pullCount > 1 ? `${item.pullCount}× · ` : ''}{item.cost} {item.paymentMethod === 'ticket' ? 'ticket(s)' : 'Clout'}
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
  const tab = view === 'reactions' || view === 'corner' ? 'corner' :
    view === 'training' || view === 'market' || (view !== 'packs' && (params.has('item') || params.has('card')))
      ? 'market'
      : 'packs';
  const pendingService = readShopRequest(sessionStorage, bootstrap.profile.id);
  const legacyItem = params.get('item') ?? (!view && tab === 'market' ? pendingService?.itemId : undefined);
  const movedRequest: Parameters<typeof shopPurchaseDestination>[0] | null = legacyItem === 'tagged-style' || legacyItem === 'chrome-style' || legacyItem === 'common-recruit' || legacyItem === 'deck-slot'
    ? { itemId: legacyItem, cardId: params.get('card') ?? (pendingService?.itemId === legacyItem ? pendingService.cardId : undefined) ?? undefined }
    : null;
  const destination = movedRequest ? shopPurchaseDestination(movedRequest) : null;
  const here = `/game/shop${search ? `?${search.replace(/^\?/, '')}` : ''}`;
  const redirect = destination && destination !== here ? destination : null;
  useLayoutEffect(() => { if (redirect) navigate(redirect, { replace: true }); }, [redirect, navigate]);

  function selectTab(next: 'market' | 'packs' | 'corner') {
    const query = new URLSearchParams();
    query.set('view', next === 'market' ? 'training' : next);
    navigate(`/game/shop?${query}`);
  }
  if (redirect) return null;
  return (
    <div className="trading-post">
      <nav className="market-tabs" aria-label="Shop departments">
        <button aria-pressed={tab === 'packs'} onClick={() => selectTab('packs')}>
          <GameGlyph name="fight" />
          Recruit
        </button>
        <button aria-pressed={tab === 'market'} onClick={() => selectTab('market')}>
          <GameGlyph name="motion" />
          Training
        </button>
        <button aria-pressed={tab === 'corner'} onClick={() => selectTab('corner')}><GameGlyph name="cloutBag" />Fade Market</button>
      </nav>
      {tab === 'corner' ? <CornerStore key={bootstrap.profile.id} bootstrap={bootstrap} /> : tab === 'market' ? (
        <Market key={`training-${bootstrap.profile.id}`} bootstrap={bootstrap} openPacks={() => selectTab('packs')} />
      ) : (
        <PackGym key={`recruit-${bootstrap.profile.id}-${params.get('banner') ?? 'rotation'}`} bootstrap={bootstrap} />
      )}
    </div>
  );
}
