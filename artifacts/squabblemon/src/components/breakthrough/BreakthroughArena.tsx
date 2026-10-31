import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  createGame,
  deploy,
  deploymentCost,
  deploymentChoices,
  deploymentBaseHands,
  unitDefinition,
  isActionCard,
  effectiveHands,
  legalActionTarget,
  RULES,
  type FighterDefinition,
  type BattleEvent,
} from '@workspace/squabblemon-engine/breakthrough';
import { PracticeInputClock } from './deploymentInput';
import { useDeploymentDrag } from './useDeploymentDrag';
import { handOccupants, reconcileHandSlots } from './handSlots';
import { trackPosition } from './laneGeometry';
import { warmImages, setBattleActive } from '../../lib/imageWarmup';
import { getAssetUrl } from '../../lib/assets';
import { battlePortraitUrl } from '../../lib/battlePortrait';
import { FighterPortrait } from '../profile/FighterPortrait';
import { RankTrophy } from '../RankArtwork';
import {
  batch4Announcement,
  batch4Cues,
  hazardDisplaySide,
  visualEventLifetime,
} from './batch4Effects';
import { BATCH4_FX, type Batch4FxName } from './assets/supplied-fx/batch4';
import {
  BASE_TARGET,
  BREAKTHROUGH_TROPHY,
  DRAW_LOCK,
  TROPHY_DESIGNS,
} from './progressionArt';
import {
  BASE_IMPACT_MS,
  baseImpactEdge,
  baseImpacts,
  combatContacts,
  combatNumbers,
  damagedBaseSmoke,
} from './combatPresentation';
import ResultStage from './ResultStage';
import BreakthroughHowToPlay from './BreakthroughHowToPlay';
import DeploymentChoicePrompt from './DeploymentChoicePrompt';
import HandsMeter from './HandsMeter';
import FlameBaseHealth from './FlameBaseHealth';
import { abilitySummary } from './abilityCopy';
import './arena.css';
import './assets/supplied-fx/batch4.css';
import './combatPresentation.css';
import './assets/supplied-fx/smoke-rise.css';
import './laneGeometry.css';
import './menuTransition.css';
import './resultStage.css';
import './resultScroll.css';
import './assets/batch10/batch10.css';
import './batch10Presentation.css';
import './production.css';

export type BreakthroughIdentity = {
  name: string;
  avatarKey: string;
  heroCardId: string;
  level: number;
  rank?: string;
};
type Props = {
  roster: FighterDefinition[];
  playerDeck: string[];
  opponentDeck: string[];
  identity: BreakthroughIdentity;
  initialSeed: number;
  preferredReducedMotion: boolean;
  onChangeDeck(): void;
  onExit(): void;
};
const LANES = [0, 1, 2] as const;
/** The finished transition releases its atlas without changing its authored lifetime. */
function ArenaFireTransition() {
  const [finished, setFinished] = useState(false);
  if (finished) return null;
  return (
    <div
      className="bt-fire-transition"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === 'bt-fire-finish'
        )
          setFinished(true);
      }}
    >
      <i className="bt-batch10-sprite bt-b10-fire" />
    </div>
  );
}
const clock = (ms: number) => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function BreakthroughArena({
  roster,
  playerDeck,
  opponentDeck,
  identity,
  initialSeed,
  preferredReducedMotion,
  onChangeDeck,
  onExit,
}: Props) {
  const [matchKey, setMatchKey] = useState(0);
  const [resultReady, setResultReady] = useState(false);
  const [osReducedMotion, setOsReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const reducedMotion = preferredReducedMotion || osReducedMotion;
  const [sound, setSound] = useState(false);
  const [theme, setTheme] = useState<'dojo' | 'rooftop'>('dojo');
  const [game, setGame] = useState(() =>
    createGame(roster, {
      seed: initialSeed,
      aiStyle: 'counter',
      decks: { player: playerDeck, opponent: opponentDeck },
    }),
  );
  const live = useRef(game);
  const handSlots = useRef(
    reconcileHandSlots([], handOccupants(game.players.player)),
  );
  const [inputClock] = useState(() => new PracticeInputClock());
  const arenaRef = useRef<HTMLElement>(null);
  const started = true;
  const [paused, setPaused] = useState(() => document.hidden);
  const [presentationVisible, setPresentationVisible] = useState(
    () => !document.hidden,
  );
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const [inspectedUnitId, setInspectedUnitId] = useState<string | null>(null);
  const [inspectedStack, setInspectedStack] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<{
    cardId: string;
    lane: 0 | 1 | 2;
    squabble: boolean;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [pauseReason, setPauseReason] = useState(() =>
    document.hidden ? 'Tab hidden · practice paused' : 'Practice paused',
  );
  const menuRef = useRef<HTMLElement>(null);
  const eventBirths = useRef(new Map<number, number>());
  const visualEvents = useRef<Array<BattleEvent & { born: number }>>([]);
  const baseSmoke = useRef<Array<BattleEvent & { born: number }>>([]);
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(false);
  const lastSound = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const byId = useMemo(
    () => new Map(game.roster.map((card) => [card.id, card])),
    [game.roster],
  );
  const active = !paused && !menu && game.status === 'playing';
  const remaining = Math.max(0, game.durationMs - game.elapsedMs);
  const lastStand = !!game.drawsLocked || remaining <= 30000;
  const chosen = selected ? byId.get(selected) : undefined;
  const occupiedHand = handOccupants(game.players.player);
  const dragging = useDeploymentDrag({
    active,
    matchKey,
    arena: arenaRef,
    onStart: (id) => {
      setSelected(id);
      setInspected(null);
      setInspectedUnitId(null);
      setInspectedStack([]);
      setNotice('');
    },
    onClear: () => {
      setSelected(null);
      setInspected(null);
      setInspectedUnitId(null);
    },
    onDrop: (id, lane, squabble) => {
      playLane(lane, id, squabble);
    },
  });
  const draggedCard = dragging.drag
    ? byId.get(dragging.drag.cardId)
    : undefined;
  const dragCost = draggedCard
    ? dragging.drag?.lane != null
      ? deploymentCost(game, 'player', draggedCard.id, dragging.drag.lane)
      : Math.min(
          ...LANES.map((lane) =>
            deploymentCost(game, 'player', draggedCard.id, lane),
          ),
        )
    : 0;

  // Set the shared battle priority before any later on-demand warmup.
  useEffect(() => {
    setBattleActive(true);
    return () => setBattleActive(false);
  }, []);

  function fighterRoom(
    side: string,
    lane: number,
    position: number,
    id?: string,
  ): CSSProperties {
    const line = game.units
      .filter(
        (unit) =>
          unit.canFight !== false && unit.side === side && unit.lane === lane,
      )
      .sort(
        (a, b) =>
          (side === 'player'
            ? b.position - a.position
            : a.position - b.position) ||
          (a.arrivalOrder ?? a.deployedAt ?? 0) -
            (b.arrivalOrder ?? b.deployedAt ?? 0),
      );
    const index = line.findIndex((unit) => unit.id === id);
    // Presentation-only overlap: older cards peek above the newest card at the base.
    // This never moves the simulation, charges extra Motion, or postpones abilities.
    const tucked =
      index < 0
        ? 0
        : line
            .slice(index + 1)
            .filter((unit) => Math.abs(unit.position - position) < 0.08).length;
    const gaps = line
      .filter((unit) => unit.id !== id)
      .map((unit) => Math.abs(unit.position - position));
    const clustered = gaps.some((gap) => gap < 0.08);
    return {
      ...trackPosition(position),
      '--bt-fighter-gap': clustered ? 1 : Math.min(1, ...gaps),
      '--bt-stack-offset': `${(side === 'player' ? -1 : 1) * Math.min(tucked, 5) * 18}px`,
      zIndex: 20 + Math.max(0, index),
    } as CSSProperties;
  }

  function publish(next: typeof game) {
    const retainedIds = new Set(next.events.map((event) => event.id));
    for (const id of eventBirths.current.keys())
      if (!retainedIds.has(id)) eventBirths.current.delete(id);
    const fresh = next.events.filter(
      (event) => !eventBirths.current.has(event.id),
    );
    for (const event of fresh)
      eventBirths.current.set(event.id, next.elapsedMs);
    baseSmoke.current = damagedBaseSmoke(
      baseSmoke.current,
      fresh.map((event) => ({ ...event, born: next.elapsedMs })),
    );
    visualEvents.current = [
      ...visualEvents.current,
      ...fresh.map((event) => ({ ...event, born: next.elapsedMs })),
    ]
      .filter(
        (event) => next.elapsedMs - event.born < visualEventLifetime(event),
      )
      .slice(-24);
    const accent =
      fresh.find((event) => event.type === 'breach') ??
      fresh.find(
        (event) => event.type === 'collision-damage' || event.type === 'damage',
      );
    if (
      accent &&
      soundOn.current &&
      audio.current?.state === 'running' &&
      performance.now() - lastSound.current > 120
    ) {
      lastSound.current = performance.now();
      const ctx = audio.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(
        accent.type === 'breach' ? 280 : 130,
        ctx.currentTime,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        accent.type === 'breach' ? 560 : 45,
        ctx.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.16);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
    handSlots.current = reconcileHandSlots(
      handSlots.current,
      handOccupants(next.players.player),
    );
    live.current = next;
    setGame(next);
  }
  function say(message: string) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2400);
  }
  function reset() {
    inputClock.stop();
    setMatchKey((value) => value + 1);
    eventBirths.current.clear();
    visualEvents.current = [];
    baseSmoke.current = [];
    handSlots.current = [];
    publish(
      createGame(roster, {
        seed: initialSeed,
        aiStyle: 'counter',
        decks: { player: playerDeck, opponent: opponentDeck },
      }),
    );
    setSelected(null);
    setPendingChoice(null);
    setInspected(null);
    setInspectedUnitId(null);
    setInspectedStack([]);
    setArmed(false);
    setNotice('');
    setMenu(false);
    setPaused(document.hidden);
    setPauseReason(
      document.hidden ? 'Tab hidden · practice paused' : 'Practice paused',
    );
    setResultReady(false);
  }
  useEffect(() => {
    if (game.status !== 'complete') return;
    // Let the decisive wood-shatter and score punch land before the result takes the stage.
    const timer = setTimeout(
      () => setResultReady(true),
      reducedMotion ? 450 : BASE_IMPACT_MS,
    );
    return () => clearTimeout(timer);
  }, [game.status, reducedMotion]);
  useEffect(() => {
    if (
      game.status !== 'complete' ||
      !presentationVisible ||
      reducedMotion ||
      (game.winner !== 'player' && game.winner !== 'opponent')
    )
      return;
    void warmImages([
      game.winner === 'player'
        ? getAssetUrl('assets/results/win-w.webp')
        : new URL('./assets/batch10/loss-atlas.webp', import.meta.url).href,
    ]);
  }, [game.status, game.winner, presentationVisible, reducedMotion]);
  async function toggleSound() {
    const enabled = !soundOn.current;
    soundOn.current = enabled;
    setSound(enabled);
    if (enabled) {
      try {
        audio.current ??= new AudioContext();
        await audio.current.resume();
      } catch {
        soundOn.current = false;
        setSound(false);
        say('Audio unavailable');
      }
    }
  }
  useEffect(
    () => () => {
      void audio.current?.close();
      clearTimeout(noticeTimer.current);
    },
    [],
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setOsReducedMotion(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  function catchUp() {
    if (document.hidden) {
      inputClock.stop();
      return live.current;
    }
    const next = inputClock.advanceTo(live.current, performance.now(), true);
    publish(next);
    return next;
  }
  function playLane(
    lane: 0 | 1 | 2,
    id = selected,
    squabble = armed,
    choice?: string,
  ) {
    if (!active || !id || document.hidden) return;
    const current = catchUp(),
      card = byId.get(id);
    if (
      card &&
      deploymentChoices(current, 'player', id, lane).required &&
      choice === undefined
    ) {
      setPendingChoice({ cardId: id, lane, squabble });
      return;
    }
    let targetUnitId: string | undefined;
    if (card && isActionCard(card)) {
      if (squabble) {
        say('Action cards cannot Squabble. Disarm to play.');
        return;
      }
      const target = legalActionTarget(current, 'player', id, lane);
      if (!target.valid) {
        say(target.error ?? 'No legal target in this lane');
        return;
      }
      targetUnitId = target.targetUnitId;
    }
    const result = deploy(
      current,
      'player',
      id,
      lane,
      squabble,
      targetUnitId || choice !== undefined
        ? {
            ...(targetUnitId ? { unitId: targetUnitId } : {}),
            ...(choice !== undefined ? { choice } : {}),
          }
        : undefined,
    );
    if (result.error) {
      say(result.error);
      return;
    }
    publish(result.state);
    setPendingChoice(null);
    setSelected(null);
    setInspected(null);
    setInspectedUnitId(null);
    setArmed(false);
    setNotice('');
    clearTimeout(noticeTimer.current);
  }
  useEffect(() => {
    if (!active || document.hidden) return;
    inputClock.resume(performance.now());
    const id = setInterval(catchUp, 100);
    return () => {
      clearInterval(id);
      inputClock.stop();
    };
  }, [active, inputClock]);
  useEffect(() => {
    if (!active) {
      setPendingChoice(null);
      setSelected(null);
      setInspected(null);
      setInspectedUnitId(null);
    }
  }, [active]);
  useEffect(() => {
    function hide() {
      setPresentationVisible(!document.hidden);
      if (document.hidden && started) {
        // Visibility events can precede React's pause commit or a queued frame.
        inputClock.stop();
        setPauseReason('Tab hidden · practice paused');
        setPaused(true);
      }
    }
    hide();
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
    };
  }, [started, inputClock]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (
        event.key !== 'Escape' &&
        (event.target as HTMLElement)?.matches('input,select,textarea')
      )
        return;
      if (pendingChoice) {
        if (event.key === 'Escape') setPendingChoice(null);
        return;
      }
      if (event.key === 'Escape') {
        dragging.cancel();
        setSelected(null);
        setInspected(null);
        setInspectedUnitId(null);
        setMenu(false);
      }
      if (active && selected && /^[123]$/.test(event.key)) {
        event.preventDefault();
        playLane((Number(event.key) - 1) as 0 | 1 | 2);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),select,input,summary',
        ) ?? [],
      ).filter((element) => element.getClientRects().length);
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [menu]);
  const recentEvents = game.events
    .filter(
      (event) =>
        game.elapsedMs - (eventBirths.current.get(event.id) ?? -2000) < 1000,
    )
    .slice(-24);
  const nextCard = !lastStand
    ? byId.get(game.players.player.queue[0])
    : undefined;
  const inspectedUnit = inspectedUnitId
    ? game.units.find((unit) => unit.id === inspectedUnitId)
    : undefined;
  const liveInspectedStack = inspectedStack.filter((id) =>
    game.units.some((unit) => unit.id === id),
  );
  const inspectedCard = inspectedUnit
    ? unitDefinition(game, inspectedUnit)
    : inspected && !inspectedUnitId
      ? byId.get(inspected)
      : undefined;
  const playerHands = game.units
    .filter((unit) => unit.side === 'player' && unit.countsHands !== false)
    .reduce((sum, unit) => sum + effectiveHands(unit), 0);
  const opponentHands = game.units
    .filter((unit) => unit.side === 'opponent' && unit.countsHands !== false)
    .reduce((sum, unit) => sum + effectiveHands(unit), 0);
  const suppliedCues = batch4Cues(visualEvents.current, game.elapsedMs);
  const numbers = combatNumbers(visualEvents.current, game.elapsedMs);
  const contacts = combatContacts(visualEvents.current, game.elapsedMs);
  const smoke = baseSmoke.current;
  const breaches = baseImpacts(visualEvents.current, game.elapsedMs);
  const update = batch4Announcement(visualEvents.current, game.elapsedMs);
  // The base itself carries the breach callout; a second banner would cover its impact art.
  const announcement =
    game.status === 'playing' && started
      ? update
        ? update.event.type === 'breach'
          ? undefined
          : { id: update.event.id, text: update.text }
        : game.elapsedMs < BATCH4_FX.banner.durationMs
          ? { id: 0, text: 'BREAK THROUGH' }
          : undefined
      : undefined;

  return (
    <main
      ref={arenaRef}
      onDragStartCapture={(event) => {
        if (
          !(event.target as HTMLElement).closest(
            'input,textarea,[contenteditable]:not([contenteditable="false"])',
          )
        )
          event.preventDefault();
      }}
      onPointerDownCapture={(event) => {
        if (!(event.target as HTMLElement).closest('.bt-finish'))
          dragging.pointerDownCapture();
      }}
      onPointerMove={dragging.pointerMove}
      onPointerUp={dragging.pointerUp}
      onPointerCancel={dragging.pointerCancel}
      onLostPointerCapture={dragging.pointerCancel}
      onClickCapture={(event) => {
        if (!(event.target as HTMLElement).closest('.bt-finish'))
          dragging.clickCapture(event);
      }}
      data-active={active || (game.status === 'complete' && !resultReady)}
      data-presentation-visible={presentationVisible}
      data-reduced-motion={reducedMotion}
      data-arena={theme}
      onPointerDown={(event) => {
        if (
          !(event.target as HTMLElement).closest(
            'button,select,summary,.bt-menu,.bt-mini-explainer,.bt-finish',
          )
        ) {
          setSelected(null);
          setInspected(null);
          setInspectedUnitId(null);
        }
      }}
      className={`bt-arena ${lastStand ? 'bt-last-stand' : ''} ${active && remaining <= 5000 ? 'bt-danger' : ''} ${dragging.drag ? 'bt-dragging' : ''}`}
    >
      {!reducedMotion && (!resultReady || menu) && (
        <ArenaFireTransition
          key={`fire-${matchKey}-${menu ? 'menu' : 'arena'}`}
        />
      )}
      <header className="bt-header" aria-label="Players and match clock">
        <div className="bt-nameplate bt-nameplate-you">
          <FlameBaseHealth
            key={`you-${matchKey}`}
            lost={game.players.opponent.breaches}
            reducedMotion={reducedMotion}
          />
          <div className="bt-banner-portrait">
            <FighterPortrait
              cardId={identity.heroCardId}
              avatarKey={identity.avatarKey}
              name={identity.name}
              battleArtwork
              decorative
            />
          </div>
          <div className="bt-banner-copy">
            <strong title={identity.name}>{identity.name}</strong>
            <div className="bt-player-progress">
              <b aria-label={`Level ${identity.level}`}>LV {identity.level}</b>
              {identity.rank && <RankTrophy tier={identity.rank} />}
            </div>
            <div
              className="bt-base-pips"
              aria-label={`${game.players.player.breaches} of 2 base breaches`}
            >
              <small>{playerHands} HANDS</small>
            </div>
          </div>
        </div>
        <div
          className="bt-time"
          aria-label={`${Math.ceil(remaining / 1000)} seconds remaining`}
        >
          {clock(remaining)}
          {lastStand && <small>LAST STAND</small>}
        </div>
        <div className="bt-nameplate bt-nameplate-opps">
          <FlameBaseHealth
            key={`opps-${matchKey}`}
            lost={game.players.player.breaches}
            reducedMotion={reducedMotion}
          />
          <div className="bt-banner-portrait">
            <FighterPortrait
              cardId={opponentDeck[0]}
              name="CPU"
              battleArtwork
              decorative
            />
          </div>
          <div className="bt-banner-copy">
            <strong>CPU</strong>
            <div
              className="bt-base-pips"
              aria-label={`${game.players.opponent.breaches} of 2 base breaches`}
            >
              <small>{opponentHands} HANDS</small>
            </div>
          </div>
        </div>
        <button
          className="bt-menu-trigger"
          aria-label="Open rules and practice settings"
          onClick={() => {
            inputClock.stop();
            setMenu(true);
          }}
        >
          •••
        </button>
      </header>
      <section
        className="bt-field"
        aria-label="Three-lane battlefield"
        onClick={() => {
          if (!selected) setNotice('');
        }}
      >
        <div className="bt-base bt-base-opps">
          CPU BASE <span>↑ BREAK THROUGH</span>
        </div>
        {!reducedMotion &&
          smoke.map((event) => {
            const edge =
              event.type === 'breach'
                ? baseImpactEdge(event.side)
                : event.side === 'opponent'
                  ? 'top'
                  : 'bottom';
            // Background emblems live in the base strips, outside the moving-card track.
            return (
              <span
                key={`smoke-${event.id}`}
                className={`bt-lane-smoke bt-smoke-base-${edge}`}
                data-lane={event.lane ?? 1}
                aria-hidden="true"
              >
                <i className="bt-smoke-rise-sprite" />
              </span>
            );
          })}
        <div
          className="bt-lanes"
          inert={menu || resultReady || paused || !!pendingChoice}
        >
          <img
            className="bt-base-art bt-base-art-opps"
            src={BASE_TARGET}
            alt=""
          />
          <img
            className="bt-base-art bt-base-art-you"
            src={BASE_TARGET}
            alt=""
          />
          {LANES.map((lane) => {
            const cost = selected
              ? deploymentCost(game, 'player', selected, lane)
              : 0;
            const affordable = cost <= game.players.player.motion + 1e-8;
            const support = !!chosen && isActionCard(chosen);
            const actionTarget =
              support && selected
                ? legalActionTarget(game, 'player', selected, lane)
                : undefined;
            const targetError =
              actionTarget && !actionTarget.valid
                ? (actionTarget.error ?? 'No valid target in this lane')
                : undefined;
            const legal = !!selected && active && affordable && !targetError;
            return (
              <div
                className={`bt-lane ${legal ? 'bt-lane-ready' : ''} ${selected && !legal ? 'bt-lane-blocked' : ''} ${dragging.drag?.lane === lane ? 'bt-drop-target' : ''}`}
                key={lane}
              >
                <button
                  className="bt-deploy-zone"
                  aria-label={`${support ? 'Use' : 'Deploy'} ${chosen?.name ?? 'selected fighter'} in lane ${lane + 1}`}
                  disabled={!selected || !active || !!targetError}
                  title={targetError}
                  aria-description={
                    targetError ??
                    (selected
                      ? !affordable
                        ? `Need ${cost} Motion`
                        : `${cost} Motion to ${support ? 'use' : 'deploy'}`
                      : undefined)
                  }
                  onClick={() => playLane(lane)}
                >
                  <span>
                    {selected
                      ? targetError
                        ? 'NO VALID TARGET'
                        : !affordable
                          ? `NEED ${cost} MOTION`
                          : `${support ? 'USE SUPPORT' : 'DEPLOY'} ↑ · ${cost} MOTION`
                      : ''}
                  </span>
                  {selected && chosen && (
                    <i className={`bt-entrance-ghost ${legal ? 'legal' : ''}`}>
                      <img src={battlePortraitUrl(chosen.art)} alt="" />
                      <b>{cost}</b>
                    </i>
                  )}
                </button>
                {numbers
                  .filter((cue) => cue.event.lane === lane)
                  .map((cue) => (
                    <span
                      key={`number-${cue.event.id}`}
                      className={`bt-combat-number ${cue.damage ? 'bt-number-damage' : 'bt-number-gain'} ${cue.burn ? 'bt-number-burn' : ''} ${cue.heavy ? 'bt-number-heavy' : ''} ${cue.event.side === 'opponent' ? 'bt-number-opps' : 'bt-number-you'}`}
                      style={{
                        ...trackPosition(cue.position),
                        left: `${cue.left}%`,
                      }}
                      aria-label={`${cue.event.side === 'opponent' ? 'The Opps' : 'Your fighter'} ${cue.damage ? 'loses' : 'gains'} ${cue.event.amount} Hands${cue.ko ? ', knocked out' : cue.burn ? ' from Burn' : ''}`}
                    >
                      <b>{cue.text}</b>
                      {cue.label && <small>{cue.label}</small>}
                    </span>
                  ))}
                {recentEvents
                  .filter(
                    (event) =>
                      event.lane === lane &&
                      [
                        'ability',
                        'block',
                        'protect',
                        'confiscate',
                        'challenge',
                        'challenge-win',
                        'escape',
                      ].includes(event.type),
                  )
                  .map((event) => (
                    <span
                      key={`fx-${event.id}`}
                      className={`bt-impact bt-impact-${event.type}`}
                      style={trackPosition(event.position ?? 0.5)}
                    >
                      {event.type === 'confiscate'
                        ? 'BONUS STRIPPED'
                        : event.type === 'protect'
                          ? 'GUARDED'
                          : event.text}
                    </span>
                  ))}
                {!reducedMotion &&
                  contacts
                    .filter((event) => event.lane === lane)
                    .map((event) => (
                      <span
                        key={`contact-${event.id}`}
                        className="bt-contact-burst"
                        style={trackPosition(event.position!)}
                        aria-hidden="true"
                      >
                        <i className="bt-contact-ink" />
                        <span className="bt-media-fx bt-contact-fx" />
                      </span>
                    ))}
                {!reducedMotion &&
                  visualEvents.current
                    .filter(
                      (event) => event.lane === lane && event.type === 'defeat',
                    )
                    .map((event) => (
                      <span
                        key={`media-${event.id}`}
                        className="bt-media-fx bt-death-fx"
                        style={{
                          ...trackPosition(event.position ?? 0.5),
                          left: '50%',
                        }}
                        aria-hidden="true"
                      />
                    ))}
                {!reducedMotion &&
                  visualEvents.current
                    .filter(
                      (event) =>
                        event.type === 'defeat' &&
                        event.lane === lane &&
                        game.elapsedMs - event.born < 620,
                    )
                    .map((event) => (
                      <span
                        key={`ghost-${event.id}`}
                        className="bt-defeat-ghost"
                        style={fighterRoom(
                          event.side ?? 'player',
                          lane,
                          event.position ?? 0.5,
                          event.targetUnitId,
                        )}
                        aria-hidden="true"
                      >
                        <img
                          src={
                            event.cardId
                              ? battlePortraitUrl(
                                  byId.get(event.cardId)?.art ?? '',
                                ) || undefined
                              : undefined
                          }
                          alt=""
                        />
                      </span>
                    ))}
                {visualEvents.current
                  .filter(
                    (event) =>
                      event.lane === lane &&
                      ['block', 'bomb', 'confiscate'].includes(event.type) &&
                      game.elapsedMs - event.born < 950,
                  )
                  .slice(-3)
                  .map((event) => (
                    <img
                      key={`authored-${event.id}`}
                      className={`bt-authored-event bt-authored-${event.type}`}
                      src={
                        new URL(
                          `./assets/progression/${event.type}-fx.webp`,
                          import.meta.url,
                        ).href
                      }
                      alt=""
                      style={trackPosition(event.position ?? 0.5)}
                    />
                  ))}
                {breaches
                  .filter((event) => event.lane === lane)
                  .map((event) => (
                    <div
                      key={`base-${event.id}`}
                      className={`bt-breach-impact bt-breach-${baseImpactEdge(event.side)}`}
                      aria-label={`${event.side === 'player' ? 'You breached The Opps’ base' : 'The Opps breached your base'}. ${game.players[event.side!].breaches} of 2.`}
                    >
                      <i className="bt-breach-speed" aria-hidden="true" />
                      <i className="bt-breach-split" aria-hidden="true" />
                      <div className="bt-breach-art" aria-hidden="true">
                        <img
                          src={
                            new URL(
                              './assets/progression/breach-fx.webp',
                              import.meta.url,
                            ).href
                          }
                          alt=""
                        />
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <i
                            key={i}
                            className={`bt-splinter bt-splinter-${i}`}
                          />
                        ))}
                      </div>
                      <strong>BREAK!</strong>
                      <span>
                        {game.players[event.side!].breaches}
                        <small> / 2</small>
                      </span>
                    </div>
                  ))}
                {!reducedMotion &&
                  suppliedCues
                    .filter((cue) => cue.event.lane === lane)
                    .map(({ event, name }) => (
                      <Batch4Sprite
                        key={`batch4-${matchKey}-${event.id}`}
                        name={name}
                        className={`bt-event-art bt-event-art-${name}`}
                        style={trackPosition(event.position ?? 0.5)}
                      />
                    ))}
                {game.hazards
                  .filter((hazard) => hazard.lane === lane)
                  .map((hazard, _index, local) => {
                    const siblings = local.filter(
                      (h) =>
                        h.kind === hazard.kind &&
                        h.side === hazard.side &&
                        h.readyAt === hazard.readyAt,
                    );
                    if (siblings[0].id !== hazard.id) return null;
                    const seconds = Math.max(
                      0,
                      Math.ceil((hazard.readyAt - game.elapsedMs) / 1000),
                    );
                    return (
                      <span
                        className={`bt-hazard bt-hazard-${hazard.kind}`}
                        key={hazard.id}
                        style={{
                          bottom:
                            hazardDisplaySide(hazard.kind, hazard.side) ===
                            'player'
                              ? '24%'
                              : '65%',
                          left: hazard.kind === 'bud' ? '74%' : '70%',
                        }}
                        aria-label={`${siblings.length} ${hazard.kind}${siblings.length > 1 ? 's' : ''}, ${seconds} seconds`}
                      >
                        <Batch4Sprite
                          name={hazard.kind === 'bomb' ? 'bomb' : 'bud'}
                          loop
                        />
                        {siblings.length > 1 && <em>×{siblings.length}</em>}
                        <b>{seconds}s</b>
                      </span>
                    );
                  })}
                {game.units
                  .filter((unit) => unit.lane === lane)
                  .map((unit) => {
                    const card = byId.get(unit.cardId);
                    if (unit.canFight === false)
                      return (
                        <button
                          key={unit.id}
                          className={`bt-lane-resource bt-resource-${unit.side}`}
                          style={{
                            ...trackPosition(unit.position),
                            left: unit.side === 'player' ? '18%' : '82%',
                          }}
                          aria-label={`${card?.name ?? 'Lane resource'}, next friendly character gains 2 Hands`}
                          onClick={() => {
                            if (selected) {
                              playLane(lane);
                              return;
                            }
                            setInspected(unit.cardId);
                            setInspectedUnitId(unit.id);
                            setSelected(null);
                          }}
                        >
                          <img
                            src={
                              unit.art
                                ? battlePortraitUrl(getAssetUrl(unit.art))
                                : card?.art
                                  ? battlePortraitUrl(getAssetUrl(card.art))
                                  : undefined
                            }
                            alt=""
                            draggable={false}
                          />
                        </button>
                      );
                    const neighbors = game.units
                      .filter(
                        (other) =>
                          other.canFight !== false &&
                          other.lane === unit.lane &&
                          other.side === unit.side &&
                          Math.abs(other.position - unit.position) <
                            RULES.spacing,
                      )
                      .sort(
                        (a, b) =>
                          a.position - b.position || a.id.localeCompare(b.id),
                      );
                    const approaching = game.units.some(
                      (other) =>
                        other.canFight !== false &&
                        other.lane === unit.lane &&
                        other.side !== unit.side &&
                        Math.abs(other.position - unit.position) <=
                          RULES.spacing + 0.06,
                    );
                    const lastHit = recentEvents
                      .filter(
                        (event) =>
                          ['damage', 'collision-damage'].includes(event.type) &&
                          event.targetUnitId === unit.id,
                      )
                      .at(-1);
                    return (
                      <button
                        onClick={() => {
                          if (selected) {
                            playLane(lane);
                            return;
                          }
                          setInspected(unit.cardId);
                          setInspectedUnitId(unit.id);
                          setInspectedStack(neighbors.map((other) => other.id));
                          setSelected(null);
                        }}
                        key={unit.id}
                        className={`bt-unit bt-unit-${unit.side} ${unit.squabbled ? 'bt-squabbled' : ''} ${unit.protected ? 'bt-protected' : ''} ${unit.immune ? 'bt-immune' : ''} ${unit.challenge ? 'bt-challenging' : ''} ${unit.frozen ? 'bt-frozen' : ''} ${unit.silenced ? 'bt-silenced' : ''} ${lastHit ? 'bt-taking-hit' : ''} ${approaching ? 'bt-windup' : ''}`}
                        style={{
                          ...fighterRoom(
                            unit.side,
                            lane,
                            unit.position,
                            unit.id,
                          ),
                          left: '50%',
                        }}
                        aria-label={`${card?.name}, ${unit.side === 'player' ? 'you' : 'CPU'}, ${effectiveHands(unit)} Hands${unit.protected ? ', protected' : ''}${unit.immune ? (unit.immunityScope === 'abilities' ? ', ability immune' : ', damage immune') : ''}${unit.silenced ? ', silenced' : ''}${unit.frozen ? ', frozen' : ''}${unit.movementLocks?.some((lock) => lock.expiresAt > game.elapsedMs) ? ', movement locked' : ''}${unit.weakened ? ', weakened' : ''}, lane ${lane + 1}`}
                      >
                        <img
                          key={`portrait-${lastHit?.id ?? 'idle'}`}
                          className={lastHit ? 'bt-art-recoil' : undefined}
                          src={
                            unit.art
                              ? battlePortraitUrl(getAssetUrl(unit.art))
                              : card?.art
                                ? battlePortraitUrl(getAssetUrl(card.art))
                                : undefined
                          }
                          alt=""
                          draggable={false}
                        />
                        {lastHit && (
                          <i
                            key={lastHit.id}
                            className="bt-hit-flash"
                            aria-hidden="true"
                          />
                        )}
                        {unit.silenced && (
                          <span className="bt-silence-lock" aria-hidden="true">
                            <i className="bt-batch10-sprite bt-b10-lock" />
                          </span>
                        )}
                        {unit.frozen && (
                          <Batch4Sprite
                            name="ice"
                            className="bt-freeze-art"
                            loop
                          />
                        )}
                        <strong
                          key={`hands-${effectiveHands(unit)}`}
                          className={`${effectiveHands(unit) > unit.baseHands ? 'bt-hands-boosted' : ''} ${lastHit ? 'bt-hands-hit' : ''}`}
                        >
                          {effectiveHands(unit)}
                        </strong>
                        {lastHit && (lastHit.amount ?? 0) > 0 && (
                          <em
                            key={`lost-${lastHit.id}`}
                            className="bt-hands-shed"
                            aria-hidden="true"
                          >
                            −{lastHit.amount}
                          </em>
                        )}
                        <HandsMeter
                          value={effectiveHands(unit)}
                          maximum={Math.max(
                            unit.maxHands,
                            effectiveHands(unit),
                          )}
                        />
                        <span>{card?.name}</span>
                        {unit.squabbled && <i>✊</i>}
                        {unit.burnStacks ? (
                          <img
                            className="bt-status-burn"
                            src={getAssetUrl(
                              `assets/combat/supplied/burn-flame${active && !reducedMotion ? '' : '-still'}.webp`,
                            )}
                            alt="Burning"
                          />
                        ) : null}
                        {unit.challenge && (
                          <em className="bt-challenge-time">
                            {Math.max(
                              0,
                              Math.ceil(
                                (unit.challenge.expiresAt - game.elapsedMs) /
                                  1000,
                              ),
                            )}
                            s
                          </em>
                        )}
                        {game.statuses
                          .filter(
                            (status) =>
                              status.targetId === unit.id &&
                              status.appliedAt <= game.elapsedMs &&
                              status.expiresAt > game.elapsedMs,
                          )
                          .slice(0, 3)
                          .map((status) => (
                            <em
                              className={`bt-status-chip bt-status-${status.kind}`}
                              key={status.id}
                            >
                              {status.kind === 'burn'
                                ? 'BURN'
                                : status.kind === 'freeze'
                                  ? 'ICE'
                                  : status.kind === 'weaken'
                                    ? 'WEAK'
                                    : 'MUTE'}{' '}
                              {Math.max(
                                0,
                                Math.ceil(
                                  (status.expiresAt - game.elapsedMs) / 1000,
                                ),
                              )}
                            </em>
                          ))}
                        {(unit.protected || unit.immune) && (
                          <em className="bt-unit-status">
                            {unit.immune ? 'IMMUNE' : 'GUARD'}
                          </em>
                        )}
                      </button>
                    );
                  })}
              </div>
            );
          })}
          <svg
            className="bt-fx-layer"
            viewBox="0 0 300 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {recentEvents.map((event) => (
              <AbilityEffect key={event.id} event={event} />
            ))}
          </svg>
        </div>
        <div className="bt-centerline">
          <span>BREAK THE LINE</span>
        </div>
        <div className="bt-base bt-base-you">
          YOUR BASE <span>DEFEND ↓</span>
        </div>
        {announcement && (
          <div
            key={`update-${matchKey}-${announcement.id}`}
            className="bt-announcement"
            role="status"
          >
            <Batch4Sprite name="banner" />
            <strong>{announcement.text}</strong>
          </div>
        )}
        <div className="bt-feedback" role="status">
          {notice ||
            (selected
              ? `${chosen?.name} → CHOOSE A LANE`
              : lastStand
                ? 'DRAW LOCKED · PLAY WHAT’S LEFT'
                : '')}
        </div>
        {inspectedCard && active && (
          <aside className="bt-mini-explainer">
            <button
              aria-label="Close fighter explanation"
              onClick={() => {
                setInspected(null);
                setInspectedUnitId(null);
                setSelected(null);
              }}
            >
              ×
            </button>
            <strong>{inspectedCard.name}</strong>
            <small>{inspectedCard.abilityName || 'FIGHTER ABILITY'}</small>
            <p className="bt-ability-lead">
              {abilitySummary(inspectedCard).lead}
            </p>
            <div className="bt-ability-tags">
              {abilitySummary(inspectedCard).tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <details key={inspectedCard.id}>
              <summary>FULL RULES</summary>
              <p>{inspectedCard.description}</p>
            </details>
            {!selected && liveInspectedStack.length > 1 && (
              <button
                className="bt-stack-next"
                aria-label="Inspect next fighter in this stack"
                onClick={() => {
                  const nextId =
                    liveInspectedStack[
                      (liveInspectedStack.indexOf(inspectedUnitId ?? '') + 1) %
                        liveInspectedStack.length
                    ];
                  const next = game.units.find((unit) => unit.id === nextId);
                  if (next) {
                    setInspectedUnitId(next.id);
                    setInspected(next.cardId);
                  }
                }}
              >
                {liveInspectedStack.indexOf(inspectedUnitId ?? '') + 1} /{' '}
                {liveInspectedStack.length} FIGHTERS →
              </button>
            )}
          </aside>
        )}
        {game.status === 'complete' && resultReady && !menu && (
          <ResultStage
            key={matchKey}
            winner={game.winner}
            reason={game.reason}
            breaches={[
              game.players.player.breaches,
              game.players.opponent.breaches,
            ]}
            hands={[playerHands, opponentHands]}
            stats={game.metrics.player}
            reducedMotion={reducedMotion}
            rematch={reset}
            newDeal={onChangeDeck}
            onExit={onExit}
          />
        )}
        {paused && !menu && !resultReady && game.status === 'playing' && (
          <div className="bt-cover">
            <div className="bt-cover-content">
              <small>{pauseReason}</small>
              <h2>HOLD UP</h2>
              <button
                className="bt-primary"
                onClick={() => setPaused(document.hidden)}
              >
                RESUME →
              </button>
            </div>
          </div>
        )}
      </section>
      {active && (
        <footer className="bt-footer">
          <div className="bt-hand" aria-label="Your hand">
            {occupiedHand.length > 0 &&
              handSlots.current.map((id, slot) => {
                const returning = id
                  ? game.players.player.returnedUnits?.[id]
                  : undefined;
                const card = returning
                  ? unitDefinition(game, returning)
                  : id
                    ? byId.get(id)
                    : undefined;
                if (!card || !id)
                  return (
                    <span
                      key={`empty-${slot}`}
                      className="bt-hand-space"
                      aria-hidden="true"
                    />
                  );
                const liveHands =
                  game.players.player.returnedHands?.[id] ??
                  deploymentBaseHands(game, 'player', id);
                const actionLabel =
                  card.kind === 'blockbuster' ? 'BLOCKBUSTER' : 'SUPPORT';
                const cheapest = Math.min(
                  ...LANES.map((lane) =>
                    deploymentCost(game, 'player', id, lane),
                  ),
                );
                const affordable =
                  cheapest <= game.players.player.motion + 1e-8;
                return (
                  <button
                    key={id}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    onPointerDown={(event) =>
                      dragging.pointerDown(event, id, armed)
                    }
                    onContextMenu={dragging.contextMenu}
                    className={`bt-card ${selected === id ? 'bt-selected' : ''} ${dragging.drag?.cardId === id ? 'bt-drag-source' : ''} ${affordable ? '' : 'bt-unaffordable'}`}
                    disabled={!active}
                    aria-pressed={selected === id}
                    aria-label={`${card.name}, from ${cheapest} Motion, ${isActionCard(card) ? actionLabel : `${liveHands} Hands`}${affordable ? '' : ', insufficient Motion'}`}
                    onClick={() => {
                      setSelected(selected === id ? null : id);
                      setInspected(selected === id ? null : id);
                      setInspectedUnitId(null);
                      setInspectedStack([]);
                      if (!affordable) say(`Need at least ${cheapest} Motion`);
                    }}
                  >
                    <img
                      src={battlePortraitUrl(card.art)}
                      alt=""
                      draggable={false}
                    />
                    <b className="bt-cost">{cheapest}</b>
                    <b className="bt-hands">
                      {isActionCard(card) ? '★' : liveHands}
                    </b>
                    <span>
                      {isActionCard(card) && <small>{actionLabel} · </small>}
                      {card.name}
                    </span>
                  </button>
                );
              })}
            {occupiedHand.length === 0 && (
              <div className="bt-empty-hand">
                {lastStand
                  ? 'NO CARDS LEFT · HOLD THE LINE'
                  : 'NEXT FIGHTER INCOMING'}
              </div>
            )}
          </div>
          {lastStand && (
            <div
              className="bt-next-draw bt-locked-draw"
              aria-label="Draw queue locked. Motion still regenerates."
            >
              <img src={DRAW_LOCK} alt="" />
            </div>
          )}
          {nextCard && (
            <div
              className="bt-next-draw"
              aria-label={`Next draw: ${nextCard.name}, ${nextCard.cost} Motion`}
            >
              <small>NEXT</small>
              <img src={battlePortraitUrl(nextCard.art)} alt="" />
              <b>{nextCard.cost}</b>
            </div>
          )}
          <div className="bt-control-row">
            <div className="bt-motion">
              <img
                className="bt-orb"
                src={getAssetUrl(
                  `assets/combat/supplied/motion-orb${active && !reducedMotion ? '' : '-still'}.webp`,
                )}
                alt=""
              />
              <strong>{Math.floor(game.players.player.motion)}</strong>
              <div
                className="bt-motion-meter"
                role="meter"
                aria-label="Motion"
                aria-valuemin={0}
                aria-valuemax={9}
                aria-valuenow={game.players.player.motion}
              >
                <i
                  style={{
                    width: `${(game.players.player.motion / 9) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="bt-draw-state">
              {lastStand
                ? 'DRAW LOCKED'
                : occupiedHand.length >= 4
                  ? 'HAND READY'
                  : game.players.player.queue.length
                    ? `DRAW IN ${Math.max(0, Math.ceil((game.players.player.nextDrawAt - game.elapsedMs) / 1000))}s`
                    : 'CREW RETURNING'}
              <small>
                {lastStand ? 'MOTION STILL FLOWS' : '+1 MOTION / 2s'}
              </small>
            </div>
            <button
              className={`bt-squabble ${armed ? 'armed' : ''}`}
              disabled={
                !active || game.players.player.squabbleUsed || !!dragging.drag
              }
              aria-pressed={armed}
              onClick={() => setArmed(!armed)}
            >
              <span className="bt-sigil" aria-hidden="true">
                {game.players.player.squabbleUsed ? (
                  <i className="bt-sigil-spent" />
                ) : (
                  <img
                    src={getAssetUrl(
                      `assets/combat/supplied/${armed ? (active && !reducedMotion ? 'squabble-ready.webp' : 'squabble-ready-still.webp') : 'squabble-idle.png'}`,
                    )}
                    alt=""
                  />
                )}
              </span>
              {game.players.player.squabbleUsed
                ? 'USED'
                : armed
                  ? 'ARMED'
                  : 'SQUABBLE'}
            </button>
          </div>
        </footer>
      )}
      {draggedCard && (
        <div className="bt-drag-card" aria-hidden="true">
          <img src={battlePortraitUrl(draggedCard.art)} alt="" />
          <b>{dragCost}</b>
          <span>{draggedCard.name}</span>
        </div>
      )}
      {active && (
        <div className="bt-live-events" aria-live="polite" aria-atomic="true">
          {recentEvents.slice(-1).map((event) => (
            <span key={event.id}>{event.text}</span>
          ))}
        </div>
      )}
      {pendingChoice && active && byId.has(pendingChoice.cardId) && (
        <DeploymentChoicePrompt
          game={game}
          card={byId.get(pendingChoice.cardId)!}
          lane={pendingChoice.lane}
          onCancel={() => setPendingChoice(null)}
          onChoose={(choice) =>
            playLane(
              pendingChoice.lane,
              pendingChoice.cardId,
              pendingChoice.squabble,
              choice,
            )
          }
        />
      )}
      {menu && (
        <div className="bt-modal-backdrop" onClick={() => setMenu(false)}>
          <section
            ref={menuRef}
            className="bt-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Breakthrough practice menu"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="bt-close"
              aria-label="Close practice menu"
              onClick={() => setMenu(false)}
            >
              ×
            </button>
            <small>KUMITE · CPU PRACTICE</small>
            <h2>BREAKTHROUGH</h2>
            <p>No account rewards.</p>
            <button
              className="bt-primary"
              onClick={() => {
                setPaused(document.hidden);
                setMenu(false);
              }}
            >
              RESUME →
            </button>
            <details>
              <summary>HOW TO PLAY</summary>
              <BreakthroughHowToPlay />
            </details>
            <button
              className="bt-sound-toggle"
              aria-pressed={sound}
              onClick={() => void toggleSound()}
            >
              SOUND {sound ? 'ON' : 'OFF'}
            </button>
            <label className="bt-theme-picker">
              Arena
              <select
                value={theme}
                onChange={(event) =>
                  setTheme(event.target.value as 'dojo' | 'rooftop')
                }
              >
                <option value="dojo">After-hours dojo</option>
                <option value="rooftop">Rooftop showdown</option>
              </select>
            </label>
            <button className="bt-text-button" onClick={onChangeDeck}>
              CHANGE DECK ↗
            </button>
            <button className="bt-text-button" onClick={onExit}>
              BACK TO KUMITE ←
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function Batch4Sprite({
  name,
  loop = false,
  className = '',
  style = {},
}: {
  name: Batch4FxName;
  loop?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      data-batch4-fx={name}
      className={`bt-batch4-sprite bt-b4-${name} ${className}`}
      style={
        { '--bt-fx-loops': loop ? 'infinite' : 1, ...style } as CSSProperties
      }
    />
  );
}

/** Short, spatial effects: source trails point to the exact lane contact, never cover the field. */
function AbilityEffect({ event }: { event: BattleEvent }) {
  if (event.lane === undefined || event.position === undefined) return null;
  if (['mend', 'escape'].includes(event.type)) return null;
  const source = event as BattleEvent & {
    sourceLane?: number;
    sourcePosition?: number;
    sourceSide?: 'player' | 'opponent';
  };
  const x = event.lane * 100 + 50;
  const y = 100 - event.position * 100;
  const sx = (source.sourceLane ?? event.lane) * 100 + 50;
  const sy = 100 - (source.sourcePosition ?? event.position) * 100;
  const hasSource =
    source.sourcePosition !== undefined &&
    Math.abs(sx - x) + Math.abs(sy - y) > 1;
  const strike = ['damage', 'burn', 'confiscate'].includes(event.type);
  const guard = ['protect', 'block'].includes(event.type);
  const challenge =
    event.type === 'challenge' || event.type === 'challenge-win';
  if (
    !strike &&
    !guard &&
    !challenge &&
    !['ability', 'buff', 'mend', 'escape'].includes(event.type)
  )
    return null;
  return (
    <g className={`bt-ability-fx bt-ability-fx-${event.type}`}>
      {hasSource && (
        <path
          className="bt-source-trail"
          d={`M ${sx} ${sy} Q ${(sx + x) / 2 + 10} ${(sy + y) / 2} ${x} ${y}`}
        />
      )}
      {event.type === 'ability' && (
        <path
          className="bt-activation-mark"
          d={`M ${x - 13} ${y + 4} L ${x - 16} ${y} L ${x - 13} ${y - 4} M ${x + 13} ${y + 4} L ${x + 16} ${y} L ${x + 13} ${y - 4}`}
        />
      )}
      {strike && (
        <g className="bt-strike-mark">
          <path
            d={`M ${x - 11} ${y + 4} L ${x + 8} ${y - 5} M ${x - 6} ${y + 6} L ${x + 12} ${y - 3}`}
          />
          <path
            className="bt-spark"
            d={`M ${x - 16} ${y - 3} L ${x - 9} ${y - 1} M ${x + 12} ${y + 3} L ${x + 18} ${y + 5}`}
          />
        </g>
      )}

      {challenge && (
        <path
          className="bt-challenge-mark"
          d={`M ${x - 14} ${y - 7} h 6 M ${x - 14} ${y - 7} v 5 M ${x + 14} ${y - 7} h -6 M ${x + 14} ${y - 7} v 5 M ${x - 14} ${y + 7} h 6 M ${x - 14} ${y + 7} v -5 M ${x + 14} ${y + 7} h -6 M ${x + 14} ${y + 7} v -5`}
        />
      )}
      {['buff', 'mend'].includes(event.type) && (
        <path
          className="bt-buff-mark"
          d={`M ${x} ${y + 5} v -10 M ${x - 9} ${y} h 18`}
        />
      )}
      {event.type === 'escape' && (
        <path
          className="bt-escape-mark"
          d={`M ${x - 12} ${y + 5} l 12 -4 -12 -4 M ${x + 1} ${y + 5} l 12 -4 -12 -4`}
        />
      )}
    </g>
  );
}
