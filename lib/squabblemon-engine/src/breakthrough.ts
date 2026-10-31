import {
  SPECIAL_ABILITY_DESCRIPTIONS,
  SPECIAL_TOKEN_DEFINITIONS,
  specialsEntrance,
  specialsEntranceResolved,
  specialsPlayed,
  specialsMoved,
  specialsCaptureReturn,
  specialsReturned,
  specialsDiscount,
  specialsSpendDiscount,
  specialsProtectionConsumed,
  specialsAfterBoardChange,
  specialsTick,
  specialsCanRepeat,
  cloneSpecialsRuntime,
  type SpecialsContext,
  type SpecialsRuntime,
} from './breakthroughSpecials';
import {
  CONTROL_ABILITY_DESCRIPTIONS,
  controlQuoteCost,
  controlSpendCost,
  controlEntrance,
  controlBeforeEntrance,
  controlBeforeMove,
  controlArrived,
  controlMoved,
  controlPlayed,
  controlDeferStatuses,
  controlCleansed,
  controlDamaged,
  controlShieldBlocked,
  controlDestroyed,
  controlPulse,
  cloneControlState,
  type ControlContext,
  type ControlMatchState,
  type ControlStatusChange,
} from './breakthroughControl';
import {
  FACTION_ABILITY_DESCRIPTIONS,
  factionsEntrance,
  factionsPlayed,
  factionsEntranceResolved,
  factionsTick,
  factionsDiscount,
  factionsSpendDiscount,
  factionsRedirectHostile,
  factionsPreventMove,
  factionsAfterHostile,
  cloneFactionState,
  type FactionMatchState,
  type FactionsContext,
} from './breakthroughFactions';
import {
  CONTRACT_ABILITY_DESCRIPTIONS,
  contractsEntrance,
  contractsBeforeEntrance,
  contractsPlayed,
  contractsEntranceResolved,
  contractsArrived,
  contractsCaptureMove,
  contractsMoved,
  contractsGained,
  contractsCleansed,
  contractsDamaged,
  contractsHarmfulStatusApplied,
  contractsDestroyed,
  contractsRefunded,
  contractsDiscount,
  contractsSpendDiscount,
  contractsHasSafeCrossing,
  contractsTick,
  cloneContractsRuntime,
  type ContractsRuntime,
  type ContractsContext,
} from './breakthroughContracts';
import {
  REACTION_ABILITY_DESCRIPTIONS,
  reactionEntrance,
  reactionPlayed,
  reactionMoved,
  reactionGained,
  reactionCleansed,
  reactionDamaged,
  reactionRefunded,
  reactionDestroyed,
  reactionPreventEnemyLoss,
  reactionPulse,
  reactionDeploymentBaseHands,
  cloneReactionState,
  type ReactionMatchState,
  type ReactionContext,
  type ReactionSource,
} from './breakthroughReactions';
import {
  SUMMON_ABILITY_DESCRIPTIONS,
  SUMMON_TOKEN_DEFINITIONS,
  SUMMON_ARTWORK,
  summonEntrance,
  summonPlayed,
  summonMoved,
  summonTick,
  cloneSummonState,
  type SummonMatchState,
  type SummonContext,
} from './breakthroughSummons';
import {
  HOUSE_ABILITY_DESCRIPTIONS,
  houseEntrance,
  housePlayed,
  houseArrived,
  housePreventHostile,
  houseStopDeparture,
  houseSyncOngoing,
  housePulse,
  cloneHouseState,
  type HouseMatchState,
  type HouseContext,
  type HouseHostileKind,
} from './breakthroughHouse';
import {
  NEIGHBORHOOD_ABILITY_DESCRIPTIONS,
  neighborhoodEntrance,
  neighborhoodArrived,
  neighborhoodTick,
  cloneNeighborhoodRuntime,
  type NeighborhoodRuntime,
  type NeighborhoodContext,
} from './breakthroughNeighborhood';
import {
  BLOCKBUSTER_ABILITY_DESCRIPTIONS,
  isBlockbusterAbility,
  blockbusterLegal,
  resolveBlockbuster,
  homelessInvestment,
  recordBlockbusterReduction,
  blockbusterTick,
  cloneBlockbusterState,
  type BlockbusterMatchState,
  type BlockbusterContext,
} from './breakthroughBlockbusters';
import {
  COMMUNITY_ABILITY_DESCRIPTIONS,
  communityEntrance,
  communityArrived,
  communityMoved,
  communityResolvedEntrance,
  communityGained,
  communityEnemyDamage,
  communityPreventLethal,
  communityPulse,
  cloneCommunityState,
  type CommunityMatchState,
  type CommunityContext,
} from './breakthroughCommunity';
import {
  MUSIC_ABILITY_DESCRIPTIONS,
  musicEntrance,
  musicCaptureDeployment,
  musicPlayed,
  musicEntranceResolved,
  musicMoved,
  musicDamaged,
  musicGained,
  musicTick,
  musicCleansed,
  musicDiscount,
  musicSpendDiscount,
  cloneMusicRuntime,
  type BreakthroughMusicRuntime,
  type MusicContext,
  type MusicReturnOptions,
  type MusicDeploymentSnapshot,
} from './breakthroughMusic';
import {
  FITNESS_ABILITY_DESCRIPTIONS,
  fitnessPlayed,
  fitnessEntrance,
  fitnessMoved,
  fitnessAfterBoardChange,
  fitnessEnemyDamage,
  fitnessPulse,
  captureFitnessBoard,
  cloneFitnessState,
  type FitnessMatchState,
  type FitnessContext,
  type FitnessBoardSnapshot,
} from './breakthroughFitness';
import {
  NETWORK_ABILITY_DESCRIPTIONS,
  networkEntrance,
  networkPlayed,
  networkMoved,
  networkInterrupted,
  networkDiscount,
  networkSpendDiscount,
  networkRefill,
  networkTick,
  cloneNetworkState,
  type NetworkMatchState,
  type NetworkContext,
} from './breakthroughNetwork';
import {
  SUPPORT_DESCRIPTIONS,
  isSupportAbility,
  createSupportRuntime,
  cloneSupportRuntime,
  legalSupportTarget,
  resolveSupportAction,
  supportProtectionConsumed,
  supportPreventEnemyDamage,
  supportSuccessfulMove,
  supportCharacterDeployed,
  pruneSupportRuntime,
  type SupportRuntime,
  type SupportView,
  type SupportTools,
  type SupportCause,
} from './breakthroughSupports';
/** Deterministic Breakthrough rules. Never expose private state as a public PvP snapshot. */
export type Side = 'player' | 'opponent';
export type Lane = 0 | 1 | 2;
export type AiStyle = 'rush' | 'counter' | 'support';
export interface TimedStatus {
  id: number;
  kind: 'burn' | 'freeze' | 'silence' | 'weaken';
  targetId: string;
  sourceUnitId: string;
  sourceSide: Side;
  sourceLane: Lane;
  sourcePosition: number;
  appliedAt: number;
  nextTickAt: number;
  expiresAt: number;
  stacks: number;
}
export interface Hazard {
  id: number;
  kind: 'bomb' | 'bud';
  side: Side;
  lane: Lane;
  sourceUnitId: string;
  sourcePosition: number;
  sourceLane: Lane;
  readyAt: number;
}
export interface MatchMetrics {
  deployments: number;
  damage: number;
  healing: number;
  blocks: number;
  breaches: number;
  confiscated: number;
}
export interface ActionTarget {
  unitId?: string;
  /** Explicit authored player choice; omitted choices are never auto-selected. */
  choice?: string;
}
export interface ActionTargetResult {
  valid: boolean;
  error?: string;
  targetUnitId?: string;
}
export interface DeployCommand {
  action?: 'cancel-reinforcement';
  target?: ActionTarget;
  tick: number;
  elapsedMs: number;
  side: Side;
  cardId: string;
  lane: Lane;
  squabble: boolean;
}
export interface Reinforcement {
  id: string;
  order: number;
  cardId: string;
  lane: Lane;
  squabble: boolean;
  cost: number;
  entryBonus?: number;
  choice?: string;
  baseCostSpentLastMotion?: boolean;
  queuedAt: number;
}
export interface FighterDefinition {
  kind?: 'character' | 'support' | 'blockbuster' | 'token';
  /** Canonical gameplay identity; presentation names and crew labels never select rules. */
  engineId?: string;
  faction?: string;
  crewTags?: readonly string[];
  traits?: readonly (
    'music' | 'fitness' | 'family' | 'homeless' | 'squabblehouse'
  )[];
  gangColor?: 'red' | 'blue';
  cannotLoseHands?: boolean;
  cannotBeSilenced?: boolean;
  allowedLanes?: readonly Lane[];
  triggers?: readonly ('entrance' | 'ongoing' | 'held')[];
  choice?: 'investment' | 'concert' | 'wager';
  action?: {
    target: 'none' | 'weakest-ally' | 'weakest-afflicted-ally';
    requiresFriendlyFighter: boolean;
  };
  id: string;
  name: string;
  cost: number;
  hands: number;
  art: string;
  ability?: keyof typeof ABILITY_DESCRIPTIONS;
  element?: string;
  abilityName?: string;
  printedDescription?: string;
  tacticalRoles?: readonly ('support' | 'control')[];
  description: string;
}
export interface Unit {
  origin?: 'deck' | 'summon';
  summonKind?: 'fighter' | 'mushroom';
  sourceUnitId?: string;
  canFight?: boolean;
  canBreach?: boolean;
  countsHands?: boolean;
  art?: string;
  /** Runtime kit overlays preserve original collectible identity and immutable traits. */
  copiedAbility?: FighterDefinition['ability'];
  copiedTriggers?: FighterDefinition['triggers'];
  formBaseHands?: number;
  formCost?: number;
  /** Fight-only borrowing never transfers deck/account ownership. */
  originalOwner?: Side;
  /** Generic immunity can be scoped to hostile abilities for summoned Guyana. */
  immunityScope?: 'abilities';
  /** Mary keeps active timed contracts while absent; their clocks keep expiring. */
  suspendedStatuses?: TimedStatus[];
  id: string;
  cardId: string;
  side: Side;
  lane: Lane;
  position: number;
  hands: number;
  baseHands: number;
  squabbled: boolean;
  maxHands: number;
  nextEffectAt: number;
  frozen?: boolean;
  silenced?: boolean;
  weakened?: boolean;
  burnStacks?: number;
  deployedAt?: number;
  arrivalOrder?: number;
  growAt?: number;
  lunch?: {
    sourceUnitId: string;
    sourceSide: Side;
    sourceLane: Lane;
    sourcePosition: number;
  };
  familyTargetId?: string;
  gangColor?: 'red' | 'blue';
  /** Source-owned movement contracts do not freeze combat or stall friendly traffic. */
  movementLocks?: { sourceId: string; expiresAt: number }[];
  entranceSucceeded?: boolean;
  /** Original paid lane survives an ability-only DMV delay. */
  entrancePaidLane?: Lane;
  entranceChoice?: string;
  baseCostSpentLastMotion?: boolean;
  protected?: boolean;
  immune?: boolean;
  damageTaken?: number;
  challenge?: {
    targetId: string;
    lane: Lane;
    expiresAt: number;
  };
}
export interface BattleEvent {
  /** Private reveal events are visible only to this seat, never spectators. */
  visibleTo?: Side;
  id: number;
  type: string;
  side?: Side;
  lane?: number;
  position?: number;
  amount?: number;
  /** Presentation provenance; never changes the resolved amount or timing. */
  damageKind?: 'burn';
  targetUnitId?: string;
  cardId?: string;
  sourceUnitId?: string;
  sourceSide?: Side;
  sourceLane?: Lane;
  sourcePosition?: number;
  text: string;
}
export interface PlayerState {
  motion: number;
  hand: string[];
  queue: string[];
  reinforcements: Reinforcement[];
  breaches: number;
  squabbleUsed: boolean;
  returns: {
    cardId: string;
    readyAt: number;
  }[];
  nextDrawAt: number;
  insideManPayouts?: number;
  insideManReadyAt?: number;
  discount?: {
    origin: Lane;
  };
  handAuraAt?: Record<string, number>;
  finnamReadyAt?: number;
  sideEyeReadyAt?: number;
  churchReadyAt?: number;
  transferTicket?: boolean;
  familyRetaliationUsed?: boolean;
  familyFollowUsed?: boolean;
  returnedHands?: Record<string, number>;
  returnedUnits?: Record<string, Unit>;
}
export interface GameState {
  tick: number;
  elapsedMs: number;
  durationMs: number;
  status: 'playing' | 'complete';
  /** Once Last Stand begins, a late extension cannot restart the draw engine. */
  drawsLocked?: boolean;
  winner: Side | 'draw' | null;
  reason: string | null;
  units: Unit[];
  players: Record<Side, PlayerState>;
  events: BattleEvent[];
  roster: FighterDefinition[];
  seed: number;
  travelMs: number;
  accumulatorMs: number;
  nextUnitId: number;
  nextEventId: number;
  ruleset: string;
  decks: Record<Side, string[]>;
  effectsRng: number;
  aiSeed: number;
  aiStyle: AiStyle;
  statuses: TimedStatus[];
  hazards: Hazard[];
  nextEffectId: number;
  metrics: Record<Side, MatchMetrics>;
  commands: DeployCommand[];
  supportRuntime?: SupportRuntime;
  network?: NetworkMatchState;
  fitness?: FitnessMatchState;
  music?: BreakthroughMusicRuntime;
  community?: CommunityMatchState;
  blockbusters?: BlockbusterMatchState;
  house?: HouseMatchState;
  neighborhood?: NeighborhoodRuntime;
  summons?: SummonMatchState;
  reactions?: ReactionMatchState;
  contracts?: ContractsRuntime;
  factions?: FactionMatchState;
  control?: ControlMatchState;
  specials?: SpecialsRuntime;
}
export const RULES = {
  tickMs: 50,
  durationMs: 180000,
  travelMs: 25000,
  motionCap: 9,
  motionPerSecond: 0.5,
  startingMotion: 4,
  handSize: 4,
  drawMs: 3000,
  returnMs: 8000,
  lastStandMs: 30000,
  spacing: 0.22,
} as const;
export const BREAKTHROUGH_RULESET = 'breakthrough-v9-full-catalog';
export const ABILITY_DESCRIPTIONS = {
  ...SUPPORT_DESCRIPTIONS,
  ...NETWORK_ABILITY_DESCRIPTIONS,
  ...FITNESS_ABILITY_DESCRIPTIONS,
  ...MUSIC_ABILITY_DESCRIPTIONS,
  ...COMMUNITY_ABILITY_DESCRIPTIONS,
  ...BLOCKBUSTER_ABILITY_DESCRIPTIONS,
  ...HOUSE_ABILITY_DESCRIPTIONS,
  ...NEIGHBORHOOD_ABILITY_DESCRIPTIONS,
  ...SUMMON_ABILITY_DESCRIPTIONS,
  ...REACTION_ABILITY_DESCRIPTIONS,
  ...CONTRACT_ABILITY_DESCRIPTIONS,
  ...FACTION_ABILITY_DESCRIPTIONS,
  ...CONTROL_ABILITY_DESCRIPTIONS,
  ...SPECIAL_ABILITY_DESCRIPTIONS,
  'transfer-ticket':
    'Action: issue one Transfer Ticket. Your next character costs1 less Motion and arrives with+2 Hands. Supports never spend it; tickets do not stack.',
  'full-plate':
    'Action: fully cleanse your weakest afflicted friendly fighter here, otherwise your weakest friendly fighter here, then give it+3 Hands. Requires a friendly fighter.',
  'liquid-courage':
    'Action: your weakest friendly fighter here gains+3 Hands, or+4 if Fire. Requires a friendly fighter.',
  'mama-bear':
    'Deploy: name your weakest other local ally as family. Once per match, follow its successful legal lane move. Once per match, after an enemy damages it, hit the surviving attacker for2; if family was defeated, also gain+2. Mother must remain active; recycled copies never reset these limits.',
  unaware:
    'Deploy: Silence the strongest active Ongoing enemy here, otherwise the strongest enemy here, for10 seconds. Bypass Side Eye, but Protection and immunity still block. Newly interrupting an active Ongoing ability grants+1 and privately reveals one enemy hand card.',
  none: 'No extra audition ability.',
  burn: 'Every 5 seconds after deployment, deal 1 Hands to the nearest enemy in this lane.',
  mend: 'Every 6 seconds after deployment, restore 1 actual damage to this fighter, up to its starting Hands.',
  push: 'On deployment, push the nearest enemy in this lane 6% toward its home, stopping at another fighter or the base boundary.',
  'personal-security':
    'Deploy: weakest other ally here gains +2 and Protection. Confiscate up to 4 bonus Hands from the most boosted enemy here; otherwise hit the strongest for 2.',
  'read-the-strike':
    'Deploy: hit the strongest enemy here for 4 if it is stronger than Franklin or boosted; gain +3 only if damage lands. Otherwise give the weakest ally in another lane +3 and Protection.',
  'no-mercy':
    'Deploy: hit the strongest enemy in each lane for 2. Gain +1 per enemy actually damaged, up to +3.',
  'secret-technique':
    'Deploy: target the most boosted enemy here, otherwise the costliest 4+ Motion enemy, otherwise the strongest. Hit for 4 if boosted or costing 4+, otherwise 2. Gain +1 only if damage lands.',
  'inside-man':
    'After an enemy entrance here resolves: confiscate up to 2 bonus Hands, then deal 2 damage; gain only what was actually taken, up to 4. Escape to the weakest open other lane. Shared 10-second cooldown and two payouts per side per match.',
  'whos-the-master':
    'Deploy: confiscate up to 5 bonus Hands from the most boosted enemy here and gain only that amount; if none is boosted, hit the strongest for 3.',
  'golden-glow':
    'Deploy: confiscate up to 4 bonus Hands from the most boosted enemy here, then hit for 2; otherwise hit the strongest for 2. With three friendly elements, gain +3 and Protection.',
  'black-blade':
    'Deploy: weakest unprotected other ally here gains +2 and Protection. Hit the strongest enemy here for 2.',
  'ankle-breaker':
    'Deploy: challenge the strongest enemy here for 10 seconds. If it changes lanes, gain +3. Otherwise hit it for 3 at expiry and gain +1. Defeated or scoring targets cancel the challenge. One challenge per deployment.',
  'still-standing':
    'Deploy: if enemies here outnumber your other friendly fighters here, gain +3 Hands.',
  connections:
    'Deploy: your next successful card in another lane costs 1 less Motion. One pending token, minimum cost0; failed plays never consume it.',
  'check-in':
    'Deploy: your lowest-Hands other ally here gains +3; cleanse its Freeze and Silence.',
  'ratios-receipts':
    'Deploy: the strongest enemy here receives1 Burn and1 damage, or2 damage if deployed within the last10 seconds. Burn deals1 per stack every2 seconds for6 seconds, at most3 stacks. Protection blocks the whole entrance package.',
  'smile-bombs':
    'Deploy: plant4 bombs in seeded random enemy lanes. After10 seconds each hits a seeded random enemy there for2. Only this still-living Kyle gains +1 per actual hit and +1 per KO. Bombs persist if Kyle leaves; empty blasts expire harmlessly.',
  'eat-something':
    'Deploy: weakest injured ally anywhere gains+1, heals up to3 actual damage and gains Protection. Otherwise weakest other local ally gains+1, Protection and one lunch healing up to2 of its first later enemy hit if it survives. While held, every10 seconds buff friendly Light fighters+1. Lunch persists after Abuela leaves.',
  finnam:
    'Deploy: gain+1 per other friendly fighter, max+5; hit every enemy for1. Shared10-second activation cooldown per side. While held, every10 seconds buff friendly Fire fighters+1.',
  'buddy-buds':
    'Audition Squabble adds base Hands only; no Earth-form ability. While active in its lane, normal unsquabbled Buddy discounts friendly plays there by1, minimum0 (non-stacking). Deploy: plant buds in2 or3 seeded distinct eligible lanes, max1 pending friendly bud per lane. After20 seconds Buddy gains+3 if still present; buds give+3 to the latest-arriving friendly fighter there. Buds survive Buddy leaving; no planting too late to sprout.',
  'cold-shoulder':
    'Deploy: Freeze the strongest enemy here for10 seconds, or until cleansed. Frozen fighters keep stored Hands but contribute0 to combat and timeout, stop marching and cannot use active abilities. Teammates can pass a frozen ally. A positive-Hands contact defeats a frozen fighter.',
  'still-rapping':
    'Deploy: Silence the strongest active Ongoing enemy here, otherwise the strongest enemy here, for10 seconds or until cleansed. Protection, Side Eye and immunity apply.',
  'new-here':
    'Deploy: if you have no other fighter in this lane, gain +1 Hands.',
  'small-time-heat':
    'Deploy: apply1 Burn to every enemy here. Burn ticks every2 seconds for6 seconds; this wave caps Burn at4 stacks.',
  'good-vibes':
    'Deploy: cleanse Freeze and Silence from the weakest affected other ally here and give it+2 Hands. Otherwise give the weakest other ally here+1. Burn and Weaken remain.',
  'hairline-link':
    'Deploy: gain+2 Hands if another friendly fighter here costs2 Motion or less.',
  'squad-check':
    'Deploy: gain+1 Hands if you have a friendly fighter in another lane.',
  'deep-crew':
    'Deploy: gain+3 Hands if at least2 other friendly fighters are here.',
  'old-head':
    'Deploy: if enemies outnumber your whole board including this fighter, gain+3. If they have at least3 more, also hit their weakest fighter here for1.',
  'bull-rush':
    'Deploy: gain+1 Hands; apply1 Burn to the strongest enemy here, plus1 against Plant. Burn ticks every2 seconds for6 seconds, max4 stacks.',
  'ride-out':
    'Deploy: ride to your weakest other open lane without changing progress. Gain+1 only if you arrive. Cannot jump past or overlap a defender.',
  'bring-the-vibe':
    'Deploy: bring your weakest movable ally from another lane here, preserving its progress. Both gain+1 only on arrival. Frozen allies and blocked destinations cannot move.',
  'water-break':
    'Deploy: regain1 Motion if another friendly fighter is here, capped at9.',
  'fade-and-coach':
    'Deploy: hit the strongest enemy here for2; give your weakest ally in another lane+2 Hands. Each part resolves independently.',
  'badge-sweep':
    'Deploy: apply Weaken for10 seconds to every enemy here; gain+1 per unblocked application. Weaken disables active abilities without reducing Hands or stopping movement.',
  'whole-block-hot':
    'Deploy: apply3 Burn to every enemy, plus1 against Plant; give every other friendly Fire fighter+1. Burn ticks every2 seconds for6 seconds, max4 stacks.',
  'block-party':
    'Deploy: bring the weakest movable ally from each other lane here, preserving progress. Gain+1 per actual arrival, max+2. Frozen allies and defended destinations cannot move.',
  'iron-driver':
    'Deploy: gain+1 per other friendly Earth fighter across the board, max+4. With at least2 other Earth allies here, hit the strongest enemy here for2.',
  'double-knuckle':
    'Deploy: hit up to2 different strongest enemies here for2 each. Every strike separately respects defenses.',
  'big-zoey-transfer':
    'Deploy: give your weakest other ally here+2 Hands; hit the weakest enemy here for2. Each part resolves independently.',
  'clean-cut':
    'Deploy: trim up to2 bonus Hands from the most boosted enemy here and give the actual amount to your weakest other local ally. With no boosted enemy, give that ally+1. While held, every10 seconds buff your Normal fighters+1.',
  'church-shield':
    'Deploy: give your weakest other local ally+3 if Light, otherwise+2, and Protection. While active, the first Protection or Side Eye block on your Light fighter grants it+2; shared10-second cooldown per side.',
  'side-eye':
    'While active, block the first hostile ability package aimed at an ally in this lane, including this fighter. Shared10-second cooldown per side. Does not stop collision damage.',
} as const;
export function hasTacticalRole(
  card: FighterDefinition,
  role: 'support' | 'control',
): boolean {
  if (card.tacticalRoles) return card.tacticalRoles.includes(role);
  return (
    role === 'support'
      ? [
          'personal-security',
          'black-blade',
          'read-the-strike',
          'check-in',
          'eat-something',
          'buddy-buds',
          'connections',
        ]
      : [
          'cold-shoulder',
          'still-rapping',
          'inside-man',
          'whos-the-master',
          'ratios-receipts',
          'secret-technique',
        ]
  ).includes(card.ability ?? '');
}
const sides: Side[] = ['player', 'opponent'];
const other = (side: Side): Side => (side === 'player' ? 'opponent' : 'player');
function clone(state: GameState): GameState {
  return {
    ...state,
    supportRuntime: cloneSupportRuntime(state.supportRuntime),
    ...(state.network ? { network: cloneNetworkState(state.network) } : {}),
    ...(state.fitness ? { fitness: cloneFitnessState(state.fitness) } : {}),
    ...(state.music ? { music: cloneMusicRuntime(state.music) } : {}),
    ...(state.community
      ? { community: cloneCommunityState(state.community) }
      : {}),
    ...(state.blockbusters
      ? { blockbusters: cloneBlockbusterState(state.blockbusters) }
      : {}),
    ...(state.house ? { house: cloneHouseState(state.house) } : {}),
    ...(state.neighborhood
      ? { neighborhood: cloneNeighborhoodRuntime(state.neighborhood) }
      : {}),
    ...(state.summons ? { summons: cloneSummonState(state.summons) } : {}),
    ...(state.reactions
      ? { reactions: cloneReactionState(state.reactions) }
      : {}),
    ...(state.contracts
      ? { contracts: cloneContractsRuntime(state.contracts) }
      : {}),
    ...(state.factions ? { factions: cloneFactionState(state.factions) } : {}),
    ...(state.control ? { control: cloneControlState(state.control) } : {}),
    ...(state.specials
      ? { specials: cloneSpecialsRuntime(state.specials) }
      : {}),
    units: state.units.map((u) => ({
      ...u,
      ...(u.challenge ? { challenge: { ...u.challenge } } : {}),
      ...(u.copiedTriggers ? { copiedTriggers: [...u.copiedTriggers] } : {}),
      ...(u.suspendedStatuses
        ? { suspendedStatuses: u.suspendedStatuses.map((x) => ({ ...x })) }
        : {}),
      ...(u.lunch ? { lunch: { ...u.lunch } } : {}),
      ...(u.movementLocks
        ? { movementLocks: u.movementLocks.map((x) => ({ ...x })) }
        : {}),
    })),
    events: [...state.events],
    statuses: state.statuses.map((x) => ({ ...x })),
    hazards: state.hazards.map((x) => ({ ...x })),
    commands: state.commands.map((x) => ({
      ...x,
      ...(x.target ? { target: { ...x.target } } : {}),
    })),
    metrics: {
      player: { ...state.metrics.player },
      opponent: { ...state.metrics.opponent },
    },
    players: Object.fromEntries(
      sides.map((side) => [
        side,
        {
          ...state.players[side],
          hand: [...state.players[side].hand],
          queue: [...state.players[side].queue],
          reinforcements: (state.players[side].reinforcements ?? []).map(
            (r) => ({ ...r }),
          ),
          returns: state.players[side].returns.map((r) => ({ ...r })),
          handAuraAt: { ...state.players[side].handAuraAt },
          returnedHands: { ...state.players[side].returnedHands },
          ...(state.players[side].returnedUnits
            ? {
                returnedUnits: structuredClone(
                  state.players[side].returnedUnits,
                ),
              }
            : {}),
          ...(state.players[side].discount
            ? { discount: { ...state.players[side].discount } }
            : {}),
        },
      ]),
    ) as Record<Side, PlayerState>,
  };
}
function event(s: GameState, data: Omit<BattleEvent, 'id'>) {
  if (data.side) {
    const m = s.metrics[data.side];
    if (data.type === 'deploy') m.deployments++;
    if (data.type === 'block') m.blocks++;
    if (data.type === 'breach') m.breaches++;
    if (data.type === 'mend') m.healing += data.amount ?? 0;
    if (data.type === 'damage' || data.type === 'burn')
      s.metrics[other(data.side)].damage += data.amount ?? 0;
    if (data.type === 'confiscate')
      s.metrics[other(data.side)].confiscated += data.amount ?? 0;
  }
  s.events.push({ id: s.nextEventId++, ...data });
  if (s.events.length > 64) s.events.shift();
}
function period(s: GameState, u: Unit) {
  return definition(s, u).ability === 'mend' ? 6000 : 5000;
}
function nearest(s: GameState, u: Unit) {
  return fighterUnits(s)
    .filter((v) => v.side !== u.side && v.lane === u.lane && v.hands > 0)
    .sort(
      (a, b) =>
        Math.abs(a.position - u.position) - Math.abs(b.position - u.position) ||
        a.id.localeCompare(b.id),
    )[0];
}
function remove(s: GameState, dead: Set<string>) {
  s.units = s.units.filter((u) => {
    if (!dead.has(u.id)) return true;
    if (u.hands <= 0) {
      reactionDestroyed(reactionContext(s), u);
      event(s, {
        type: 'defeat',
        targetUnitId: u.id,
        cardId: u.cardId,
        side: u.side,
        lane: u.lane,
        position: u.position,
        text: 'KO',
      });
    }
    if (u.origin !== 'summon')
      s.players[u.originalOwner ?? u.side].returns.push({
        cardId: u.cardId,
        readyAt: s.elapsedMs + RULES.returnMs,
      });
    return false;
  });
  s.statuses = s.statuses.filter((x) => !dead.has(x.targetId));
  houseSyncOngoing(houseContext(s));
  fitnessAfterBoardChange(fitnessContext(s));
}
// Positive effective modifiers alone are removable; printed Hands never are.
export function removableBonusHands(unit: Unit): number {
  return Math.max(0, unit.hands - unit.baseHands);
}
/** Index only immutable identity positions; actual entries are read on every use.
 * This observes same-ID replacements/mutations, while append/remove/reorder/miss
 * rebuilds the per-array index. No cache enters serialized match state. */
const rosterDefinitionIndices = new WeakMap<
  FighterDefinition[],
  { length: number; indices: Map<string, number> }
>();
function printedDefinition(roster: FighterDefinition[], id: string) {
  const rebuild = () => {
    const indices = new Map<string, number>();
    roster.forEach((card, index) => {
      if (!indices.has(card.id)) indices.set(card.id, index);
    });
    const value = { length: roster.length, indices };
    rosterDefinitionIndices.set(roster, value);
    return value;
  };
  let indexed = rosterDefinitionIndices.get(roster);
  if (!indexed || indexed.length !== roster.length) indexed = rebuild();
  let index = indexed.indices.get(id);
  if (index === undefined || roster[index]?.id !== id) {
    indexed = rebuild();
    index = indexed.indices.get(id);
  }
  return index === undefined ? undefined : roster[index];
}
/** Runtime presentation/rules retain the owning collectible's identity and traits. */
export function unitDefinition(s: GameState, u: Unit): FighterDefinition {
  const printed = printedDefinition(s.roster, u.cardId)!;
  if (
    printed &&
    !u.copiedAbility &&
    u.formBaseHands === undefined &&
    u.formCost === undefined &&
    !u.art
  )
    return printed;
  return {
    ...printed,
    ...(u.copiedAbility
      ? {
          ability: u.copiedAbility,
          triggers: u.copiedTriggers ?? ['ongoing'],
          description: ABILITY_DESCRIPTIONS[u.copiedAbility],
          abilityName:
            s.roster.find((c) => c.ability === u.copiedAbility)?.abilityName ??
            'COPIED KIT',
        }
      : {}),
    ...(u.formBaseHands !== undefined ? { hands: u.formBaseHands } : {}),
    ...(u.formCost !== undefined ? { cost: u.formCost } : {}),
    ...(u.art ? { art: u.art } : {}),
  };
}
const definition = unitDefinition;
function strength(units: Unit[], weakest = false) {
  return [...units].sort(
    (a, b) =>
      (weakest
        ? effectiveHands(a) - effectiveHands(b)
        : effectiveHands(b) - effectiveHands(a)) || a.id.localeCompare(b.id),
  )[0];
}
function bonusTarget(units: Unit[]) {
  return [...units]
    .filter((u) => removableBonusHands(u) > 0)
    .sort(
      (a, b) =>
        removableBonusHands(b) - removableBonusHands(a) ||
        b.hands - a.hands ||
        a.id.localeCompare(b.id),
    )[0];
}
function gain(
  s: GameState,
  u: Unit,
  amount: number,
  copied = false,
  from?: ReactionSource,
) {
  from ??= effectSources.get(s);
  if (amount <= 0 || u.hands <= 0 || u.canFight === false) return;
  u.hands += amount;
  u.maxHands += amount;
  event(s, {
    type: 'buff',
    side: u.side,
    lane: u.lane,
    position: u.position,
    amount,
    text: `+${amount}`,
  });
  musicGained(musicContext(s), u, amount);
  communityGained(communityContext(s), u, amount, copied);
  reactionGained(reactionContext(s), u, amount, copied, from, amount);
  contractsGained(contractsContext(s), u, amount, copied);
  houseSyncOngoing(houseContext(s));
  fitnessAfterBoardChange(fitnessContext(s));
}
function protect(s: GameState, u: Unit) {
  if (u.protected) return;
  u.protected = true;
  event(s, {
    type: 'protect',
    side: u.side,
    lane: u.lane,
    position: u.position,
    text: 'PROTECTED',
  });
}
interface StatusPackageFrame {
  targetId: string;
  source?: Unit;
  changes: ControlStatusChange[];
}
const statusPackages = new WeakMap<GameState, StatusPackageFrame[]>();
const controlSplashDepth = new WeakMap<GameState, number>();
function pendingAppeal(s: GameState, target: Unit): boolean {
  return !!s.control?.appeals.some(
    (x) => x.targetId === target.id && !x.pending && x.expiresAt > s.elapsedMs,
  );
}
function sourceUnit(s: GameState, source: DamageSource): Unit {
  const live = s.units.find((u) => u.id === source.sourceUnitId),
    inherited = effectSources.get(s);
  return (
    live ?? {
      id: source.sourceUnitId,
      cardId: inherited?.id === source.sourceUnitId ? inherited.cardId : '',
      side: source.sourceSide,
      lane: source.sourceLane,
      position: source.sourcePosition,
      hands: 1,
      baseHands: 1,
      maxHands: 1,
      squabbled: false,
      nextEffectAt: Infinity,
    }
  );
}
/** A client delays the entire new-status batch, while damage in the same packet
 * stays immediate. Staging avoids firing status reactions before an Appeal. */
function stageAppealedStatus(
  s: GameState,
  source: Unit,
  target: Unit,
  change: ControlStatusChange,
): boolean {
  const frame = statusPackages.get(s)?.at(-1);
  if (
    !frame ||
    frame.targetId !== target.id ||
    source.side === target.side ||
    !pendingAppeal(s, target)
  )
    return false;
  frame.source ??= structuredClone(source);
  frame.changes.push({ ...change });
  return true;
}
function withStatusPackage(
  s: GameState,
  target: Unit,
  attacker: DamageSource | undefined,
  apply: () => void,
): void {
  if (!pendingAppeal(s, target)) {
    apply();
    return;
  }
  const frame: StatusPackageFrame = { targetId: target.id, changes: [] },
    frames = statusPackages.get(s) ?? [];
  const locks = (target.movementLocks ?? []).map((x) => ({ ...x }));
  frames.push(frame);
  statusPackages.set(s, frames);
  try {
    apply();
  } finally {
    frames.pop();
    if (!frames.length) statusPackages.delete(s);
  }
  // Older authored movement contracts write their source-owned lock directly.
  // Capture only new/extended locks; unrelated old restrictions remain intact.
  if (
    attacker &&
    attacker.sourceSide !== target.side &&
    pendingAppeal(s, target)
  ) {
    const added = (target.movementLocks ?? []).filter(
      (x) =>
        !locks.some(
          (old) => old.sourceId === x.sourceId && old.expiresAt >= x.expiresAt,
        ),
    );
    if (added.length) {
      frame.source ??= structuredClone(sourceUnit(s, attacker));
      for (const lock of added)
        frame.changes.push({
          kind: 'lock',
          sourceId: lock.sourceId,
          durationMs: Math.max(0, lock.expiresAt - s.elapsedMs),
        });
      target.movementLocks = locks;
    }
  }
  if (
    frame.source &&
    frame.changes.length &&
    !controlDeferStatuses(
      controlContext(s),
      frame.source,
      target,
      frame.changes,
    )
  )
    for (const change of frame.changes)
      applyControlStatus(s, frame.source, target, change, true);
}
function hostile(
  s: GameState,
  selected: Unit,
  apply: (actualTarget: Unit) => void,
  bypassSideEye = false,
  houseKind: HouseHostileKind = 'harm',
  ignoreProtection = false,
  attacker?: DamageSource,
): boolean {
  if (selected.hands <= 0 || selected.canFight === false) return false;
  // Original-target immunity resolves before an interception may redirect it.
  if (selected.immune) {
    event(s, {
      type: 'block',
      side: selected.side,
      lane: selected.lane,
      position: selected.position,
      text: 'IMMUNE',
    });
    return false;
  }
  const inherited = effectSources.get(s);
  attacker ??= inherited ? sourceMark(inherited) : undefined;
  const early = factionsRedirectHostile(factionsContext(s), selected, 'early');
  const resolve = (target: Unit, allowDog: boolean): boolean => {
    if (target.hands <= 0) return false;
    if (target.immune) {
      event(s, {
        type: 'block',
        side: target.side,
        lane: target.lane,
        position: target.position,
        text: 'IMMUNE',
      });
      return false;
    }
    const guard =
      !bypassSideEye &&
      (s.players[target.side].sideEyeReadyAt ?? 0) <= s.elapsedMs
        ? fighterUnits(s)
            .filter(
              (u) =>
                u.side === target.side &&
                u.lane === target.lane &&
                activeUnit(u) &&
                definition(s, u).ability === 'side-eye',
            )
            .sort((a, b) => a.id.localeCompare(b.id))[0]
        : undefined;
    if (guard) {
      s.players[target.side].sideEyeReadyAt = s.elapsedMs + 10000;
      event(s, {
        type: 'block',
        side: target.side,
        lane: target.lane,
        position: target.position,
        ...sourceMark(guard),
        text: 'SIDE EYE',
      });
      churchBlock(s, target);
      return false;
    }
    if (target.protected && !ignoreProtection) {
      target.protected = false;
      supportProtectionConsumed(
        (s.supportRuntime ??= createSupportRuntime()),
        target,
        supportTools(s),
      );
      event(s, {
        type: 'block',
        side: target.side,
        lane: target.lane,
        position: target.position,
        targetUnitId: target.id,
        text: 'BLOCKED',
      });
      churchBlock(s, target);
      if (attacker) {
        notifyShieldBlocked(s, attacker, target);
        const helper = sourceUnit(s, attacker);
        if (helper)
          specialsProtectionConsumed(specialsContext(s), target, helper);
      }
      return false;
    }
    if (allowDog) {
      const dog = factionsRedirectHostile(factionsContext(s), target, 'dog');
      if (dog.receipt) {
        try {
          return resolve(dog.target, false);
        } finally {
          factionsAfterHostile(factionsContext(s), dog.receipt);
        }
      }
    }
    if (
      housePreventHostile(
        houseContext(s),
        target,
        attacker?.sourceSide ?? other(target.side),
        houseKind,
      )
    )
      return false;
    if (
      houseKind === 'staff-exit' &&
      factionsPreventMove(factionsContext(s), target)
    )
      return false;
    withStatusPackage(s, target, attacker, () => apply(target));
    return true;
  };
  try {
    return resolve(early.target, true);
  } finally {
    if (early.receipt) factionsAfterHostile(factionsContext(s), early.receipt);
  }
}
function notifyShieldBlocked(
  s: GameState,
  source: DamageSource,
  target: Unit,
): void {
  controlShieldBlocked(
    controlContext(s),
    source.sourceSide,
    source.sourceUnitId,
    target,
  );
}
function packet(
  s: GameState,
  source: ReactionSource,
  target: Unit,
  apply: (actual: Unit) => void,
  kind: HouseHostileKind = 'harm',
): boolean {
  return withEffectSource(s, source, () =>
    hostile(s, target, apply, false, kind, false, sourceMark(source)),
  );
}
function churchBlock(s: GameState, target: Unit) {
  if (
    definition(s, target).element !== 'Light' ||
    (s.players[target.side].churchReadyAt ?? 0) > s.elapsedMs
  )
    return;
  const source = fighterUnits(s)
    .filter(
      (u) =>
        u.side === target.side &&
        activeUnit(u) &&
        definition(s, u).ability === 'church-shield',
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!source) return;
  s.players[target.side].churchReadyAt = s.elapsedMs + 10000;
  const first = s.nextEventId;
  gain(s, target, 2);
  attributeEvents(s, first, source);
}
type DamageSource = ReturnType<typeof sourceMark>;
function hurt(
  s: GameState,
  target: Unit,
  amount: number,
  damageKind?: 'burn',
  eventType: 'damage' | 'burn' = 'damage',
  attacker?: DamageSource,
): number {
  if (attacker && attacker.sourceSide !== target.side)
    amount -= preventEnemyDamage(s, target, amount, attacker);
  amount -= communityPreventLethal(communityContext(s), target, amount);
  if (!canLoseHands(s, target)) return 0;
  const actual = Math.min(Math.max(0, target.hands), amount);
  if (!actual) return 0;
  target.damageTaken =
    (target.damageTaken ?? Math.max(0, target.maxHands - target.hands)) +
    actual;
  target.hands -= actual;
  recordBlockbusterReduction(blockbusterContext(s), target, actual);
  event(s, {
    type: eventType,
    targetUnitId: target.id,
    cardId: target.cardId,
    side: target.side,
    lane: target.lane,
    position: target.position,
    amount: actual,
    ...(damageKind ? { damageKind } : {}),
    ...(attacker ?? {}),
    text: `−${actual}`,
  });
  useLunch(s, target, actual);
  if (attacker) {
    reactionDamaged(reactionContext(s), attacker, target, actual, {
      ability: true,
      burn: damageKind === 'burn',
    });
    contractsDamaged(
      contractsContext(s),
      { id: attacker.sourceUnitId, side: attacker.sourceSide },
      target,
      actual,
    );
    if (target.hands <= 0)
      contractsDestroyed(
        contractsContext(s),
        target,
        attacker.sourceSide,
        true,
      );
    retaliateFamily(s, target, attacker);
    fitnessEnemyDamage(fitnessContext(s), attacker.sourceSide, target, actual);
    musicDamaged(musicContext(s), {
      source: { side: attacker.sourceSide },
      victim: target,
      amount: actual,
    });
    communityEnemyDamage(
      communityContext(s),
      attacker.sourceSide,
      target,
      actual,
      damageKind === 'burn',
    );
    controlDamaged(
      controlContext(s),
      attacker.sourceSide,
      attacker.sourceUnitId,
      target,
      actual,
      {
        burn: damageKind === 'burn',
        splash: (controlSplashDepth.get(s) ?? 0) > 0,
      },
    );
    if (target.hands <= 0)
      controlDestroyed(controlContext(s), target, attacker.sourceSide, {
        splash: (controlSplashDepth.get(s) ?? 0) > 0,
      });
  }
  fitnessAfterBoardChange(fitnessContext(s));
  return actual;
}
function confiscate(s: GameState, target: Unit, cap: number): number {
  if (!canLoseHands(s, target)) return 0;
  const amount = Math.min(cap, removableBonusHands(target));
  if (!amount) return 0;
  target.hands -= amount;
  target.maxHands -= amount;
  event(s, {
    type: 'confiscate',
    side: target.side,
    lane: target.lane,
    position: target.position,
    amount,
    text: `−${amount} BONUS`,
  });
  recordBlockbusterReduction(blockbusterContext(s), target, amount);
  fitnessAfterBoardChange(fitnessContext(s));
  return amount;
}
function strike(
  s: GameState,
  target: Unit | undefined,
  amount: number,
  source?: Unit | DamageSource,
): number {
  if (!target) return 0;
  const cause = source ?? effectSources.get(s);
  const attacker = cause && ('id' in cause ? sourceMark(cause) : cause);
  let actual = 0;
  hostile(
    s,
    target,
    (recipient) => {
      actual = hurt(s, recipient, amount, undefined, 'damage', attacker);
    },
    false,
    'harm',
    false,
    attacker,
  );
  return actual;
}
function cleanupDeaths(s: GameState) {
  remove(
    s,
    new Set(
      fighterUnits(s)
        .filter((u) => u.hands <= 0)
        .map((u) => u.id),
    ),
  );
}
function attributeEvents(s: GameState, firstEventId: number, source: Unit) {
  for (const e of s.events)
    if (e.id >= firstEventId && e.sourceUnitId === undefined) {
      e.sourceUnitId = source.id;
      e.sourceSide = source.side;
      e.sourceLane = source.lane;
      e.sourcePosition = source.position;
    }
}
function settleChallenges(s: GameState) {
  // Lock eligibility before any hit. A lethal simultaneous hit cannot cancel
  // a challenge already due, and the +1 reward cannot resurrect its source.
  const pending: {
    source: Unit;
    target: Unit;
    escaped: boolean;
  }[] = [];
  for (const source of s.units) {
    const challenge = source.challenge;
    if (!challenge || source.hands <= 0 || !activeUnit(source)) continue;
    const target = fighterUnits(s).find(
      (u) => u.id === challenge.targetId && u.hands > 0,
    );
    if (!target) {
      delete source.challenge;
      continue;
    }
    const escaped = target.lane !== challenge.lane;
    if (escaped || s.elapsedMs >= challenge.expiresAt) {
      pending.push({ source, target, escaped });
      delete source.challenge;
    }
  }
  // Only multiple packages sharing a shield need a tie order; use stable
  // identity rather than whichever side happens to appear first in units.
  pending.sort((a, b) => a.source.id.localeCompare(b.source.id));
  for (const { source, target, escaped } of pending) {
    if (escaped) continue;
    const firstEventId = s.nextEventId;
    strike(s, target, 3, source);
    attributeEvents(s, firstEventId, source);
  }
  for (const { source, escaped } of pending) {
    if (source.hands <= 0) continue;
    const firstEventId = s.nextEventId;
    gain(s, source, escaped ? 3 : 1);
    if (escaped)
      event(s, {
        type: 'challenge-win',
        side: source.side,
        lane: source.lane,
        position: source.position,
        text: 'ANKLE BREAKER',
      });
    attributeEvents(s, firstEventId, source);
  }
  cleanupDeaths(s);
}
function entranceAbility(
  s: GameState,
  u: Unit,
  echoed = false,
): boolean | null {
  return withEffectSource(s, u, () => resolveEntranceAbility(s, u, echoed));
}
function resolveEntranceAbility(
  s: GameState,
  u: Unit,
  echoed = false,
): boolean | null {
  const firstEventId = s.nextEventId;
  const ability = definition(s, u).ability;
  event(s, {
    type: 'ability',
    side: u.side,
    lane: u.lane,
    position: u.position,
    sourceUnitId: u.id,
    sourceSide: u.side,
    sourceLane: u.lane,
    sourcePosition: u.position,
    text: definition(s, u).abilityName ?? ability ?? 'DEPLOY',
  });
  const allies = fighterUnits(s).filter(
    (v) => v.side === u.side && v.id !== u.id && v.hands > 0,
  );
  const enemies = fighterUnits(s).filter(
    (v) => v.side !== u.side && v.hands > 0,
  );
  const here = enemies.filter((v) => v.lane === u.lane);
  const local = allies.filter((v) => v.lane === u.lane);
  if (ability === 'new-here' && !local.length) gain(s, u, 1);
  if (ability === 'personal-security' || ability === 'black-blade') {
    const ally = strength(
      local.filter((v) => ability !== 'black-blade' || !v.protected),
      true,
    );
    if (ally) {
      gain(s, ally, 2);
      protect(s, ally);
    }
    const boosted =
      ability === 'personal-security' ? bonusTarget(here) : undefined;
    if (boosted)
      hostile(s, boosted, (boosted) => {
        confiscate(s, boosted, 4);
      });
    else strike(s, strength(here), 2, u);
  }
  if (ability === 'read-the-strike') {
    const target = strength(here);
    if (
      target &&
      (effectiveHands(target) > effectiveHands(u) ||
        removableBonusHands(target) > 0)
    ) {
      if (strike(s, target, 4, u) > 0) gain(s, u, 3);
    } else {
      const ally = strength(
        allies.filter((v) => v.lane !== u.lane),
        true,
      );
      if (ally) {
        gain(s, ally, 3);
        protect(s, ally);
      }
    }
  }
  if (ability === 'no-mercy') {
    let hits = 0;
    for (const lane of [0, 1, 2] as Lane[])
      if (strike(s, strength(enemies.filter((v) => v.lane === lane)), 2, u) > 0)
        hits++;
    gain(s, u, Math.min(3, hits));
  }
  if (ability === 'secret-technique') {
    const target =
      bonusTarget(here) ??
      [...here]
        .filter((v) => definition(s, v).cost >= 4)
        .sort(
          (a, b) =>
            definition(s, b).cost - definition(s, a).cost ||
            b.hands - a.hands ||
            a.id.localeCompare(b.id),
        )[0] ??
      strength(here);
    if (
      target &&
      strike(
        s,
        target,
        removableBonusHands(target) > 0 || definition(s, target).cost >= 4
          ? 4
          : 2,
        u,
      ) > 0
    )
      gain(s, u, 1);
  }
  if (ability === 'whos-the-master') {
    const boosted = bonusTarget(here);
    if (boosted) {
      let taken = 0;
      hostile(s, boosted, (boosted) => {
        taken = confiscate(s, boosted, 5);
      });
      gain(s, u, taken);
    } else strike(s, strength(here), 3, u);
  }
  if (ability === 'golden-glow') {
    const elements = new Set(
      fighterUnits(s)
        .filter((v) => v.side === u.side && v.hands > 0)
        .map((v) => definition(s, v).element)
        .filter(Boolean),
    );
    if (elements.size >= 3) {
      gain(s, u, 3);
      protect(s, u);
    }
    const target = bonusTarget(here) ?? strength(here);
    if (target)
      hostile(s, target, (target) => {
        confiscate(s, target, 4);
        hurt(s, target, 2, undefined, 'damage', sourceMark(u));
      });
  }
  if (ability === 'ankle-breaker') {
    const target = strength(here);
    if (target) {
      u.challenge = {
        targetId: target.id,
        lane: u.lane,
        expiresAt: s.elapsedMs + 10000,
      };
      event(s, {
        type: 'challenge',
        side: target.side,
        lane: target.lane,
        position: target.position,
        text: 'CHALLENGED · 10s',
      });
    }
  }
  const musicResult = expansionEntrance(s, u, echoed);
  cleanupDeaths(s);
  attributeEvents(s, firstEventId, u);
  return musicResult;
}
function entranceReactions(s: GameState, entrant: Unit, deployedLane: Lane) {
  if (entrant.hands <= 0) return;
  const spies = fighterUnits(s)
    .filter(
      (u) =>
        u.side !== entrant.side &&
        u.lane === deployedLane &&
        definition(s, u).ability === 'inside-man' &&
        activeUnit(u),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const spy of spies) {
    const player = s.players[spy.side];
    if (
      entrant.hands <= 0 ||
      (player.insideManPayouts ?? 0) >= 2 ||
      (player.insideManReadyAt ?? 0) > s.elapsedMs
    )
      continue;
    const firstEventId = s.nextEventId;
    const source = { ...spy };
    let stolen = 0;
    hostile(s, entrant, (entrant) => {
      stolen =
        confiscate(s, entrant, 2) +
        hurt(s, entrant, 2, undefined, 'damage', sourceMark(spy));
    });
    if (!stolen) {
      attributeEvents(s, firstEventId, source);
      continue;
    }
    player.insideManPayouts = (player.insideManPayouts ?? 0) + 1;
    player.insideManReadyAt = s.elapsedMs + 10000;
    gain(s, spy, Math.min(4, stolen));
    const possible = ([0, 1, 2] as Lane[]).filter(
      (l) =>
        l !== spy.lane &&
        !fighterUnits(s).some(
          (v) =>
            v.lane === l && Math.abs(v.position - spy.position) < RULES.spacing,
        ),
    );
    const power = (l: Lane) =>
      fighterUnits(s)
        .filter((v) => v.side === spy.side && v.lane === l && v.hands > 0)
        .reduce((sum, v) => sum + effectiveHands(v), 0);
    possible.sort((a, b) => power(a) - power(b) || a - b);
    if (spy.hands > 0 && possible.length) moveFriendly(s, spy, possible[0]);
    attributeEvents(s, firstEventId, source);
  }
  cleanupDeaths(s);
  settleChallenges(s);
}
export function isActionCard(card: Pick<FighterDefinition, 'kind'>): boolean {
  return card.kind === 'support' || card.kind === 'blockbuster';
}
export function effectiveHands(unit: Unit): number {
  return unit.frozen || unit.countsHands === false
    ? 0
    : Math.max(0, unit.hands);
}
function activeUnit(unit: Unit): boolean {
  return (
    unit.canFight !== false &&
    unit.hands > 0 &&
    !unit.frozen &&
    !unit.silenced &&
    !unit.weakened
  );
}
function effectRandom(s: GameState): number {
  s.effectsRng = (Math.imul(s.effectsRng, 1664525) + 1013904223) >>> 0;
  return s.effectsRng / 4294967296;
}
function sourceMark(source: Pick<Unit, 'id' | 'side' | 'lane' | 'position'>) {
  return {
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
  };
}
function statusFlags(s: GameState) {
  for (const u of s.units) {
    u.frozen = s.statuses.some(
      (x) =>
        x.targetId === u.id &&
        x.kind === 'freeze' &&
        x.appliedAt <= s.elapsedMs &&
        x.expiresAt > s.elapsedMs,
    );
    u.silenced = s.statuses.some(
      (x) =>
        x.targetId === u.id &&
        x.kind === 'silence' &&
        x.appliedAt <= s.elapsedMs &&
        x.expiresAt > s.elapsedMs,
    );
    u.weakened = s.statuses.some(
      (x) =>
        x.targetId === u.id &&
        x.kind === 'weaken' &&
        x.appliedAt <= s.elapsedMs &&
        x.expiresAt > s.elapsedMs,
    );
    u.burnStacks = s.statuses
      .filter(
        (x) =>
          x.targetId === u.id &&
          x.kind === 'burn' &&
          x.appliedAt <= s.elapsedMs &&
          x.expiresAt > s.elapsedMs,
      )
      .reduce((n, x) => n + x.stacks, 0);
  }
  houseSyncOngoing(houseContext(s));
  fitnessAfterBoardChange(fitnessContext(s));
}
function addStatus(
  s: GameState,
  source: Unit,
  target: Unit,
  kind: TimedStatus['kind'],
  stacks = 1,
  stackCap = 3,
  options: {
    startsAt?: number;
    durationMs?: number;
    bypassAppeal?: boolean;
  } = {},
): boolean {
  if (
    target.hands <= 0 ||
    (kind === 'silence' && definition(s, target).cannotBeSilenced)
  )
    return false;
  const startsAt = options.startsAt ?? s.elapsedMs,
    duration = options.durationMs ?? (kind === 'burn' ? 6000 : 10000);
  const existing = s.statuses.find(
    (x) =>
      x.targetId === target.id &&
      x.kind === kind &&
      x.expiresAt > s.elapsedMs &&
      (kind !== 'burn' ||
        (x.appliedAt <= s.elapsedMs && startsAt <= s.elapsedMs) ||
        x.appliedAt === startsAt),
  );
  const activeStacks =
    kind === 'burn'
      ? s.statuses
          .filter(
            (x) =>
              x.targetId === target.id &&
              x.kind === 'burn' &&
              x.expiresAt > s.elapsedMs,
          )
          .reduce((n, x) => n + x.stacks, 0)
      : 0;
  const staged =
    statusPackages
      .get(s)
      ?.at(-1)
      ?.changes.filter((x) => x.kind === 'burn')
      .reduce((n, x) => n + (x.stacks ?? 0), 0) ?? 0;
  const delta =
    kind === 'burn'
      ? Math.max(
          0,
          Math.min(
            stacks,
            Math.max(stackCap, activeStacks) - activeStacks - staged,
          ),
        )
      : existing
        ? 0
        : 1;
  if (
    delta > 0 &&
    !options.bypassAppeal &&
    stageAppealedStatus(s, source, target, {
      kind,
      stacks: kind === 'burn' ? delta : 1,
      stackCap,
      ...(startsAt > s.elapsedMs ? { startsAt } : {}),
      durationMs: duration,
    })
  )
    return false;
  if (existing) {
    if (kind === 'burn') existing.stacks += delta;
    existing.expiresAt = Math.max(existing.expiresAt, startsAt + duration);
    Object.assign(existing, sourceMark(source));
  } else {
    if (!delta) return false;
    s.statuses.push({
      id: s.nextEffectId++,
      kind,
      targetId: target.id,
      ...sourceMark(source),
      appliedAt: startsAt,
      nextTickAt: startsAt + 2000,
      expiresAt: startsAt + duration,
      stacks: kind === 'burn' ? delta : 1,
    });
  }
  statusFlags(s);
  contractsHarmfulStatusApplied(contractsContext(s), source, target, !existing);
  if ((kind === 'silence' || kind === 'weaken') && !existing)
    networkInterrupted(networkContext(s), source, target, kind, true);
  event(s, {
    type: kind === 'burn' ? 'burn-applied' : kind,
    side: target.side,
    lane: target.lane,
    position: target.position,
    ...sourceMark(source),
    text: kind.toUpperCase(),
  });
  return delta > 0;
}
function applyControlStatus(
  s: GameState,
  source: Unit,
  target: Unit,
  change: ControlStatusChange,
  bypassAppeal = false,
): boolean {
  if (target.hands <= 0) return false;
  if (change.kind !== 'lock')
    return addStatus(
      s,
      source,
      target,
      change.kind,
      change.stacks ?? 1,
      change.stackCap ?? 4,
      {
        startsAt: change.startsAt,
        durationMs: change.durationMs,
        bypassAppeal,
      },
    );
  const startsAt = change.startsAt ?? s.elapsedMs,
    expiresAt = startsAt + (change.durationMs ?? 10000),
    sourceId = change.sourceId ?? source.id;
  const old = target.movementLocks?.find((x) => x.sourceId === sourceId);
  if (old && old.expiresAt >= expiresAt) return false;
  if (
    !bypassAppeal &&
    stageAppealedStatus(s, source, target, { ...change, sourceId })
  )
    return false;
  target.movementLocks = [
    ...(target.movementLocks ?? []).filter((x) => x.sourceId !== sourceId),
    { sourceId, expiresAt },
  ];
  event(s, {
    type: 'lock',
    side: target.side,
    lane: target.lane,
    position: target.position,
    targetUnitId: target.id,
    ...sourceMark(source),
    text: 'CURFEW',
  });
  return true;
}
function cleanse(s: GameState, target: Unit) {
  controlCleansed(controlContext(s), target);
  const n = s.statuses.length;
  s.statuses = s.statuses.filter(
    (x) =>
      x.targetId !== target.id || (x.kind !== 'freeze' && x.kind !== 'silence'),
  );
  statusFlags(s);
  if (n !== s.statuses.length)
    event(s, {
      type: 'cleanse',
      side: target.side,
      lane: target.lane,
      position: target.position,
      text: 'CLEANSED',
    });
}
function heal(
  s: GameState,
  target: Unit,
  cap: number,
  from?: ReactionSource,
): number {
  from ??= effectSources.get(s);
  if (target.hands <= 0) return 0;
  const amount = Math.min(
    cap,
    Math.max(0, target.damageTaken ?? 0),
    Math.max(0, target.maxHands - target.hands),
  );
  if (!amount) return 0;
  target.hands += amount;
  target.damageTaken = Math.max(0, (target.damageTaken ?? 0) - amount);
  event(s, {
    type: 'mend',
    side: target.side,
    lane: target.lane,
    position: target.position,
    amount,
    text: `+${amount}`,
  });
  musicGained(musicContext(s), target, amount);
  communityGained(communityContext(s), target, amount);
  reactionGained(reactionContext(s), target, amount, false, from, 0);
  contractsGained(contractsContext(s), target, amount);
  fitnessAfterBoardChange(fitnessContext(s));
  return amount;
}
function useLunch(s: GameState, target: Unit, damage: number) {
  if (damage <= 0 || !target.lunch) return;
  const source = target.lunch;
  delete target.lunch;
  if (target.hands <= 0) return;
  const first = s.nextEventId;
  heal(s, target, Math.min(2, damage));
  for (const e of s.events)
    if (e.id >= first && e.sourceUnitId === undefined) Object.assign(e, source);
  event(s, {
    type: 'lunch',
    side: target.side,
    lane: target.lane,
    position: target.position,
    ...source,
    text: 'LUNCH',
  });
}
function plant(
  s: GameState,
  source: Unit,
  kind: Hazard['kind'],
  lane: Lane,
  delay: number,
) {
  const readyAt = s.elapsedMs + delay;
  if (readyAt >= s.durationMs) return;
  s.hazards.push({
    id: s.nextEffectId++,
    kind,
    side: source.side,
    lane,
    sourceUnitId: source.id,
    sourcePosition: source.position,
    sourceLane: source.lane,
    readyAt,
  });
  event(s, {
    type: kind === 'bomb' ? 'bomb-planted' : 'bud-planted',
    side: kind === 'bomb' ? other(source.side) : source.side,
    lane,
    position: 0.5,
    ...sourceMark(source),
    text: kind === 'bomb' ? 'SMILE BOMB · 10s' : 'BUD · 20s',
  });
}
function ongoing(s: GameState, u: Unit) {
  return (
    activeUnit(u) &&
    (definition(s, u).triggers?.includes('ongoing') ??
      ['buddy-buds', 'inside-man', 'side-eye', 'church-shield'].includes(
        definition(s, u).ability ?? '',
      ))
  );
}
function retaliateFamily(s: GameState, victim: Unit, attacker: DamageSource) {
  const player = s.players[victim.side];
  if (attacker.sourceSide === victim.side || player.familyRetaliationUsed)
    return;
  const mother = fighterUnits(s)
    .filter(
      (u) =>
        u.side === victim.side &&
        u.familyTargetId === victim.id &&
        activeUnit(u),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!mother) return;
  player.familyRetaliationUsed = true;
  const source = { ...mother },
    first = s.nextEventId;
  const enemy = fighterUnits(s).find(
    (u) =>
      u.id === attacker.sourceUnitId && u.side !== victim.side && u.hands > 0,
  );
  strike(s, enemy, 2, source);
  if (victim.hands <= 0) gain(s, mother, 2);
  attributeEvents(s, first, source);
}
function followFamily(s: GameState, relative: Unit) {
  const player = s.players[relative.side];
  if (player.familyFollowUsed) return;
  const mother = fighterUnits(s)
    .filter(
      (u) =>
        u.side === relative.side &&
        u.familyTargetId === relative.id &&
        activeUnit(u) &&
        openForLaneMove(s, u, relative.lane),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!mother) return;
  player.familyFollowUsed = true;
  moveFriendly(s, mother, relative.lane);
}
function openForLaneMove(s: GameState, unit: Unit, lane: Lane): boolean {
  // Lateral movement retains progress but cannot skip a defender or become a
  // free hit at the base. Friendly overlaps use the normal instant-entry stack.
  return (
    !unit.frozen &&
    (!(unit.movementLocks ?? []).some((x) => x.expiresAt > s.elapsedMs) ||
      contractsHasSafeCrossing(contractsContext(s), unit)) &&
    unit.lane !== lane &&
    !fighterUnits(s).some(
      (enemy) =>
        enemy.side !== unit.side &&
        enemy.lane === lane &&
        enemy.hands > 0 &&
        (unit.side === 'player'
          ? enemy.position - unit.position
          : unit.position - enemy.position) <
          RULES.spacing - 1e-9,
    )
  );
}
function canReturnToHand(s: GameState, u: Unit): boolean {
  const p = s.players[u.originalOwner ?? u.side];
  return (
    u.origin !== 'summon' &&
    u.hands > 0 &&
    !u.frozen &&
    !(u.movementLocks ?? []).some((x) => x.expiresAt > s.elapsedMs) &&
    p.hand.length + p.reinforcements.length < RULES.handSize &&
    !p.hand.includes(u.cardId)
  );
}
function commitMoves(
  s: GameState,
  moves: { unit: Unit; lane: Lane }[],
): boolean {
  if (
    new Set(moves.map((x) => x.unit.id)).size !== moves.length ||
    moves.some((x) => !openForLaneMove(s, x.unit, x.lane))
  )
    return false;
  for (const { unit, lane } of moves)
    if (!controlBeforeMove(controlContext(s), unit, lane)) return false;
  for (const { unit } of moves)
    if (houseStopDeparture(houseContext(s), unit)) return false;
  const records = moves.map((x) => ({
    ...x,
    source: { ...x.unit },
    fitnessBefore: captureFitnessBoard(fitnessContext(s)),
    contractsBefore: contractsCaptureMove(contractsContext(s), x.unit),
  }));
  for (const { unit, lane } of records) unit.lane = lane;
  for (const {
    unit,
    lane,
    source,
    fitnessBefore,
    contractsBefore,
  } of records) {
    controlMoved(controlContext(s), unit, source.lane);
    specialsMoved(specialsContext(s), unit);
    supportSuccessfulMove(
      supportView(s),
      (s.supportRuntime ??= createSupportRuntime()),
      unit,
      supportTools(s),
    );
    networkMoved(networkContext(s), unit);
    musicMoved(musicContext(s), unit, source.lane);
    communityMoved(communityContext(s), unit, source.lane);
    summonMoved(summonContext(s), unit);
    reactionMoved(reactionContext(s), unit, source.lane);
    neighborhoodArrived(neighborhoodContext(s), unit, { moved: true });
    houseArrived(houseContext(s), unit);
    houseSyncOngoing(houseContext(s));
    contractsBeforeEntrance(contractsContext(s), unit);
    contractsMoved(contractsContext(s), unit, contractsBefore);
    fitnessMoved(fitnessContext(s), unit, source.lane);
    fitnessAfterBoardChange(fitnessContext(s), unit, fitnessBefore);
    event(s, {
      type: 'escape',
      side: unit.side,
      lane,
      position: unit.position,
      targetUnitId: unit.id,
      cardId: unit.cardId,
      ...sourceMark(source),
      text: 'SWITCH LANES',
    });
    if (unit.hands > 0) followFamily(s, unit);
  }
  specialsAfterBoardChange(specialsContext(s));
  return true;
}
function moveFriendly(s: GameState, unit: Unit, lane: Lane): boolean {
  return commitMoves(s, [{ unit, lane }]);
}
function streetEntrance(
  s: GameState,
  u: Unit,
  ability: FighterDefinition['ability'],
  allies: Unit[],
  here: Unit[],
  local: Unit[],
) {
  if (ability === 'small-time-heat')
    for (const target of [...here].sort((a, b) => a.id.localeCompare(b.id)))
      hostile(s, target, (target) => addStatus(s, u, target, 'burn', 1, 4));
  if (ability === 'good-vibes') {
    const target = strength(
      local.filter((v) => v.frozen || v.silenced),
      true,
    );
    if (target) {
      cleanse(s, target);
      gain(s, target, 2);
    } else {
      const fallback = strength(local, true);
      if (fallback) gain(s, fallback, 1);
    }
  }
  if (
    ability === 'hairline-link' &&
    local.some((v) => definition(s, v).cost <= 2)
  )
    gain(s, u, 2);
  if (ability === 'squad-check' && allies.some((v) => v.lane !== u.lane))
    gain(s, u, 1);
  if (ability === 'deep-crew' && local.length >= 2) gain(s, u, 3);
  if (ability === 'old-head') {
    const deficit =
      fighterUnits(s).filter((v) => v.side !== u.side && v.hands > 0).length -
      allies.length -
      1;
    if (deficit > 0) gain(s, u, 3);
    if (deficit >= 3) strike(s, strength(here, true), 1, u);
  }
  if (ability === 'bull-rush') {
    gain(s, u, 1);
    const target = strength(here);
    if (target)
      hostile(s, target, (target) =>
        addStatus(
          s,
          u,
          target,
          'burn',
          definition(s, target).element === 'Plant' ? 2 : 1,
          4,
        ),
      );
  }
  if (ability === 'ride-out') {
    const lanes = ([0, 1, 2] as Lane[]).filter((lane) =>
      openForLaneMove(s, u, lane),
    );
    const power = (lane: Lane) =>
      allies
        .filter((v) => v.lane === lane)
        .reduce((sum, v) => sum + effectiveHands(v), 0);
    lanes.sort((a, b) => power(a) - power(b) || a - b);
    if (lanes.length && moveFriendly(s, u, lanes[0])) gain(s, u, 1);
  }
  if (ability === 'bring-the-vibe') {
    const target = strength(
      allies.filter((v) => openForLaneMove(s, v, u.lane)),
      true,
    );
    if (target && moveFriendly(s, target, u.lane)) {
      gain(s, target, 1);
      gain(s, u, 1);
    }
  }
  if (ability === 'water-break' && local.length) {
    const player = s.players[u.side],
      actual = Math.min(1, RULES.motionCap - player.motion);
    if (actual > 0) refundMotion(s, u.side, actual, u);
    if (actual > 0)
      event(s, {
        type: 'motion',
        side: u.side,
        lane: u.lane,
        position: u.position,
        amount: actual,
        text: '+1 MOTION',
      });
  }
  if (ability === 'fade-and-coach') {
    strike(s, strength(here), 2, u);
    const ally = strength(
      allies.filter((v) => v.lane !== u.lane),
      true,
    );
    if (ally) gain(s, ally, 2);
  }
  if (ability === 'badge-sweep') {
    let applied = 0;
    for (const target of [...here].sort((a, b) => a.id.localeCompare(b.id)))
      if (hostile(s, target, (target) => addStatus(s, u, target, 'weaken')))
        applied++;
    gain(s, u, applied);
  }
  if (ability === 'whole-block-hot') {
    for (const target of fighterUnits(s)
      .filter((v) => v.side !== u.side && v.hands > 0)
      .sort((a, b) => a.id.localeCompare(b.id)))
      hostile(s, target, (target) =>
        addStatus(
          s,
          u,
          target,
          'burn',
          definition(s, target).element === 'Plant' ? 4 : 3,
          4,
        ),
      );
    for (const ally of allies.filter(
      (v) => definition(s, v).element === 'Fire',
    ))
      gain(s, ally, 1);
  }
  if (ability === 'block-party') {
    let arrived = 0;
    for (const lane of [0, 1, 2] as Lane[]) {
      if (lane === u.lane) continue;
      const target = strength(
        allies.filter((v) => v.lane === lane && openForLaneMove(s, v, u.lane)),
        true,
      );
      if (target && moveFriendly(s, target, u.lane)) arrived++;
    }
    gain(s, u, Math.min(2, arrived));
  }
  if (ability === 'iron-driver') {
    const earth = allies.filter((v) => definition(s, v).element === 'Earth');
    gain(s, u, Math.min(4, earth.length));
    if (earth.filter((v) => v.lane === u.lane).length >= 2)
      strike(s, strength(here), 2, u);
  }
  if (ability === 'double-knuckle') {
    const targets = [...here]
      .sort(
        (a, b) =>
          effectiveHands(b) - effectiveHands(a) || a.id.localeCompare(b.id),
      )
      .slice(0, 2);
    for (const target of targets) strike(s, target, 2, u);
  }
  if (ability === 'big-zoey-transfer') {
    const ally = strength(local, true);
    if (ally) gain(s, ally, 2);
    strike(s, strength(here, true), 2, u);
  }
  if (ability === 'clean-cut') {
    const boosted = bonusTarget(here),
      ally = strength(local, true);
    if (boosted) {
      let taken = 0;
      hostile(s, boosted, (boosted) => {
        taken = confiscate(s, boosted, 2);
      });
      if (ally) gain(s, ally, taken);
    } else if (ally) gain(s, ally, 1);
  }
  if (ability === 'church-shield') {
    const ally = strength(local, true);
    if (ally) {
      gain(s, ally, definition(s, ally).element === 'Light' ? 3 : 2);
      protect(s, ally);
    }
  }
}
function expansionEntrance(
  s: GameState,
  u: Unit,
  echoed = false,
): boolean | null {
  if (!activeUnit(u)) return null;
  const ability = definition(s, u).ability;
  const allies = fighterUnits(s).filter(
      (v) => v.side === u.side && v.id !== u.id && v.hands > 0,
    ),
    local = allies.filter((v) => v.lane === u.lane);
  const enemies = fighterUnits(s).filter(
      (v) => v.side !== u.side && v.hands > 0,
    ),
    here = enemies.filter((v) => v.lane === u.lane);
  if (ability === 'still-standing' && here.length > local.length) gain(s, u, 3);
  if (ability === 'connections')
    s.players[u.side].discount = { origin: u.lane };
  if (ability === 'check-in') {
    const target = strength(local, true);
    if (target) {
      gain(s, target, 3);
      cleanse(s, target);
    }
  }
  if (ability === 'ratios-receipts') {
    const target = strength(here);
    if (target)
      hostile(s, target, (target) => {
        addStatus(s, u, target, 'burn');
        hurt(
          s,
          target,
          s.elapsedMs - (target.deployedAt ?? -Infinity) <= 10000 ? 2 : 1,
          undefined,
          'damage',
          sourceMark(u),
        );
      });
  }
  if (ability === 'cold-shoulder') {
    const target = strength(here);
    if (target)
      hostile(s, target, (target) => addStatus(s, u, target, 'freeze'));
  }
  if (ability === 'still-rapping') {
    const target =
      strength(here.filter((v) => ongoing(s, v))) ?? strength(here);
    if (target)
      hostile(s, target, (target) => addStatus(s, u, target, 'silence'));
  }
  if (ability === 'smile-bombs')
    for (let i = 0; i < 4; i++)
      plant(s, u, 'bomb', Math.floor(effectRandom(s) * 3) as Lane, 10000);
  if (ability === 'eat-something') {
    const injured = strength(
      allies.filter((v) => (v.damageTaken ?? 0) > 0 && v.hands < v.maxHands),
      true,
    );
    const target = injured ?? strength(local, true);
    if (target) {
      gain(s, target, 1);
      if (injured) heal(s, target, 3);
      else target.lunch = sourceMark(u);
      protect(s, target);
    }
  }
  if (
    ability === 'finnam' &&
    (s.players[u.side].finnamReadyAt ?? 0) <= s.elapsedMs
  ) {
    s.players[u.side].finnamReadyAt = s.elapsedMs + 10000;
    gain(s, u, Math.min(5, allies.length));
    for (const enemy of [...enemies].sort((a, b) => a.id.localeCompare(b.id)))
      strike(s, enemy, 1, u);
  }
  if (ability === 'buddy-buds') {
    u.growAt = s.elapsedMs + 20000;
    const eligible = ([0, 1, 2] as Lane[]).filter(
      (l) =>
        !s.hazards.some(
          (h) => h.kind === 'bud' && h.side === u.side && h.lane === l,
        ),
    );
    const count = effectRandom(s) < 0.5 ? 2 : 3;
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(effectRandom(s) * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    for (const lane of eligible.slice(0, count))
      plant(s, u, 'bud', lane, 20000);
  }
  if (ability === 'mama-bear') {
    const target = strength(local, true);
    if (target) u.familyTargetId = target.id;
  }
  if (ability === 'unaware') {
    const target =
      strength(here.filter((v) => ongoing(s, v))) ?? strength(here);
    if (target) {
      const interrupting = ongoing(s, target);
      if (
        hostile(
          s,
          target,
          (target) => addStatus(s, u, target, 'silence'),
          true,
        ) &&
        interrupting
      ) {
        gain(s, u, 1);
        const revealed = [...s.players[other(u.side)].hand].sort()[0];
        if (revealed)
          event(s, {
            type: 'reveal-hand',
            side: u.side,
            visibleTo: u.side,
            cardId: revealed,
            ...sourceMark(u),
            text: `READ: ${s.roster.find((c) => c.id === revealed)!.name}`,
          });
      }
    }
  }
  streetEntrance(s, u, ability, allies, here, local);
  networkEntrance(networkContext(s), u);
  fitnessEntrance(fitnessContext(s), u);
  const communityResult = communityEntrance(communityContext(s), u, echoed);
  const houseResult = houseEntrance(houseContext(s), u, echoed);
  const neighborhoodResult = neighborhoodEntrance(neighborhoodContext(s), u);
  const summonResult = summonEntrance(summonContext(s), u, { echo: echoed });
  const reactionResult = reactionEntrance(reactionContext(s), u, echoed);
  const contractsResult = contractsEntrance(contractsContext(s), u, { echoed });
  const factionResult = factionsEntrance(factionsContext(s), u, { echoed });
  const controlResult = controlEntrance(controlContext(s), u, echoed);
  const specialResult = specialsEntrance(specialsContext(s), u, { echoed });
  if (ability === 'nothing-to-lose' && activeUnit(u))
    homelessInvestment(
      blockbusterContext(s),
      u,
      u.entranceChoice!,
      !!u.baseCostSpentLastMotion,
    );
  const musicResult = musicEntrance(musicContext(s), u, { echoed });
  return (
    musicResult ??
    communityResult ??
    houseResult ??
    neighborhoodResult ??
    summonResult ??
    reactionResult ??
    contractsResult ??
    factionResult ??
    controlResult ??
    specialResult ??
    null
  );
}
function resolveTimedStatuses(s: GameState) {
  // Eligibility is target-owned. Applied Burn outlives its source; no source gets
  // damage-derived rewards after recycling into a different instance.
  const due = s.statuses
    .filter(
      (x) =>
        x.kind === 'burn' &&
        x.nextTickAt <= s.elapsedMs &&
        x.nextTickAt <= x.expiresAt,
    )
    .sort((a, b) => a.id - b.id);
  for (const status of due) {
    status.nextTickAt += 2000;
    const target = fighterUnits(s).find(
      (u) => u.id === status.targetId && u.hands > 0,
    );
    if (!target) continue;
    const first = s.nextEventId;
    hostile(
      s,
      target,
      (target) => {
        hurt(s, target, status.stacks, 'burn', 'damage', status);
      },
      false,
      'harm',
      false,
      status,
    );
    for (const e of s.events)
      if (e.id >= first && e.sourceUnitId === undefined)
        Object.assign(e, {
          sourceUnitId: status.sourceUnitId,
          sourceSide: status.sourceSide,
          sourceLane: status.sourceLane,
          sourcePosition: status.sourcePosition,
        });
  }
  s.statuses = s.statuses.filter(
    (x) =>
      x.expiresAt > s.elapsedMs &&
      fighterUnits(s).some((u) => u.id === x.targetId && u.hands > 0),
  );
  statusFlags(s);
  cleanupDeaths(s);
}
function resolveHazards(s: GameState) {
  const due = s.hazards
    .filter((h) => h.readyAt <= s.elapsedMs)
    .sort((a, b) => a.id - b.id);
  s.hazards = s.hazards.filter((h) => h.readyAt > s.elapsedMs);
  for (const h of due) {
    const source = fighterUnits(s).find(
      (u) => u.id === h.sourceUnitId && u.hands > 0,
    );
    const first = s.nextEventId;
    if (h.kind === 'bomb') {
      const enemies = fighterUnits(s)
        .filter((u) => u.side !== h.side && u.lane === h.lane && u.hands > 0)
        .sort((a, b) => a.id.localeCompare(b.id));
      const target = enemies.length
        ? enemies[Math.floor(effectRandom(s) * enemies.length)]
        : undefined;
      event(s, {
        type: 'bomb',
        side: other(h.side),
        lane: h.lane,
        position: target?.position ?? 0.5,
        text: 'BOOM',
      });
      if (target) {
        const actual = strike(s, target, 2, {
          sourceUnitId: h.sourceUnitId,
          sourceSide: h.side,
          sourceLane: h.sourceLane,
          sourcePosition: h.sourcePosition,
        });
        if (actual > 0 && source)
          gain(s, source, 1 + (target.hands <= 0 ? 1 : 0));
      }
    } else {
      const recipient = fighterUnits(s)
        .filter((u) => u.side === h.side && u.lane === h.lane && u.hands > 0)
        .sort(
          (a, b) =>
            (b.arrivalOrder ?? 0) - (a.arrivalOrder ?? 0) ||
            b.id.localeCompare(a.id),
        )[0];
      event(s, {
        type: 'bud-sprout',
        side: h.side,
        lane: h.lane,
        position: recipient?.position ?? 0.5,
        text: recipient ? 'BUD +3' : 'EMPTY BUD',
      });
      if (recipient) gain(s, recipient, 3);
    }
    for (const e of s.events)
      if (e.id >= first && e.sourceUnitId === undefined)
        Object.assign(e, {
          sourceUnitId: h.sourceUnitId,
          sourceSide: h.side,
          sourceLane: h.sourceLane,
          sourcePosition: h.sourcePosition,
        });
  }
  // Buddy growth is a committed delayed buff, not an ongoing aura: silence does
  // not erase it. It belongs to the original instance and never a recycled copy.
  for (const u of s.units)
    if (u.growAt !== undefined && u.growAt <= s.elapsedMs) {
      delete u.growAt;
      if (u.hands > 0) gain(s, u, 3);
    }
  cleanupDeaths(s);
}
function syncHandAuras(s: GameState) {
  for (const side of sides) {
    const p = s.players[side];
    p.handAuraAt ??= {};
    for (const id of Object.keys(p.handAuraAt))
      if (!p.hand.includes(id)) delete p.handAuraAt[id];
    for (const id of p.hand) {
      const ability = s.roster.find((c) => c.id === id)?.ability;
      if (
        (ability === 'eat-something' ||
          ability === 'finnam' ||
          ability === 'clean-cut') &&
        p.handAuraAt[id] === undefined
      )
        p.handAuraAt[id] = s.elapsedMs + 10000;
    }
  }
}
function resolveHandAuras(s: GameState) {
  syncHandAuras(s);
  for (const side of sides) {
    const p = s.players[side];
    for (const [id, time] of Object.entries(p.handAuraAt ?? {})) {
      if (time > s.elapsedMs) continue;
      p.handAuraAt![id] = s.elapsedMs + 10000;
      const ability = s.roster.find((c) => c.id === id)?.ability;
      const element =
        ability === 'finnam'
          ? 'Fire'
          : ability === 'clean-cut'
            ? 'Normal'
            : 'Light';
      for (const u of fighterUnits(s).filter(
        (u) =>
          u.side === side &&
          u.hands > 0 &&
          definition(s, u).element === element,
      )) {
        const first = s.nextEventId;
        gain(s, u, 1);
        for (const e of s.events)
          if (e.id >= first) {
            e.text =
              ability === 'finnam'
                ? 'FINNAM! +1'
                : ability === 'clean-cut'
                  ? 'LINE UP +1'
                  : 'ABUELA +1';
            e.sourceUnitId = `hand:${side}:${id}`;
            e.sourceSide = side;
            e.sourceLane = u.lane;
            e.sourcePosition = side === 'player' ? 0 : 1;
          }
      }
    }
  }
}
function canLoseHands(s: GameState, u: Unit): boolean {
  return u.canFight !== false && !u.immune && !definition(s, u).cannotLoseHands;
}

function withControlSplash<T>(
  s: GameState,
  splash: boolean | undefined,
  work: () => T,
): T {
  const old = controlSplashDepth.get(s) ?? 0;
  if (splash) controlSplashDepth.set(s, old + 1);
  try {
    return work();
  } finally {
    if (old) controlSplashDepth.set(s, old);
    else controlSplashDepth.delete(s);
  }
}
function controlContext(s: GameState): ControlContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    effectiveHands,
    ongoing: (u) => definition(s, u).triggers?.includes('ongoing') ?? false,
    hasEntrance: (u) =>
      definition(s, u).triggers?.includes('entrance') ?? false,
    isAfflicted: (u) =>
      s.statuses.some(
        (x) => x.targetId === u.id && x.expiresAt > s.elapsedMs,
      ) || (u.movementLocks ?? []).some((x) => x.expiresAt > s.elapsedMs),
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    protect: (u) => protect(s, u),
    cleanse: (u, from) => fullCleanse(s, u, undefined, from),
    clearBurn: (u) => {
      s.statuses = s.statuses.filter(
        (x) => x.targetId !== u.id || x.kind !== 'burn',
      );
      statusFlags(s);
    },
    heal: (u, n, from) => heal(s, u, n, from),
    strike: (source, target, n, options) =>
      withControlSplash(s, options?.splash, () => {
        let amount = 0;
        packet(s, source, target, (actual) => {
          amount = hurt(s, actual, n, undefined, 'damage', sourceMark(source));
        });
        return amount;
      }),
    hostilePackage: (source, target, apply, kind) =>
      packet(s, source, target, apply, kind),
    rawDamage: (source, target, n, options) =>
      withControlSplash(s, options?.splash, () =>
        withEffectSource(s, source, () =>
          hurt(
            s,
            target,
            n,
            options?.burn ? 'burn' : undefined,
            'damage',
            sourceMark(source),
          ),
        ),
      ),
    rawBonus: (_source, target, cap) => confiscate(s, target, cap),
    rawStatus: (source, target, change) => {
      const normalized =
        change.kind === 'burn' && change.stackCap === undefined
          ? {
              ...change,
              stacks:
                (change.stacks ?? 1) +
                (definition(s, source)?.element === 'Fire' &&
                definition(s, target).element === 'Plant'
                  ? 1
                  : 0),
              stackCap: 4,
            }
          : change;
      return applyControlStatus(s, source, target, normalized);
    },
    burn: (source, target, stacks, options) => {
      let landed = false;
      packet(s, source, target, (actual) => {
        landed = addStatus(
          s,
          source,
          actual,
          'burn',
          stacks +
            (definition(s, source)?.element === 'Fire' &&
            definition(s, actual).element === 'Plant'
              ? 1
              : 0),
          4,
          { startsAt: options?.startsAt },
        );
      });
      return landed;
    },
    removableBonus: removableBonusHands,
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    rawMove: (_source, target, lane) =>
      !factionsPreventMove(factionsContext(s), target) &&
      moveFriendly(s, target, lane),
    resolveEntrance: (u) =>
      resolveEntrance(s, u, { deferred: true }) === 'resolved',
    event: (data) => event(s, data),
    isToken: (u) => u.origin === 'summon' || definition(s, u).kind === 'token',
  };
}
function factionsContext(s: GameState): FactionsContext {
  return {
    state: s,
    definition: (u) => ({
      ...definition(s, u),
      gangColor: u.gangColor ?? definition(s, u).gangColor,
    }),
    active: activeUnit,
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    protect: (u) => protect(s, u),
    damage: (source, target, n) => strike(s, target, n, source),
    selfDamage: (source, target, n) =>
      hurt(s, target, n, undefined, 'damage', sourceMark(source)),
    burn: (source, target, n) =>
      packet(s, source, target, (target) =>
        addStatus(
          s,
          source,
          target,
          'burn',
          n +
            (definition(s, source).element === 'Fire' &&
            definition(s, target).element === 'Plant'
              ? 1
              : 0),
          4,
        ),
      ),
    move: (u, lane) => moveFriendly(s, u, lane),
    movePair: (a, b, lane) =>
      commitMoves(s, [
        { unit: a, lane },
        { unit: b, lane },
      ]),
    moveEnemy: (source, target, lane, followUp) => {
      if (!openForLaneMove(s, target, lane)) return false;
      let moved = false;
      packet(
        s,
        source,
        target,
        (actual) => {
          moved = moveFriendly(s, actual, lane);
          if (moved && followUp?.damage)
            hurt(
              s,
              actual,
              followUp.damage,
              undefined,
              'damage',
              sourceMark(source),
            );
          if (moved && followUp?.burn && actual.hands > 0)
            addStatus(
              s,
              source,
              actual,
              'burn',
              followUp.burn +
                (definition(s, source).element === 'Fire' &&
                definition(s, actual).element === 'Plant'
                  ? 1
                  : 0),
              4,
            );
        },
        'staff-exit',
      );
      return moved;
    },
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    refund: (side, n, source) => refundMotion(s, side, n, source),
    random: () => effectRandom(s),
    event: (data) => event(s, data),
  };
}
function contractsContext(s: GameState): ContractsContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    damage: (source, target, n) => strike(s, target, n, source),
    burn: (source, target, n) =>
      hostile(s, target, (target) =>
        addStatus(
          s,
          source,
          target,
          'burn',
          n +
            (definition(s, source).element === 'Fire' &&
            definition(s, target).element === 'Plant'
              ? 1
              : 0),
          4,
        ),
      ),
    weaken: (source, target) =>
      hostile(s, target, (target) => addStatus(s, source, target, 'weaken')),
    protect: (_source, target) => {
      const fresh = !target.protected && target.hands > 0;
      if (fresh) protect(s, target);
      return fresh;
    },
    cleanse: (u, kinds, from) => {
      const old = s.statuses.length,
        locks = (u.movementLocks ?? []).length;
      fullCleanse(s, u, kinds, from);
      return (
        old !== s.statuses.length || locks !== (u.movementLocks ?? []).length
      );
    },
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    enemyMove: (source, target, lane, afterMoved) => {
      if (!openForLaneMove(s, target, lane)) return false;
      let moved = false;
      packet(
        s,
        source,
        target,
        (actual) => {
          moved = moveFriendly(s, actual, lane);
          if (moved && actual.hands > 0) afterMoved?.(actual);
        },
        'staff-exit',
      );
      return moved;
    },
    swap: (first, second) =>
      commitMoves(s, [
        { unit: first, lane: second.lane },
        { unit: second, lane: first.lane },
      ]),
    canReturn: (u) => canReturnToHand(s, u),
    returnToHand: (_source, target, options) =>
      returnMusicAlly(s, target, {
        carriedHands: options.bonusHands,
        discount: options.discount,
        expiresAt: options.expiresAt,
      }),
    removeBonus: (u, n) => musicContext(s).removeBonus(u, n),
    refund: (side, n, source) => refundMotion(s, side, n, source),
    lastStand: () =>
      !!s.drawsLocked || s.elapsedMs >= s.durationMs - RULES.lastStandMs,
    event: (data) => event(s, data),
  };
}
const effectSources = new WeakMap<GameState, ReactionSource>();
function withEffectSource<T>(
  s: GameState,
  source: ReactionSource,
  work: () => T,
): T {
  const previous = effectSources.get(s);
  effectSources.set(s, source);
  try {
    return work();
  } finally {
    if (previous) effectSources.set(s, previous);
    else effectSources.delete(s);
  }
}
export function deploymentBaseHands(
  s: GameState,
  side: Side,
  cardId: string,
): number {
  const card = s.roster.find((c) => c.id === cardId);
  return card
    ? (s.players[side].returnedUnits?.[cardId]?.formBaseHands ??
        reactionDeploymentBaseHands(
          reactionContext(s),
          side,
          cardId,
          card.hands,
        ))
    : 0;
}
function refundMotion(
  s: GameState,
  side: Side,
  n: number,
  from: ReactionSource,
  kind: 'refund' | 'income' = 'refund',
): number {
  const old = s.players[side].motion;
  s.players[side].motion = Math.min(RULES.motionCap, old + n);
  const actual = s.players[side].motion - old;
  if (actual > 0) {
    event(s, {
      type: 'motion',
      side,
      lane: from.lane,
      amount: actual,
      ...sourceMark(from),
      text: `+${actual} MOTION`,
    });
    if (kind === 'refund') {
      contractsRefunded(contractsContext(s), side, actual);
      reactionRefunded(reactionContext(s), side, actual, from.cardId);
    }
  }
  return actual;
}
function reactionContext(s: GameState): ReactionContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    effectiveHands,
    isAfflicted: (u) =>
      s.statuses.some(
        (x) => x.targetId === u.id && x.expiresAt > s.elapsedMs,
      ) || (u.movementLocks ?? []).some((x) => x.expiresAt > s.elapsedMs),
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    protect: (u) => protect(s, u),
    cleanse: (u, kinds, from) => fullCleanse(s, u, kinds, from),
    heal: (u, n, from) => heal(s, u, n, from),
    weaken: (source, target) =>
      hostile(s, target, (target) => addStatus(s, source, target, 'weaken')),
    strike: (source, target, n) => strike(s, target, n, source),
    hostilePackage: (source, target, apply) => packet(s, source, target, apply),
    rawDamage: (source, target, n) =>
      hurt(s, target, n, undefined, 'damage', sourceMark(source)),
    rawWeaken: (source, target) => {
      if (target.hands <= 0) return false;
      addStatus(s, source, target, 'weaken');
      return true;
    },
    removableBonus: removableBonusHands,
    removeBonus: (_source, target, n) => {
      let actual = 0;
      hostile(s, target, (target) => {
        actual = confiscate(s, target, n);
      });
      return actual;
    },
    motion: (side, n, from, kind) => refundMotion(s, side, n, from, kind),
    sacrificeHands: (u, n) => {
      const actual = canLoseHands(s, u)
        ? Math.max(0, Math.min(n, u.hands - 1))
        : 0;
      u.hands -= actual;
      u.maxHands = Math.max(u.hands, u.maxHands - actual);
      recordBlockbusterReduction(blockbusterContext(s), u, actual);
      return actual;
    },
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    event: (data) => event(s, data),
    isToken: (u) => definition(s, u).kind === 'token',
  };
}
function fighterUnits(s: GameState): Unit[] {
  return s.units.filter((u) => u.canFight !== false);
}
function summonContext(s: GameState): SummonContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    protect: (u) => protect(s, u),
    damage: (source, target, n) => strike(s, target, n, source),
    execute: (source, target, maxHands) => {
      let executed = false;
      packet(s, source, target, (recipient) => {
        const target = recipient;
        if (
          (maxHands !== undefined && effectiveHands(target) > maxHands) ||
          !canLoseHands(s, target)
        )
          return;
        const incoming = target.hands;
        const prevented = communityPreventLethal(
          communityContext(s),
          target,
          incoming,
        );
        const actual = Math.max(0, incoming - prevented);
        target.hands -= actual;
        recordBlockbusterReduction(blockbusterContext(s), target, actual);
        executed = target.hands <= 0;
        if (actual)
          event(s, {
            type: 'damage',
            side: target.side,
            lane: target.lane,
            position: target.position,
            targetUnitId: target.id,
            cardId: target.cardId,
            amount: actual,
            ...sourceMark(source),
            text: `−${actual}`,
          });
        if (actual) {
          controlDamaged(
            controlContext(s),
            source.side,
            source.id,
            target,
            actual,
          );
          if (executed)
            controlDestroyed(controlContext(s), target, source.side);
        }
        if (executed)
          fitnessEnemyDamage(fitnessContext(s), source.side, target, actual);
      });
      if (executed) cleanupDeaths(s);
      return executed;
    },
    move: (u, lane) => moveFriendly(s, u, lane),
    moveEnemy: (source, target, lane, followUp) => {
      if (!openForLaneMove(s, target, lane)) return false;
      let moved = false;
      packet(
        s,
        source,
        target,
        (actual) => {
          moved = moveFriendly(s, actual, lane);
          if (moved && followUp?.damage)
            hurt(
              s,
              actual,
              followUp.damage,
              undefined,
              'damage',
              sourceMark(source),
            );
          if (moved && followUp?.burn && actual.hands > 0)
            addStatus(
              s,
              source,
              actual,
              'burn',
              followUp.burn +
                (definition(s, source).element === 'Fire' &&
                definition(s, actual).element === 'Plant'
                  ? 1
                  : 0),
              4,
            );
        },
        'staff-exit',
      );
      return moved;
    },
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    openForSummon: (_side, lane) => [0, 1, 2].includes(lane),
    spawn: (source, cardId, lane, options) => {
      const card = s.roster.find((c) => c.id === cardId);
      if (!card || ![0, 1, 2].includes(lane)) return;
      const resource = options.kind === 'mushroom';
      const hands = options.hands ?? card.hands;
      const u: Unit = {
        id: `u${s.nextUnitId++}`,
        origin: 'summon',
        summonKind: options.kind,
        sourceUnitId: source.id,
        canFight: !resource,
        canBreach: !resource,
        countsHands: !resource,
        cardId,
        side: source.side,
        lane,
        position:
          source.side === 'player'
            ? resource
              ? 0.12
              : 0
            : resource
              ? 0.88
              : 1,
        hands,
        baseHands: hands,
        maxHands: hands,
        squabbled: false,
        deployedAt: s.elapsedMs,
        arrivalOrder: s.nextEventId,
        nextEffectAt: s.elapsedMs + 5000,
      };
      s.units.push(u);
      event(s, {
        type: 'summon',
        side: u.side,
        lane,
        position: u.position,
        targetUnitId: u.id,
        cardId,
        ...sourceMark(source),
        text: card.name,
      });
      houseSyncOngoing(houseContext(s));
      return u;
    },
    consume: (u) => {
      s.units = s.units.filter((x) => x.id !== u.id);
      s.statuses = s.statuses.filter((x) => x.targetId !== u.id);
      event(s, {
        type: 'resource-used',
        side: u.side,
        lane: u.lane,
        position: u.position,
        targetUnitId: u.id,
        cardId: u.cardId,
        text: 'POWER UP',
      });
    },
    burn: (source, target, n) =>
      hostile(s, target, (target) =>
        addStatus(
          s,
          source,
          target,
          'burn',
          n +
            (definition(s, source).element === 'Fire' &&
            definition(s, target).element === 'Plant'
              ? 1
              : 0),
          4,
        ),
      ),
    random: () => effectRandom(s),
    setForm: (u, artworkId) => {
      u.art = SUMMON_ARTWORK[artworkId];
    },
    event: (data) => event(s, data),
  };
}

const repeatingEntrances = new WeakSet<Unit>();
function specialsContext(s: GameState): SpecialsContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    baseDefinition: (id) => s.roster.find((c) => c.id === id),
    active: activeUnit,
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    damage: (source, target, n) => strike(s, target, n, source),
    protect: (_source, target) => {
      const fresh = !target.protected && target.hands > 0;
      if (fresh) protect(s, target);
      return fresh;
    },
    cleanse: (u, kinds, from) => {
      const before = s.statuses.length,
        locks = (u.movementLocks ?? []).length;
      fullCleanse(s, u, kinds, from);
      return (
        before !== s.statuses.length || locks !== (u.movementLocks ?? []).length
      );
    },
    freeze: (source, target) => {
      let applied = false;
      packet(s, source, target, (actual) => {
        applied = addStatus(s, source, actual, 'freeze');
      });
      return applied;
    },
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    enemyMove: (source, target, lane, afterMoved) => {
      if (!openForLaneMove(s, target, lane)) return false;
      let moved = false;
      packet(
        s,
        source,
        target,
        (actual) => {
          moved = moveFriendly(s, actual, lane);
          if (moved && actual.hands > 0) afterMoved?.(actual);
        },
        'staff-exit',
      );
      return moved;
    },
    spawn: (source, id, lane) => {
      const unit = summonContext(s).spawn(source, id, lane, {
        kind: 'fighter',
        suppressEntrance: true,
      });
      if (unit && id === 'guyana') {
        unit.immune = true;
        unit.immunityScope = 'abilities';
      }
      return unit;
    },
    copyOngoing: (u, target, copyAbility) => {
      const base = Math.min(7, target.baseHands),
        delta = u.hands - u.baseHands,
        maxDelta = u.maxHands - u.baseHands;
      u.baseHands = base;
      u.hands = Math.max(0, base + delta);
      u.maxHands = Math.max(u.hands, base + maxDelta);
      if (copyAbility) {
        const d = definition(s, target);
        u.copiedAbility = d.ability;
        u.copiedTriggers = (d.triggers ?? []).filter((x) => x === 'ongoing');
      } else {
        delete u.copiedAbility;
        delete u.copiedTriggers;
      }
      event(s, {
        type: 'copy',
        side: u.side,
        lane: u.lane,
        position: u.position,
        targetUnitId: u.id,
        ...sourceMark(u),
        text: copyAbility ? 'KIT COPIED' : 'HANDS COPIED',
      });
      houseSyncOngoing(houseContext(s));
      return true;
    },
    repeat: (actor, id, options) => {
      const card = s.roster.find((c) => c.id === id);
      if (
        !specialsCanRepeat(card) ||
        !activeUnit(actor) ||
        repeatingEntrances.has(actor)
      )
        return false;
      const previousAbility = actor.copiedAbility,
        previousTriggers = actor.copiedTriggers;
      actor.copiedAbility = card!.ability;
      actor.copiedTriggers = card!.triggers;
      repeatingEntrances.add(actor);
      try {
        const first = s.nextEventId,
          result = entranceAbility(s, actor, !options?.coach),
          success =
            result ??
            s.events.some(
              (e) =>
                e.id >= first &&
                !['deploy', 'block', 'ability'].includes(e.type),
            );
        if (options?.coach)
          specialsEntranceResolved(specialsContext(s), actor, success, {
            abilityCardId: id,
          });
        return success;
      } finally {
        if (previousAbility === undefined) delete actor.copiedAbility;
        else actor.copiedAbility = previousAbility;
        if (previousTriggers === undefined) delete actor.copiedTriggers;
        else actor.copiedTriggers = previousTriggers;
        repeatingEntrances.delete(actor);
      }
    },
    disappear: (u) => {
      if (!s.units.some((x) => x.id === u.id)) return false;
      u.suspendedStatuses = s.statuses
        .filter((x) => x.targetId === u.id)
        .map((x) => ({ ...x }));
      s.statuses = s.statuses.filter((x) => x.targetId !== u.id);
      s.units = s.units.filter((x) => x.id !== u.id);
      houseSyncOngoing(houseContext(s));
      fitnessAfterBoardChange(fitnessContext(s));
      return true;
    },
    land: (saved, lane, form) => {
      if (s.units.some((x) => x.id === saved.id)) return;
      const delta = saved.hands - saved.baseHands,
        maxDelta = saved.maxHands - saved.baseHands;
      const unit: Unit = {
        ...structuredClone(saved),
        lane,
        position: saved.side === 'player' ? 0 : 1,
        baseHands: form.baseHands,
        formBaseHands: form.baseHands,
        formCost: form.cost,
        art: form.art,
        hands: Math.max(0, form.baseHands + delta),
        maxHands: Math.max(0, form.baseHands + maxDelta),
        nextEffectAt: s.elapsedMs + 5000,
      };
      if (unit.hands <= 0) return;
      s.units.push(unit);
      s.statuses = s.statuses.filter((x) => x.targetId !== unit.id);
      s.statuses.push(
        ...(unit.suspendedStatuses ?? [])
          .filter((x) => x.expiresAt > s.elapsedMs)
          .map((x) => ({
            ...x,
            nextTickAt: Math.max(x.nextTickAt, s.elapsedMs + 2000),
          })),
      );
      delete unit.suspendedStatuses;
      statusFlags(s);
      houseSyncOngoing(houseContext(s));
      fitnessAfterBoardChange(fitnessContext(s));
      return unit;
    },
    recruit: (source, target) => {
      let recruited = false;
      packet(s, source, target, (actual) => {
        if (actual.id !== target.id || actual.cardId !== 'snow-bunny') return;
        actual.originalOwner ??= actual.side;
        actual.side = source.side;
        recruited = true;
        event(s, {
          type: 'recruit',
          side: source.side,
          lane: actual.lane,
          position: actual.position,
          targetUnitId: actual.id,
          cardId: actual.cardId,
          ...sourceMark(source),
          text: 'RECRUITED',
        });
        houseSyncOngoing(houseContext(s));
        fitnessAfterBoardChange(fitnessContext(s));
      });
      return recruited;
    },
    lastStand: () =>
      !!s.drawsLocked || s.elapsedMs >= s.durationMs - RULES.lastStandMs,
    event: (data) => event(s, data),
  };
}

function neighborhoodContext(s: GameState): NeighborhoodContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    damage: (source, target, n) => strike(s, target, n, source),
    weaken: (source, target) =>
      hostile(s, target, (target) => addStatus(s, source, target, 'weaken')),
    silence: (source, target) =>
      hostile(s, target, (target) => addStatus(s, source, target, 'silence')),
    protect: (u) => {
      const fresh = !u.protected && u.hands > 0;
      if (fresh) protect(s, u);
      return fresh;
    },
    cleanse: (u, kinds, from) => {
      const before = s.statuses.length;
      const locks = (u.movementLocks ?? []).length;
      fullCleanse(s, u, kinds, from);
      if (!kinds) delete u.movementLocks;
      return (
        before !== s.statuses.length || locks !== (u.movementLocks ?? []).length
      );
    },
    burn: (source, target, n) =>
      hostile(s, target, (target) =>
        addStatus(
          s,
          source,
          target,
          'burn',
          n +
            (definition(s, source).element === 'Fire' &&
            definition(s, target).element === 'Plant'
              ? 1
              : 0),
          4,
        ),
      ),
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    refund: (side, n, source) => musicContext(s).refund(side, n, source),
    canLoseHands: (u) => canLoseHands(s, u),
    event: (data) => event(s, data),
  };
}
function houseContext(s: GameState): HouseContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    adjustAura: (u, delta) => {
      u.hands = Math.max(0, u.hands + delta);
      u.maxHands = Math.max(u.hands, u.maxHands + delta);
      event(s, {
        type: 'aura',
        side: u.side,
        lane: u.lane,
        position: u.position,
        targetUnitId: u.id,
        amount: delta,
        text: `STAFF ${delta > 0 ? '+' : ''}${delta}`,
      });
    },
    cleanse: (u, kinds, from) => fullCleanse(s, u, kinds, from),
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    strike: (source, target, n) => strike(s, target, n, source),
    hostile: (source, target, kind, apply) =>
      packet(s, source, target, apply, kind),
    griddle: (source, target) =>
      hostile(
        s,
        target,
        (target) => {
          target.protected = false;
          if (s.supportRuntime)
            s.supportRuntime.watches = s.supportRuntime.watches.filter(
              (x) => x.targetId !== target.id,
            );
          const burning = (target.burnStacks ?? 0) > 0;
          hurt(
            s,
            target,
            burning ? 5 : 3,
            undefined,
            'damage',
            sourceMark(source),
          );
          if (target.hands > 0)
            addStatus(
              s,
              source,
              target,
              'burn',
              1 + (definition(s, target).element === 'Plant' ? 1 : 0),
              4,
            );
        },
        false,
        'harm',
        true,
      ),
    echo: (u) => {
      if (!activeUnit(u)) return false;
      const first = s.nextEventId;
      const result = entranceAbility(s, u, true);
      return (
        result ??
        s.events.some(
          (e) =>
            e.id >= first && !['ability', 'block', 'deploy'].includes(e.type),
        )
      );
    },
    event: (data) => event(s, data),
  };
}
function communityContext(s: GameState): CommunityContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    effectiveHands,
    isAfflicted: (u) =>
      s.statuses.some((x) => x.targetId === u.id && x.expiresAt > s.elapsedMs),
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    protect: (u) => protect(s, u),
    cleanse: (u, kinds, from) => fullCleanse(s, u, kinds, from),
    heal: (u, n, from) => heal(s, u, n, from),
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    strike: (source, target, n) => strike(s, target, n, source),
    removableBonus: removableBonusHands,
    trimBonus: (_source, target, n) => {
      let actual = 0;
      hostile(s, target, (target) => {
        actual = confiscate(s, target, n);
      });
      return actual;
    },
    burn: (source, target, n) =>
      hostile(s, target, (target) =>
        addStatus(
          s,
          source,
          target,
          'burn',
          n +
            (definition(s, source).element === 'Fire' &&
            definition(s, target).element === 'Plant'
              ? 1
              : 0),
          4,
        ),
      ),
    event: (data) => event(s, data),
  };
}
function blockbusterContext(s: GameState): BlockbusterContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    damage: (source, target, n) => strike(s, target, n, source),
    selfDamage: (source, target, n) =>
      target.immune
        ? 0
        : hurt(s, target, n, undefined, 'damage', sourceMark(source)),
    sacrifice: (source, target) => {
      event(s, {
        type: 'sacrifice',
        side: target.side,
        lane: target.lane,
        position: target.position,
        targetUnitId: target.id,
        ...sourceMark(source),
        text: 'SACRIFICED',
      });
      remove(s, new Set([target.id]));
    },
    protect: (u) => protect(s, u),
    cleanse: (u, from) => fullCleanse(s, u, undefined, from),
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    burn: (source, target, n, friendlyPenalty) => {
      if (friendlyPenalty) {
        if (target.immune) return false;
        addStatus(s, source, target, 'burn', n);
        return true;
      }
      return hostile(s, target, (target) =>
        addStatus(s, source, target, 'burn', n),
      );
    },
    draw: (side, count) => {
      if (s.drawsLocked || s.elapsedMs >= s.durationMs - RULES.lastStandMs)
        return 0;
      const p = s.players[side];
      let n = 0;
      while (
        n < count &&
        p.hand.length + p.reinforcements.length < RULES.handSize &&
        p.queue.length
      ) {
        p.hand.push(p.queue.shift()!);
        n++;
      }
      syncHandAuras(s);
      return n;
    },
    random: () => effectRandom(s),
    event: (data) => event(s, data),
  };
}
function returnMusicAlly(
  s: GameState,
  target: Unit,
  options: MusicReturnOptions,
): boolean {
  if (!canReturnToHand(s, target)) return false;
  if (houseStopDeparture(houseContext(s), target)) return false;
  const recipient = target.originalOwner ?? target.side;
  const before = specialsCaptureReturn(specialsContext(s), {
    ...target,
    side: recipient,
  });
  target.side = recipient;
  // A true hand return restores the printed kit; permanent forms are separate.
  delete target.copiedAbility;
  delete target.copiedTriggers;
  const p = s.players[recipient];
  p.returnedHands ??= {};
  p.returnedHands[target.cardId] = target.hands + options.carriedHands;
  p.returnedUnits ??= {};
  p.returnedUnits[target.cardId] = structuredClone(target);
  s.units = s.units.filter((u) => u.id !== target.id);
  s.statuses = s.statuses.filter((x) => x.targetId !== target.id);
  p.hand.push(target.cardId);
  event(s, {
    type: 'return-to-hand',
    side: target.side,
    lane: target.lane,
    position: target.position,
    targetUnitId: target.id,
    cardId: target.cardId,
    text: 'SPINBACK · +2 HANDS',
  });
  syncHandAuras(s);
  fitnessAfterBoardChange(fitnessContext(s));
  specialsReturned(specialsContext(s), before);
  specialsAfterBoardChange(specialsContext(s));
  return true;
}
function musicContext(s: GameState): MusicContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    damage: (source, target, n) => strike(s, target, n, source),
    weaken: (source, target) =>
      hostile(s, target, (target) => addStatus(s, source, target, 'weaken')),
    silence: (source, target) =>
      hostile(s, target, (target) => addStatus(s, source, target, 'silence')),
    protect: (_source, target) => {
      const fresh = !target.protected && target.hands > 0;
      if (fresh) protect(s, target);
      return fresh;
    },
    trim: (source, target, n) => {
      let actual = 0;
      hostile(s, target, (target) => {
        actual = confiscate(s, target, n);
      });
      return actual;
    },
    removeBonus: (target, n) => {
      const actual = canLoseHands(s, target)
        ? Math.min(n, removableBonusHands(target))
        : 0;
      if (actual > 0) {
        target.hands -= actual;
        target.maxHands = Math.max(target.hands, target.maxHands - actual);
        recordBlockbusterReduction(blockbusterContext(s), target, actual);
        event(s, {
          type: 'royalty-transfer',
          side: target.side,
          lane: target.lane,
          position: target.position,
          targetUnitId: target.id,
          amount: actual,
          text: `−${actual} BONUS`,
        });
        fitnessAfterBoardChange(fitnessContext(s));
      }
      return actual;
    },
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    returnAllyToHand: (_source, target, options) =>
      returnMusicAlly(s, target, options),
    refund: (side, n, source) => refundMotion(s, side, n, source),
    echo: (_source, target) => {
      if (
        !activeUnit(target) ||
        !target.entranceSucceeded ||
        !definition(s, target).triggers?.includes('entrance')
      )
        return false;
      const first = s.nextEventId;
      const result = entranceAbility(s, target, true);
      return (
        result ??
        s.events.some(
          (e) =>
            e.id >= first && !['ability', 'block', 'deploy'].includes(e.type),
        )
      );
    },
    event: (data) => event(s, data),
  };
}
function fullCleanse(
  s: GameState,
  u: Unit,
  kinds?: readonly TimedStatus['kind'][],
  from?: ReactionSource,
) {
  from ??= effectSources.get(s);
  const oldLocks = (u.movementLocks ?? []).length;
  const before = s.statuses.length;
  s.statuses = s.statuses.filter(
    (x) => x.targetId !== u.id || (kinds && !kinds.includes(x.kind)),
  );
  if (!kinds) {
    musicCleansed(musicContext(s), u);
    delete u.movementLocks;
  }
  statusFlags(s);
  controlCleansed(controlContext(s), u);
  const changed =
    before !== s.statuses.length || oldLocks !== (u.movementLocks ?? []).length;
  if (changed)
    event(s, {
      type: 'cleanse',
      side: u.side,
      lane: u.lane,
      position: u.position,
      targetUnitId: u.id,
      ...(from ? sourceMark(from) : {}),
      text: 'CLEANSED',
    });
  reactionCleansed(reactionContext(s), u, changed, from);
  if (changed) contractsCleansed(contractsContext(s), u);
}
function fitnessContext(s: GameState): FitnessContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    protect: (u) => protect(s, u),
    cleanse: (u, kinds, from) => fullCleanse(s, u, kinds, from),
    heal: (u, n, from) => heal(s, u, n, from),
    clearMovementRestriction: (u) => {
      musicCleansed(musicContext(s), u);
      delete u.movementLocks;
    },
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    strike: (source, target, n) => strike(s, target, n, source),
    event: (data) => event(s, data),
  };
}
function networkContext(s: GameState): NetworkContext {
  return {
    state: s,
    definition: (u) => definition(s, u),
    active: activeUnit,
    power: effectiveHands,
    gain: (u, n, copied, from) => gain(s, u, n, copied, from),
    refund: (side, n, from) => refundMotion(s, side, n, from),
    weaken: (source, target) =>
      hostile(s, target, (target) => addStatus(s, source, target, 'weaken')),
    move: (u, lane) => moveFriendly(s, u, lane),
    openForMove: (u, lane) => openForLaneMove(s, u, lane),
    event: (data) => event(s, data),
  };
}
function supportView(s: GameState): SupportView {
  return {
    elapsedMs: s.elapsedMs,
    units: fighterUnits(s),
    element: (u) => definition(s, u).element,
    gangColor: (u) => u.gangColor ?? definition(s, u).gangColor,
    effectiveHands,
    isAfflicted: (u) =>
      s.statuses.some((x) => x.targetId === u.id && x.expiresAt > s.elapsedMs),
    canMove: (u, lane) => openForLaneMove(s, u, lane),
  };
}
function supportMark(cause: SupportCause): DamageSource {
  return {
    sourceUnitId: `support:${cause.side}:${cause.cardId}`,
    sourceSide: cause.side,
    sourceLane: cause.lane,
    sourcePosition: cause.side === 'player' ? 0 : 1,
  };
}
function supportTools(s: GameState): SupportTools {
  const attributed = (cause: SupportCause, action: () => void) => {
    const first = s.nextEventId;
    action();
    for (const e of s.events)
      if (e.id >= first && e.sourceUnitId === undefined)
        Object.assign(e, supportMark(cause));
  };
  return {
    gain: (u, n, c, from) =>
      attributed(c, () => gain(s, u, n, false, from ?? c.source)),
    protect: (u, c) => {
      const added = !u.protected && u.hands > 0;
      if (added) attributed(c, () => protect(s, u));
      return added;
    },
    cleanse: (u, c, from) =>
      attributed(c, () => {
        fullCleanse(s, u, undefined, from ?? c.source);
      }),
    restoreMotion: (side, n, c) => {
      const from = c.source ?? {
        id: `support:${c.side}:${c.cardId}`,
        cardId: c.cardId,
        side: c.side,
        lane: c.lane,
        position: c.side === 'player' ? 0 : 1,
      };
      refundMotion(s, side, n, from);
    },
    strike: (u, n, c) =>
      attributed(c, () => {
        strike(s, u, n, supportMark(c));
      }),
    move: (u, lane, c) => {
      let moved = false;
      attributed(c, () => {
        moved = moveFriendly(s, u, lane);
      });
      return moved;
    },
    setGangColor: (u, color) => {
      u.gangColor = color;
    },
    note: (text, c, u) =>
      event(s, {
        type: 'support-ready',
        side: c.side,
        lane: c.lane,
        ...(u ? { position: u.position, targetUnitId: u.id } : {}),
        ...supportMark(c),
        text,
      }),
  };
}
function preventEnemyDamage(
  s: GameState,
  target: Unit,
  amount: number,
  source: DamageSource,
  physical = false,
): number {
  if (
    !canLoseHands(s, target) &&
    !(
      physical &&
      target.immunityScope === 'abilities' &&
      !definition(s, target).cannotLoseHands
    )
  )
    return amount;
  if (source.sourceSide === target.side) return 0;
  if (housePreventHostile(houseContext(s), target, source.sourceSide, 'harm'))
    return amount;
  const kit = supportPreventEnemyDamage(
    (s.supportRuntime ??= createSupportRuntime()),
    target,
    amount,
  );
  const nail = reactionPreventEnemyLoss(
    reactionContext(s),
    target,
    Math.max(0, amount - kit),
  );
  const prevented = kit + nail;
  if (prevented)
    event(s, {
      type: 'block',
      side: target.side,
      lane: target.lane,
      position: target.position,
      targetUnitId: target.id,
      amount: prevented,
      ...source,
      text: `KIT −${prevented}`,
    });
  return prevented;
}
export interface GameOptions {
  seed?: number;
  durationMs?: number;
  travelMs?: number;
  decks?: Record<Side, string[]>;
  aiStyle?: AiStyle;
}
export function createGame(
  roster: FighterDefinition[],
  options: GameOptions = {},
): GameState {
  if (
    roster.length < 10 ||
    new Set(roster.map((c) => c.id)).size !== roster.length
  )
    throw new Error(
      'Audition requires at least ten unique supported fighters.',
    );
  for (const c of roster)
    if (
      !c.id ||
      !Number.isInteger(c.cost) ||
      c.cost < 0 ||
      c.cost > 9 ||
      !Number.isInteger(c.hands) ||
      (isActionCard(c)
        ? c.hands !== 0 ||
          !c.action ||
          (!['transfer-ticket', 'full-plate', 'liquid-courage'].includes(
            c.ability ?? '',
          ) &&
            !isSupportAbility(c.ability) &&
            !isBlockbusterAbility(c.ability))
        : c.hands <= 0) ||
      !Object.keys(ABILITY_DESCRIPTIONS).includes(c.ability ?? 'none')
    )
      throw new Error(`Unsupported audition fighter: ${c.id}`);
  if (!options.decks && roster.length !== 10)
    throw new Error(
      'Choose separate ten-card decks from this compatibility pool.',
    );
  const decks = options.decks ?? {
    player: roster.map((c) => c.id),
    opponent: roster.map((c) => c.id),
  };
  for (const side of sides)
    if (
      !Array.isArray(decks[side]) ||
      decks[side].length !== 10 ||
      new Set(decks[side]).size !== 10 ||
      decks[side].some(
        (id) =>
          [...SUMMON_TOKEN_DEFINITIONS, ...SPECIAL_TOKEN_DEFINITIONS].some(
            (c) => c.id === id,
          ) || !roster.some((c) => c.id === id),
      )
    )
      throw new Error(
        `Invalid ${side} deck: choose ten unique supported cards.`,
      );
  const durationMs = options.durationMs ?? RULES.durationMs,
    travelMs = options.travelMs ?? RULES.travelMs;
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 50 ||
    durationMs % 50 ||
    !Number.isFinite(travelMs) ||
    travelMs < 1000
  )
    throw new Error(
      'Duration must be a positive 50ms multiple; travel must be at least 1000ms.',
    );
  const seed = (options.seed ?? 1977) >>> 0,
    aiStyle = options.aiStyle ?? 'counter';
  if (!['rush', 'counter', 'support'].includes(aiStyle))
    throw new Error('Unknown AI style');
  function shuffle(ids: string[], stream: number) {
    let r = stream;
    const d = [...ids];
    for (let i = d.length - 1; i > 0; i--) {
      r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
      const j = Math.floor((r / 4294967296) * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }
  const make = (side: Side): PlayerState => {
    const d = shuffle(
      decks[side],
      options.decks
        ? (seed ^ (side === 'player' ? 0x92f371ab : 0x6bdec231)) >>> 0
        : seed,
    );
    return {
      motion: 4,
      hand: d.slice(0, 4),
      queue: d.slice(4),
      reinforcements: [],
      returns: [],
      breaches: 0,
      squabbleUsed: false,
      nextDrawAt: 3000,
      handAuraAt: {},
    };
  };
  const metric = (): MatchMetrics => ({
    deployments: 0,
    damage: 0,
    healing: 0,
    blocks: 0,
    breaches: 0,
    confiscated: 0,
  });
  const state: GameState = {
    tick: 0,
    elapsedMs: 0,
    durationMs,
    status: 'playing',
    winner: null,
    reason: null,
    units: [],
    players: { player: make('player'), opponent: make('opponent') },
    events: [],
    roster: [
      ...roster.map((c) => ({ ...c })),
      ...[...SUMMON_TOKEN_DEFINITIONS, ...SPECIAL_TOKEN_DEFINITIONS]
        .filter((c) => !roster.some((r) => r.id === c.id))
        .map((c) => ({ ...c, triggers: [...c.triggers] })),
    ],
    seed,
    travelMs,
    accumulatorMs: 0,
    nextUnitId: 1,
    nextEventId: 1,
    ruleset: BREAKTHROUGH_RULESET,
    decks: { player: [...decks.player], opponent: [...decks.opponent] },
    effectsRng: (seed ^ 0xa341316c) >>> 0,
    aiSeed: (seed ^ 0xc8013ea4) >>> 0,
    aiStyle,
    statuses: [],
    hazards: [],
    nextEffectId: 1,
    metrics: { player: metric(), opponent: metric() },
    commands: [],
    supportRuntime: createSupportRuntime(),
  };
  syncHandAuras(state);
  summonTick(summonContext(state));
  return state;
}
export function entranceAvailable(
  state: GameState,
  side: Side,
  lane: Lane,
): boolean {
  if (!sides.includes(side) || ![0, 1, 2].includes(lane)) return false;
  // Enemy pressure must never disable a defender's entrance.
  return true;
}
function quotedDiscount(
  state: GameState,
  side: Side,
  card: FighterDefinition,
  lane: Lane,
) {
  const plug = state.players[side].discount;
  if (plug && plug.origin !== lane) return { kind: 'plug' as const, amount: 1 };
  const network = networkDiscount(networkContext(state), side, card, lane);
  if (network) return { kind: 'network' as const, amount: 1, id: network.id };
  const music = musicDiscount(musicContext(state), side, card, lane);
  if (music)
    return {
      kind: 'music' as const,
      amount: 1,
      id: music.id,
      minimum: music.minimum,
    };
  const contract = contractsDiscount(contractsContext(state), side, card, lane);
  if (contract)
    return {
      kind: 'contract' as const,
      amount: contract.amount,
      id: contract.id,
      minimum: contract.minimum,
    };
  const faction = factionsDiscount(factionsContext(state), side, card, lane);
  if (faction) return { kind: 'faction' as const, amount: 1, id: faction.id };
  const special = specialsDiscount(specialsContext(state), side, card);
  return special
    ? {
        kind: 'special' as const,
        amount: 1,
        id: special.id,
        minimum: special.minimum,
      }
    : undefined;
}
export function deploymentCost(
  state: GameState,
  side: Side,
  cardId: string,
  lane: Lane,
): number {
  const card = state.roster.find((c) => c.id === cardId);
  if (
    !card ||
    card.kind === 'token' ||
    !sides.includes(side) ||
    ![0, 1, 2].includes(lane)
  )
    return Infinity;
  if (card.allowedLanes && !card.allowedLanes.includes(lane)) return Infinity;
  const quote = quotedDiscount(state, side, card, lane);
  const discount = quote?.amount ?? 0;
  const buddy = fighterUnits(state).some(
    (u) =>
      u.side === side &&
      u.lane === lane &&
      !u.squabbled &&
      activeUnit(u) &&
      definition(state, u).ability === 'buddy-buds',
  )
    ? 1
    : 0;
  const ticket =
    !isActionCard(card) && state.players[side].transferTicket ? 1 : 0;
  const base = Math.max(
    quote?.kind === 'music' ||
      quote?.kind === 'contract' ||
      quote?.kind === 'special'
      ? quote.minimum
      : 0,
    (state.players[side].returnedUnits?.[cardId]?.formCost ?? card.cost) -
      discount -
      buddy -
      ticket,
  );
  return controlQuoteCost(
    controlContext(state),
    side,
    cardId,
    lane,
    base,
    !quote,
  ).cost;
}
export interface DeploymentChoiceOption {
  value: string;
  label: string;
  extraMotion: number;
  disabled: boolean;
}
export interface DeploymentChoices {
  required: boolean;
  prompt: string;
  options: DeploymentChoiceOption[];
  error?: string;
}
/** Pure command quotation. The command revalidates the choice against current time and funds. */
export function deploymentChoices(
  state: GameState,
  side: Side,
  cardId: string,
  lane: Lane,
): DeploymentChoices {
  const card = state.roster.find((c) => c.id === cardId);
  const empty = {
    required: false,
    prompt: '',
    options: [],
  } as DeploymentChoices;
  if (!card?.choice || !sides.includes(side) || ![0, 1, 2].includes(lane))
    return empty;
  const base = deploymentCost(state, side, cardId, lane),
    available = state.players[side].motion - base;
  if (card.choice === 'investment')
    return {
      required: true,
      prompt: 'NOTHING TO LOSE',
      options: [0, 1, 2, 3, 4].map((n) => ({
        value: String(n),
        label:
          n === 0
            ? available === 0
              ? 'STEAL UP TO 2'
              : 'NO EXTRA MOTION'
            : `${n} MOTION · +${n + 1} HANDS`,
        extraMotion: n,
        disabled: n > available,
      })),
    };
  if (card.choice === 'concert')
    return {
      required: true,
      prompt: 'CROWD CONTROL',
      options: [
        {
          value: 'buff',
          label: 'HYPE THE CROWD · ALLIES +3 / THE OPPS +1',
          extraMotion: 0,
          disabled: available < 0,
        },
        {
          value: 'damage',
          label: 'MOSH PIT · THE OPPS −3 / ALLIES −1',
          extraMotion: 0,
          disabled: available < 0,
        },
      ],
    };
  return {
    required: true,
    prompt: 'BEST TWO OF THREE',
    options: [1, 2, 3].map((n) => ({
      value: String(n),
      label: `WAGER ${n} MOTION`,
      extraMotion: 0,
      disabled: available < n || state.players[other(side)].motion < n,
    })),
    error:
      available < 1 || state.players[other(side)].motion < 1
        ? 'Both players need Motion for this wager'
        : undefined,
  };
}
/** Authored action targets are automatic. An optional ID locks that canonical pick
 * for a client preview; stale or arbitrary picks fail atomically without charge. */
export function legalActionTarget(
  state: GameState,
  side: Side,
  cardId: string,
  lane: Lane,
): ActionTargetResult {
  if (!sides.includes(side) || ![0, 1, 2].includes(lane))
    return { valid: false, error: 'Invalid entrance' };
  const card = state.roster.find((c) => c.id === cardId);
  if (!card || !isActionCard(card) || !card.action)
    return { valid: false, error: 'Card is not a supported action' };
  if (isBlockbusterAbility(card.ability)) {
    const previewChoice = deploymentChoices(
      state,
      side,
      cardId,
      lane,
    ).options.find((option) => !option.disabled)?.value;
    return blockbusterLegal(
      blockbusterContext(state),
      card.ability,
      side,
      lane,
      previewChoice,
    );
  }
  if (isSupportAbility(card.ability))
    return legalSupportTarget(
      supportView(state),
      state.supportRuntime ?? createSupportRuntime(),
      card.ability,
      side,
      lane,
    );
  if (card.ability === 'transfer-ticket')
    return state.players[side].transferTicket
      ? { valid: false, error: 'A Transfer Ticket is already ready' }
      : { valid: true };
  const local = fighterUnits(state).filter(
    (u) => u.side === side && u.lane === lane && u.hands > 0,
  );
  const afflicted = local.filter((u) =>
    state.statuses.some(
      (x) => x.targetId === u.id && x.expiresAt > state.elapsedMs,
    ),
  );
  const target = strength(
    card.ability === 'full-plate' && afflicted.length ? afflicted : local,
    true,
  );
  return target
    ? { valid: true, targetUnitId: target.id }
    : {
        valid: false,
        error: 'This action needs a friendly fighter in this lane',
      };
}
export function deploy(
  state: GameState,
  side: Side,
  cardId: string,
  lane: Lane,
  squabble = false,
  target?: ActionTarget,
): {
  state: GameState;
  error?: string;
} {
  const fail = (error: string) => ({ state, error });
  if (state.status !== 'playing') return fail('Match complete');
  if (!sides.includes(side) || ![0, 1, 2].includes(lane))
    return fail('Invalid entrance');
  const p = state.players[side],
    card = state.roster.find((c) => c.id === cardId);
  if (!card || !p.hand.includes(cardId)) return fail('Card not in hand');
  if (card.kind === 'token') return fail('Summons cannot be played from hand');
  if (card.allowedLanes && !card.allowedLanes.includes(lane))
    return fail('This fighter must enter its home lane');
  const action = isActionCard(card)
    ? legalActionTarget(state, side, cardId, lane)
    : undefined;
  if (action && !action.valid) return fail(action.error!);
  if (isActionCard(card) && squabble)
    return fail('Action cards cannot Squabble');
  if (
    target &&
    (Object.keys(target).some((key) => key !== 'unitId' && key !== 'choice') ||
      (target.choice !== undefined && typeof target.choice !== 'string') ||
      (target.unitId !== undefined &&
        (typeof target.unitId !== 'string' ||
          !action ||
          target.unitId !== action.targetUnitId)))
  )
    return fail('Action target changed or is not the authored target');
  const choicePlan = deploymentChoices(state, side, cardId, lane);
  const selectedChoice = choicePlan.options.find(
    (option) => option.value === target?.choice && !option.disabled,
  );
  if (choicePlan.required && !selectedChoice)
    return fail(choicePlan.error ?? 'Choose this card’s effect before playing');
  if (!choicePlan.required && target?.choice !== undefined)
    return fail('This card has no authored choice');
  if (isBlockbusterAbility(card.ability)) {
    const legal = blockbusterLegal(
      blockbusterContext(state),
      card.ability,
      side,
      lane,
      target?.choice,
    );
    if (!legal.valid) return fail(legal.error!);
  }
  const cost =
    deploymentCost(state, side, cardId, lane) +
    (selectedChoice?.extraMotion ?? 0);
  if (p.motion < cost) return fail('Not enough Motion');
  if (squabble && p.squabbleUsed) return fail('Squabble already used');
  const s = clone(state),
    own = s.players[side];
  own.motion -= cost;
  const quote = quotedDiscount(s, side, card, lane);
  const buddy = fighterUnits(s).some(
    (u) =>
      u.side === side &&
      u.lane === lane &&
      !u.squabbled &&
      activeUnit(u) &&
      definition(s, u).ability === 'buddy-buds',
  )
    ? 1
    : 0;
  const ticket = !isActionCard(card) && own.transferTicket ? 1 : 0;
  const base = Math.max(
    quote?.kind === 'music' ||
      quote?.kind === 'contract' ||
      quote?.kind === 'special'
      ? quote.minimum
      : 0,
    (own.returnedUnits?.[cardId]?.formCost ?? card.cost) -
      (quote?.amount ?? 0) -
      buddy -
      ticket,
  );
  const controlQuote = controlQuoteCost(
    controlContext(s),
    side,
    cardId,
    lane,
    base,
    !quote,
  );
  let entryBonus = controlSpendCost(controlContext(s), controlQuote);
  if (quote?.kind === 'plug') delete own.discount;
  else if (quote?.kind === 'network')
    entryBonus += networkSpendDiscount(
      networkContext(s),
      side,
      quote.id,
      card,
      lane,
    );
  else if (quote?.kind === 'music')
    musicSpendDiscount(musicContext(s), side, quote.id);
  else if (quote?.kind === 'contract')
    contractsSpendDiscount(contractsContext(s), side, quote.id);
  else if (quote?.kind === 'faction')
    factionsSpendDiscount(factionsContext(s), side, quote.id, card, lane);
  else if (quote?.kind === 'special')
    specialsSpendDiscount(specialsContext(s), side, quote.id);
  if (own.handAuraAt) delete own.handAuraAt[cardId];
  s.commands.push({
    tick: s.tick,
    elapsedMs: s.elapsedMs,
    side,
    cardId,
    lane,
    squabble,
    ...(target ? { target: { ...target } } : {}),
  });
  if (s.commands.length > 512) s.commands.shift();
  own.hand.splice(own.hand.indexOf(cardId), 1);
  if (squabble) own.squabbleUsed = true;
  if (isActionCard(card)) {
    const source: DamageSource = {
      sourceUnitId: `action:${s.nextUnitId++}`,
      sourceSide: side,
      sourceLane: lane,
      sourcePosition: side === 'player' ? 0 : 1,
    };
    const first = s.nextEventId;
    event(s, {
      type: 'action',
      side,
      lane,
      cardId,
      ...source,
      text: card.abilityName ?? card.name,
    });
    networkPlayed(networkContext(s), side, card, lane);
    factionsPlayed(factionsContext(s), side, card, lane);
    if (isBlockbusterAbility(card.ability)) {
      const actor: Unit = {
        id: source.sourceUnitId,
        cardId,
        side,
        lane,
        position: source.sourcePosition,
        hands: 0,
        maxHands: 0,
        baseHands: 0,
        squabbled: false,
        nextEffectAt: Infinity,
      };
      resolveBlockbuster(
        blockbusterContext(s),
        card.ability,
        actor,
        target?.choice,
      );
    } else if (isSupportAbility(card.ability))
      resolveSupportAction(
        supportView(s),
        (s.supportRuntime ??= createSupportRuntime()),
        card.ability,
        side,
        lane,
        supportTools(s),
        action,
        {
          id: source.sourceUnitId,
          cardId,
          side,
          lane,
          position: source.sourcePosition,
        },
      );
    else if (card.ability === 'transfer-ticket') own.transferTicket = true;
    else {
      const recipient = fighterUnits(s).find(
        (u) => u.id === action!.targetUnitId,
      )!;
      if (card.ability === 'full-plate') {
        s.statuses = s.statuses.filter((x) => x.targetId !== recipient.id);
        musicCleansed(musicContext(s), recipient);
        statusFlags(s);
        event(s, {
          type: 'cleanse',
          side,
          lane,
          position: recipient.position,
          targetUnitId: recipient.id,
          text: 'CLEANSED',
        });
      }
      gain(
        s,
        recipient,
        card.ability === 'liquid-courage' &&
          definition(s, recipient).element === 'Fire'
          ? 4
          : 3,
      );
    }
    for (const e of s.events)
      if (e.id >= first && e.sourceUnitId === undefined)
        Object.assign(e, source);
    own.returns.push({ cardId, readyAt: s.elapsedMs + RULES.returnMs });
    cleanupDeaths(s);
    syncHandAuras(s);
    specialsAfterBoardChange(specialsContext(s));
    return { state: s };
  }
  const order = s.nextUnitId++;
  own.reinforcements.push({
    id: `u${order}`,
    order,
    cardId,
    lane,
    squabble,
    cost,
    entryBonus,
    ...(selectedChoice ? { choice: selectedChoice.value } : {}),
    baseCostSpentLastMotion:
      p.motion === deploymentCost(state, side, cardId, lane),
    queuedAt: s.elapsedMs,
  });
  releaseReinforcements(s);
  return { state: s };
}

function resolveEntrance(
  s: GameState,
  u: Unit,
  options: { deferred?: boolean } = {},
): 'resolved' | 'cancelled' | 'queued' | 'none' {
  const card = definition(s, u),
    side = u.side,
    lane = u.entrancePaidLane ?? u.lane;
  const admission = controlBeforeEntrance(
    controlContext(s),
    u,
    options.deferred,
  );
  if (admission.cancelled || admission.delayUntil !== undefined) {
    u.entranceSucceeded = false;
    contractsArrived(contractsContext(s), u);
    return admission.cancelled ? 'cancelled' : 'queued';
  }
  if (!activeUnit(u)) {
    u.entranceSucceeded = false;
    if (!options.deferred) contractsArrived(contractsContext(s), u);
    return 'none';
  }

  if (card.ability === 'push') {
    const target = nearest(s, u);
    if (target) {
      const direction = target.side === 'player' ? -1 : 1;
      let dest = Math.max(
        0.001,
        Math.min(0.999, target.position + direction * 0.06),
      );
      for (const blocker of fighterUnits(s))
        if (
          blocker.id !== target.id &&
          blocker.lane === lane &&
          (blocker.position - target.position) * direction > 0
        )
          dest =
            direction > 0
              ? Math.min(
                  dest,
                  Math.max(target.position, blocker.position - RULES.spacing),
                )
              : Math.max(
                  dest,
                  Math.min(target.position, blocker.position + RULES.spacing),
                );
      target.position = dest;
      event(s, { type: 'push', side, lane, position: dest, text: 'PUSH' });
    }
  }
  const firstEntranceEvent = s.nextEventId;
  const musicResult = entranceAbility(s, u);
  u.entranceSucceeded =
    musicResult ??
    s.events.some(
      (e) =>
        e.id >= firstEntranceEvent &&
        !['deploy', 'block', 'ability'].includes(e.type),
    );
  entranceReactions(s, u, lane);
  musicEntranceResolved(musicContext(s), u);
  communityResolvedEntrance(communityContext(s), u, !!u.entranceSucceeded);
  specialsEntranceResolved(specialsContext(s), u, !!u.entranceSucceeded);
  if (!options.deferred) housePlayed(houseContext(s), u);
  contractsEntranceResolved(contractsContext(s), u);
  factionsEntranceResolved(factionsContext(s), u, lane);
  if (!options.deferred) contractsArrived(contractsContext(s), u);
  return card.triggers?.includes('entrance') ? 'resolved' : 'none';
}

/** Materialize every paid drop synchronously. Friendly spacing never gates deployment. */
function releaseReinforcements(s: GameState): number {
  const ready = sides
    .flatMap((side) =>
      s.players[side].reinforcements.map((reserve) => ({ side, reserve })),
    )
    .sort((a, b) => a.reserve.order - b.reserve.order);
  const entrants: Unit[] = [];
  const fitnessSnapshots = new Map<string, FitnessBoardSnapshot>();
  const musicSnapshots = new Map<string, MusicDeploymentSnapshot>();
  const paidLanes = new Map<string, Lane>();
  for (const { side, reserve } of ready) {
    const p = s.players[side],
      card = s.roster.find((c) => c.id === reserve.cardId)!;
    p.reinforcements = p.reinforcements.filter((r) => r.id !== reserve.id);
    const returning = p.returnedUnits?.[reserve.cardId];
    const instanceId = returning?.id ?? reserve.id;
    fitnessSnapshots.set(instanceId, captureFitnessBoard(fitnessContext(s)));
    musicSnapshots.set(instanceId, musicCaptureDeployment(musicContext(s)));
    const entryBase = deploymentBaseHands(s, side, card.id);
    const u: Unit = {
      ...(returning ? { ...returning } : {}),
      id: instanceId,
      origin: 'deck',
      ...(reserve.choice !== undefined
        ? { entranceChoice: reserve.choice }
        : {}),
      baseCostSpentLastMotion: reserve.baseCostSpentLastMotion,
      cardId: reserve.cardId,
      side,
      lane: reserve.lane,
      position: side === 'player' ? 0 : 1,
      hands: entryBase * (reserve.squabble ? 2 : 1),
      baseHands: entryBase,
      maxHands: entryBase * (reserve.squabble ? 2 : 1),
      squabbled: reserve.squabble,
      deployedAt: s.elapsedMs,
      entrancePaidLane: reserve.lane,
      arrivalOrder: s.nextEventId,
      nextEffectAt: s.elapsedMs + (card.ability === 'mend' ? 6000 : 5000),
    };
    if (p.returnedUnits) delete p.returnedUnits[reserve.cardId];
    delete u.challenge;
    delete u.lunch;
    delete u.movementLocks;
    u.frozen = false;
    u.silenced = false;
    u.weakened = false;
    u.burnStacks = 0;
    u.protected = false;
    const carried = p.returnedHands?.[u.cardId];
    if (carried !== undefined) {
      u.hands = carried * (reserve.squabble ? 2 : 1);
      u.maxHands = u.hands;
      u.damageTaken = 0;
      delete p.returnedHands![u.cardId];
    }
    s.units.push(u);
    paidLanes.set(u.id, reserve.lane);
    entrants.push(u);
    if (p.transferTicket) {
      delete p.transferTicket;
      gain(s, u, 2);
    }
    if (reserve.entryBonus) gain(s, u, reserve.entryBonus);
    supportCharacterDeployed(
      supportView(s),
      (s.supportRuntime ??= createSupportRuntime()),
      u,
      supportTools(s),
    );
    summonPlayed(summonContext(s), u, reserve.lane);
    reactionPlayed(reactionContext(s), u);
    controlPlayed(controlContext(s), u);
    factionsPlayed(factionsContext(s), side, card, reserve.lane, u);
    controlArrived(controlContext(s), u);
    communityArrived(communityContext(s), u);
    neighborhoodArrived(neighborhoodContext(s), u);
    houseSyncOngoing(houseContext(s));
    houseArrived(houseContext(s), u);
    contractsBeforeEntrance(contractsContext(s), u);
    contractsPlayed(contractsContext(s), u, { paidLane: reserve.lane });
    networkPlayed(networkContext(s), side, card, reserve.lane, u);
    fitnessPlayed(fitnessContext(s), u);
    event(s, {
      type: 'deploy',
      side,
      lane: u.lane,
      position: u.position,
      cardId: u.cardId,
      text: `${card.name}${u.squabbled ? ' · SQUABBLE' : ''}`,
    });
  }
  // Both seats' entrants exist before their abilities resolve.
  for (const u of entrants)
    if (fighterUnits(s).some((v) => v.id === u.id && v.hands > 0)) {
      const outcome = resolveEntrance(s, u);
      musicPlayed(musicContext(s), u, {
        outcome,
        paidLane: paidLanes.get(u.id)!,
        snapshot: musicSnapshots.get(u.id),
      });
      fitnessAfterBoardChange(fitnessContext(s), u, fitnessSnapshots.get(u.id));
    }
  for (const u of entrants) specialsPlayed(specialsContext(s), u);
  specialsAfterBoardChange(specialsContext(s));
  return ready.length;
}

export function cancelReinforcement(
  state: GameState,
  side: Side,
  cardId: string,
): { state: GameState; error?: string } {
  if (state.status !== 'playing') return { state, error: 'Match complete' };
  if (!sides.includes(side)) return { state, error: 'Invalid side' };
  const reserve = state.players[side].reinforcements.find(
    (r) => r.cardId === cardId,
  );
  if (!reserve) return { state, error: 'Fighter already entered' };
  if (state.players[side].hand.length >= RULES.handSize)
    return { state, error: 'Hand full' };
  const s = clone(state),
    p = s.players[side];
  p.reinforcements = p.reinforcements.filter((r) => r.id !== reserve.id);
  p.hand.push(cardId);
  p.motion = Math.min(RULES.motionCap, p.motion + reserve.cost);
  if (reserve.squabble) p.squabbleUsed = false;
  syncHandAuras(s);
  s.commands.push({
    action: 'cancel-reinforcement',
    tick: s.tick,
    elapsedMs: s.elapsedMs,
    side,
    cardId,
    lane: reserve.lane,
    squabble: reserve.squabble,
  });
  if (s.commands.length > 512) s.commands.shift();
  event(s, {
    type: 'reinforcement-cancelled',
    side,
    lane: reserve.lane,
    cardId,
    text: 'BACK IN HAND',
  });
  return { state: s };
}

export function replayCommand(state: GameState, command: DeployCommand) {
  return command.action === 'cancel-reinforcement'
    ? cancelReinforcement(state, command.side, command.cardId)
    : deploy(
        state,
        command.side,
        command.cardId,
        command.lane,
        command.squabble,
        command.target,
      );
}
function resolveContacts(s: GameState, old: Map<string, number>) {
  // Contact pairs sorted by crossing time, then stable IDs. A survivor can meet a second fighter this tick.
  const contacts: {
    a: Unit;
    b: Unit;
    t: number;
  }[] = [];
  for (const a of fighterUnits(s).filter((u) => u.side === 'player'))
    for (const b of fighterUnits(s).filter(
      (u) => u.side === 'opponent' && u.lane === a.lane,
    )) {
      const gap = old.get(b.id)! - old.get(a.id)!;
      if (gap >= 0 && a.position + RULES.spacing >= b.position) {
        const closing =
          a.position - old.get(a.id)! + (old.get(b.id)! - b.position);
        contacts.push({
          a,
          b,
          t: closing > 0 ? Math.max(0, gap - RULES.spacing) / closing : 0,
        });
      }
    }
  contacts.sort(
    (x, y) =>
      x.t - y.t || x.a.id.localeCompare(y.a.id) || x.b.id.localeCompare(y.b.id),
  );
  for (const { a, b, t } of contacts)
    if (
      a.hands > 0 &&
      b.hands > 0 &&
      a.position + RULES.spacing >= b.position
    ) {
      const ah = effectiveHands(a),
        bh = effectiveHands(b);
      if (ah === 0 && bh === 0) continue;
      // Stop at first physical contact, never at overlapping card centres.
      // This is motion integration, not an authoritative animation pause.
      a.position =
        old.get(a.id)! + (a.position - old.get(a.id)!) * Math.min(1, t);
      b.position =
        old.get(b.id)! + (b.position - old.get(b.id)!) * Math.min(1, t);
      const incomingA = a.frozen && bh > 0 ? a.hands : bh;
      const incomingB = b.frozen && ah > 0 ? b.hands : ah;
      const afterKitA = Math.max(
          0,
          incomingA - preventEnemyDamage(s, a, incomingA, sourceMark(b), true),
        ),
        afterKitB = Math.max(
          0,
          incomingB - preventEnemyDamage(s, b, incomingB, sourceMark(a), true),
        );
      const damageA = Math.min(
        a.hands,
        Math.max(
          0,
          afterKitA - communityPreventLethal(communityContext(s), a, afterKitA),
        ),
      );
      const damageB = Math.min(
        b.hands,
        Math.max(
          0,
          afterKitB - communityPreventLethal(communityContext(s), b, afterKitB),
        ),
      );
      a.damageTaken = (a.damageTaken ?? 0) + damageA;
      b.damageTaken = (b.damageTaken ?? 0) + damageB;
      a.hands -= damageA;
      b.hands -= damageB;
      recordBlockbusterReduction(blockbusterContext(s), a, damageA);
      recordBlockbusterReduction(blockbusterContext(s), b, damageB);
      s.metrics[b.side].damage += damageA;
      s.metrics[a.side].damage += damageB;
      event(s, {
        type: 'hit',
        lane: a.lane,
        position: (a.position + b.position) / 2,
        text: 'IMPACT',
      });
      for (const [target, source, amount] of [
        [a, b, damageA],
        [b, a, damageB],
      ] as const)
        if (amount > 0) {
          event(s, {
            type: 'collision-damage',
            targetUnitId: target.id,
            cardId: target.cardId,
            side: target.side,
            lane: target.lane,
            position: target.position,
            amount,
            ...sourceMark(source),
            text: `−${amount}`,
          });
        }
      useLunch(s, a, damageA);
      useLunch(s, b, damageB);
      if (damageA > 0) retaliateFamily(s, a, sourceMark(b));
      if (damageB > 0) retaliateFamily(s, b, sourceMark(a));
      fitnessEnemyDamage(fitnessContext(s), b.side, a, damageA);
      fitnessEnemyDamage(fitnessContext(s), a.side, b, damageB);
      musicDamaged(musicContext(s), { source: b, victim: a, amount: damageA });
      musicDamaged(musicContext(s), { source: a, victim: b, amount: damageB });
      reactionDamaged(reactionContext(s), sourceMark(b), a, damageA, {
        ability: false,
      });
      reactionDamaged(reactionContext(s), sourceMark(a), b, damageB, {
        ability: false,
      });
      controlDamaged(controlContext(s), b.side, b.id, a, damageA);
      controlDamaged(controlContext(s), a.side, a.id, b, damageB);
      if (a.hands <= 0) controlDestroyed(controlContext(s), a, b.side);
      if (b.hands <= 0) controlDestroyed(controlContext(s), b, a.side);
      contractsDamaged(contractsContext(s), b, a, damageA);
      contractsDamaged(contractsContext(s), a, b, damageB);
      if (a.hands <= 0)
        contractsDestroyed(contractsContext(s), a, b.side, true);
      if (b.hands <= 0)
        contractsDestroyed(contractsContext(s), b, a.side, true);
      fitnessAfterBoardChange(fitnessContext(s));
    }
  remove(
    s,
    new Set(
      fighterUnits(s)
        .filter((u) => u.hands <= 0)
        .map((u) => u.id),
    ),
  );
}

function tick(s: GameState) {
  s.tick++;
  s.elapsedMs += RULES.tickMs;
  pruneSupportRuntime(
    supportView(s),
    (s.supportRuntime ??= createSupportRuntime()),
  );
  networkTick(networkContext(s));
  fitnessPulse(fitnessContext(s));
  musicTick(musicContext(s));
  communityPulse(communityContext(s));
  blockbusterTick(blockbusterContext(s));
  neighborhoodTick(neighborhoodContext(s));
  housePulse(houseContext(s));
  summonTick(summonContext(s));
  reactionPulse(reactionContext(s));
  contractsTick(contractsContext(s));
  factionsTick(factionsContext(s));
  controlPulse(controlContext(s));
  for (const side of sides) {
    const p = s.players[side];
    p.motion = Math.min(
      RULES.motionCap,
      (Math.round(p.motion * 1000) +
        Math.round(networkRefill(networkContext(s), side, 0.025) * 1000)) /
        1000,
    );
    if (!s.drawsLocked && s.elapsedMs < s.durationMs - RULES.lastStandMs) {
      const ready = p.returns.filter((r) => r.readyAt <= s.elapsedMs);
      p.returns = p.returns.filter((r) => r.readyAt > s.elapsedMs);
      p.queue.push(...ready.map((r) => r.cardId));
      if (p.nextDrawAt <= s.elapsedMs) {
        // Waiting reinforcements reserve their hand slots, so cancellation always fits.
        if (
          p.hand.length + p.reinforcements.length < RULES.handSize &&
          p.queue.length
        )
          p.hand.push(p.queue.shift()!);
        p.nextDrawAt = s.elapsedMs + RULES.drawMs;
      }
    }
  }
  if (!s.drawsLocked && s.elapsedMs >= s.durationMs - RULES.lastStandMs) {
    s.drawsLocked = true;
    event(s, { type: 'last-stand', text: 'LAST STAND · NO MORE DRAWS' });
  }
  resolveTimedStatuses(s);
  specialsTick(specialsContext(s));
  resolveHazards(s);
  resolveHandAuras(s);
  settleChallenges(s);
  // Lock eligible emitters before resolving hits. A reciprocal lethal hit must
  // not erase an already-due ability, while every packet still respects the
  // recipient's defenses, actual remaining Hands, and packed lunch.
  const damage: { target: Unit; source: ReturnType<typeof sourceMark> }[] = [];
  for (const u of s.units)
    if (u.nextEffectAt <= s.elapsedMs) {
      if (!activeUnit(u)) {
        u.nextEffectAt = s.elapsedMs + period(s, u);
        continue;
      }
      const ability = definition(s, u).ability;
      u.nextEffectAt += period(s, u);
      if (ability === 'burn') {
        const target = nearest(s, u);
        if (target) {
          damage.push({ target, source: sourceMark(u) });
        }
      }
      if (ability === 'mend' && u.hands < u.maxHands) {
        const restored = Math.min(
          1,
          u.damageTaken ?? Math.max(0, u.maxHands - u.hands),
        );
        u.hands += restored;
        u.damageTaken = Math.max(0, (u.damageTaken ?? restored) - restored);
        if (restored > 0)
          event(s, {
            type: 'mend',
            side: u.side,
            lane: u.lane,
            position: u.position,
            sourceUnitId: u.id,
            sourceSide: u.side,
            sourceLane: u.lane,
            sourcePosition: u.position,
            amount: restored,
            text: `+${restored}`,
          });
      }
    }
  for (const { target, source } of damage.sort((a, b) =>
    a.source.sourceUnitId.localeCompare(b.source.sourceUnitId),
  )) {
    const firstEventId = s.nextEventId;
    hostile(s, target, (target) => {
      hurt(s, target, 1, 'burn', 'burn', source);
    });
    for (const e of s.events)
      if (e.id >= firstEventId && e.sourceUnitId === undefined)
        Object.assign(e, source);
  }
  remove(
    s,
    new Set(
      fighterUnits(s)
        .filter((u) => u.hands <= 0)
        .map((u) => u.id),
    ),
  );
  // A defender lost to a timed effect is replaced before an attacker can move across the base.
  while (releaseReinforcements(s) > 0)
    resolveContacts(s, new Map(s.units.map((u) => [u.id, u.position])));
  const old = new Map(s.units.map((u) => [u.id, u.position]));
  for (const lane of [0, 1, 2] as Lane[])
    for (const side of sides) {
      // Freeze stops its target, not friendly traffic. Frozen units retain
      // their position and enemy contact, but do not join the marching queue.
      const ordered = fighterUnits(s)
        .filter(
          (u) =>
            u.lane === lane &&
            u.side === side &&
            !u.frozen &&
            !(u.movementLocks ?? []).some(
              (lock) => lock.expiresAt > s.elapsedMs,
            ),
        )
        .sort((a, b) =>
          side === 'player' ? b.position - a.position : a.position - b.position,
        );
      let ahead: number | undefined;
      for (const u of ordered) {
        const proposed =
          u.position +
          ((side === 'player' ? 1 : -1) * RULES.tickMs) / s.travelMs;
        u.position =
          ahead === undefined
            ? proposed
            : side === 'player'
              ? Math.max(u.position, Math.min(proposed, ahead - RULES.spacing))
              : Math.min(u.position, Math.max(proposed, ahead + RULES.spacing));
        ahead = u.position;
      }
    }
  resolveContacts(s, old);
  // A surviving front fighter may stop earlier than its proposed movement.
  // Re-clamp its queue without ever moving a follower behind its tick start.
  for (const lane of [0, 1, 2] as Lane[])
    for (const side of sides) {
      const queue = fighterUnits(s)
        .filter(
          (u) =>
            u.lane === lane &&
            u.side === side &&
            !u.frozen &&
            !(u.movementLocks ?? []).some(
              (lock) => lock.expiresAt > s.elapsedMs,
            ),
        )
        .sort((a, b) =>
          side === 'player' ? b.position - a.position : a.position - b.position,
        );
      let ahead: number | undefined;
      for (const u of queue) {
        if (ahead !== undefined)
          u.position =
            side === 'player'
              ? Math.max(
                  old.get(u.id)!,
                  Math.min(u.position, ahead - RULES.spacing),
                )
              : Math.min(
                  old.get(u.id)!,
                  Math.max(u.position, ahead + RULES.spacing),
                );
        ahead = u.position;
      }
    }
  // Reinforcements meet a surviving attacker before the base score is resolved.
  // Each pass consumes a reserve, so even a burst at the base is bounded by the crew.
  while (releaseReinforcements(s) > 0)
    resolveContacts(s, new Map(s.units.map((u) => [u.id, u.position])));
  const scored = new Set<string>();
  for (const u of s.units)
    if (
      u.canBreach !== false &&
      (u.side === 'player' ? u.position >= 1 : u.position <= 0)
    ) {
      s.players[u.side].breaches = Math.min(2, s.players[u.side].breaches + 1);
      scored.add(u.id);
      event(s, {
        type: 'breach',
        side: u.side,
        lane: u.lane,
        position: u.side === 'player' ? 1 : 0,
        text: 'BASE BREACHED',
      });
    }
  remove(s, scored);
  specialsAfterBoardChange(specialsContext(s));
  const p = s.players.player.breaches >= 2,
    o = s.players.opponent.breaches >= 2;
  if (p || o) {
    s.status = 'complete';
    s.winner = p && o ? 'draw' : p ? 'player' : 'opponent';
    s.reason = p && o ? 'Simultaneous second breaches' : 'Two base breaches';
  } else if (s.elapsedMs >= s.durationMs) {
    const bp = s.players.player.breaches,
      bo = s.players.opponent.breaches;
    const hp = s.units
        .filter((u) => u.side === 'player')
        .reduce((n, u) => n + effectiveHands(u), 0),
      ho = s.units
        .filter((u) => u.side === 'opponent')
        .reduce((n, u) => n + effectiveHands(u), 0);
    s.status = 'complete';
    s.winner =
      bp !== bo
        ? bp > bo
          ? 'player'
          : 'opponent'
        : hp === ho
          ? 'draw'
          : hp > ho
            ? 'player'
            : 'opponent';
    s.reason =
      bp !== bo
        ? 'Timeout · base breaches'
        : hp === ho
          ? 'Timeout · equal Hands'
          : 'Timeout · surviving Hands';
  }
  if (s.status === 'complete') event(s, { type: 'result', text: s.reason! });
}
function advanceClock(
  state: GameState,
  deltaMs: number,
  practice: boolean,
): GameState {
  if (!Number.isFinite(deltaMs) || deltaMs < 0)
    throw new Error('Elapsed delta must be finite and non-negative');
  if (state.status !== 'playing' || deltaMs === 0) return state;
  let s = clone(state);
  s.accumulatorMs += deltaMs;
  while (s.accumulatorMs >= RULES.tickMs && s.status === 'playing') {
    s.accumulatorMs -= RULES.tickMs;
    tick(s);
    // Decisions belong to newly completed simulation ticks, never render frames.
    // Resuming at an already processed boundary cannot repeat that decision.
    if (practice && s.status === 'playing' && s.elapsedMs % 900 === 0) {
      const move = chooseAi(s);
      if (move)
        s = deploy(
          s,
          'opponent',
          move.cardId,
          move.lane,
          move.squabble,
          move.target,
        ).state;
    }
  }
  if (s.status === 'complete') s.accumulatorMs = 0;
  return s;
}
export function advance(state: GameState, deltaMs: number): GameState {
  return advanceClock(state, deltaMs, false);
}
/** Local opponent decisions occur every 900ms of simulation time, including catch-up ticks. */
export function advancePractice(state: GameState, deltaMs: number): GameState {
  return advanceClock(state, deltaMs, true);
}
export function chooseAi(
  state: GameState,
  side: Side = 'opponent',
  style: AiStyle = state.aiStyle,
): {
  cardId: string;
  lane: Lane;
  squabble: boolean;
  target?: ActionTarget;
} | null {
  if (state.status !== 'playing' || !sides.includes(side)) return null;
  const candidates: {
    card: FighterDefinition;
    lane: Lane;
    score: number;
    tie: number;
    target?: ActionTarget;
  }[] = [];
  for (const id of state.players[side].hand) {
    const card = state.roster.find((c) => c.id === id)!;
    for (const lane of [0, 1, 2] as Lane[]) {
      if (isActionCard(card) && !legalActionTarget(state, side, id, lane).valid)
        continue;
      const choices = deploymentChoices(state, side, id, lane);
      const available = choices.options.filter((option) => !option.disabled);
      if (choices.required && !available.length) continue;
      const selectedChoice =
        card.choice === 'investment'
          ? available[Math.min(2, available.length - 1)]
          : card.choice === 'concert'
            ? available.find(
                (option) =>
                  option.value ===
                  (fighterUnits(state).filter(
                    (u) => u.side !== side && u.lane === lane,
                  ).length
                    ? 'damage'
                    : 'buff'),
              )
            : available[0];
      const cost =
        deploymentCost(state, side, id, lane) +
        (selectedChoice?.extraMotion ?? 0);
      if (cost > state.players[side].motion) continue;
      const allies = fighterUnits(state).filter(
          (u) => u.side === side && u.lane === lane,
        ),
        enemies = fighterUnits(state).filter(
          (u) => u.side !== side && u.lane === lane,
        );
      const waiting = state.players[side].reinforcements.filter(
        (r) => r.lane === lane,
      );
      const reserveHands = waiting.reduce(
        (n, r) =>
          n +
          state.roster.find((c) => c.id === r.cardId)!.hands *
            (r.squabble ? 2 : 1),
        0,
      );
      const pressure =
        enemies.reduce(
          (n, u) =>
            n +
            effectiveHands(u) *
              (0.5 + (side === 'player' ? 1 - u.position : u.position)),
          0,
        ) -
        allies.reduce((n, u) => n + effectiveHands(u), 0) -
        reserveHands;
      const support = hasTacticalRole(card, 'support');
      const control = hasTacticalRole(card, 'control');
      const actionValue = isActionCard(card)
        ? card.ability === 'transfer-ticket'
          ? 4
          : 4.5
        : 0;
      const value =
        card.hands +
        actionValue -
        cost * 0.25 +
        (support && allies.length ? 3 : 0) +
        (control && enemies.length ? 3 : 0);
      const score =
        style === 'rush'
          ? value -
            cost * 1.1 -
            enemies.length * 2 -
            (allies.length + waiting.length) * 0.4
          : style === 'support'
            ? value +
              (support && allies.length ? 5 : 0) +
              pressure * 0.3 -
              waiting.length * 0.7
            : value + pressure * 0.9 - waiting.length * 0.7;
      const tie =
        (Math.imul(state.aiSeed ^ state.tick, 1664525) ^
          (lane * 7919) ^
          id.split('').reduce((n, c) => n + c.charCodeAt(0), 0)) >>>
        0;
      candidates.push({
        card,
        lane,
        score,
        tie,
        ...(selectedChoice ? { target: { choice: selectedChoice.value } } : {}),
      });
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.tie - b.tie ||
      a.card.id.localeCompare(b.card.id) ||
      a.lane - b.lane,
  );
  const pick = candidates[0];
  return pick
    ? {
        cardId: pick.card.id,
        lane: pick.lane,
        ...(pick.target ? { target: pick.target } : {}),
        squabble: !state.players[side].squabbleUsed && pick.card.hands >= 5,
      }
    : null;
}
