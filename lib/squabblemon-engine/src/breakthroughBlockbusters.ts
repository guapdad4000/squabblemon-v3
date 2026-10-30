/** Authored Blockbusters are one-shot actions, never zero-Hands lane fighters.
 * All timers/RNG live in deterministic match state; animation does not gate play. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  Unit,
} from './breakthrough';
type EffectSource = Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>;

export const BLOCKBUSTER_PULSE_MS = 10000;
export const BLOCKBUSTER_ABILITY_DESCRIPTIONS = {
  crossfire:
    'Action: hit every enemy here for 3; your strongest friendly fighter here takes 1 direct damage. Each hostile hit resolves normal defenses independently.',
  'run-it-back-twice':
    'Action: replay each actual Hands reduction from this lane during the current 10-second pulse three additional times on the same surviving fighter, only if it is still here. Replayed reductions never enter the history.',
  'clear-the-intersection':
    'Action: move every fighter here to its weakest other legal lane. Successfully moved friendly fighters gain +2. Frozen fighters and blocked destinations stay; each side keeps its movement progress.',
  'crowd-control':
    'Action: choose the concert. Hype gives your fighters here +3 and enemies +1. Chaos hits enemies here for 3 and your fighters for 1. You must choose; the game never picks for you.',
  'trust-nobody':
    'Action: sacrifice your weakest fighter here. Your strongest other fighter here gains the sacrifice’s current Hands plus 4 and Protection. Requires at least two living friendly fighters; sacrifice bypasses defensive shields.',
  'best-two-of-three':
    'Action: explicitly wager 1–3 Motion, affordable by both sides. Each side rolls three D6; sum the highest two. Winner receives the 2× wager pot, capped at 9, and their weakest fighter here gains +3. Ties refund both wagers.',
  'one-more-round':
    'Action once globally: extend the match by 10 seconds and give every friendly fighter +2. Additional After Parties grant neither extension nor buffs. Draws already stopped for Last Stand remain stopped.',
  'everybody-pull-up':
    'Action: move every fighter from both sides toward this lane if lateral movement is legal. Successfully moved friendly fighters gain +2. Frozen fighters and blocked destinations stay.',
  'hot-plate':
    'Action: serve three meals in seeded random occupied friendly lanes, with replacement. Each meal fully cleanses that lane’s current weakest fighter and gives +2. Leave one Burnt Plate in a seeded occupied lane; at the next 10-second pulse it gives one random friendly fighter there 1 Burn, then clears.',
  'new-blessings':
    'Action: every friendly fighter here gains +3; draw up to two available queued cards, respecting the hand limit and Last Stand draw cutoff. No cards are created or silently swapped.',
  'nothing-to-lose':
    'Deploy: explicitly invest 0–4 extra Motion. Gain that many Hands plus 1 if any was invested. If the deployment cost alone exhausted your Motion, instead attempt to steal up to 2 actual Hands from the strongest enemy here. Blocked damage grants nothing.',
} as const;
export const BLOCKBUSTER_ADAPTERS = {
  'the-shootout': { ability: 'crossfire', tacticalRoles: ['control'] },
  'the-block-spin': {
    ability: 'run-it-back-twice',
    tacticalRoles: ['control'],
  },
  'the-sideshow': {
    ability: 'clear-the-intersection',
    tacticalRoles: ['control'],
  },
  'the-concert': {
    ability: 'crowd-control',
    choice: 'concert',
    tacticalRoles: ['support', 'control'],
  },
  'the-setup': { ability: 'trust-nobody', tacticalRoles: ['support'] },
  'the-dice-game': {
    ability: 'best-two-of-three',
    choice: 'wager',
    tacticalRoles: ['support'],
  },
  'the-after-party': { ability: 'one-more-round', tacticalRoles: ['support'] },
  'the-kickback': {
    ability: 'everybody-pull-up',
    tacticalRoles: ['support', 'control'],
  },
  'the-cookout': { ability: 'hot-plate', tacticalRoles: ['support'] },
  'the-babyshower': { ability: 'new-blessings', tacticalRoles: ['support'] },
  'homeless-guy': {
    ability: 'nothing-to-lose',
    choice: 'investment',
    tacticalRoles: ['control'],
  },
} as const;
export type BlockbusterAbility = Exclude<
  keyof typeof BLOCKBUSTER_ABILITY_DESCRIPTIONS,
  'nothing-to-lose'
>;
export const BLOCKBUSTER_CHOICES = {
  investment: ['0', '1', '2', '3', '4'],
  concert: ['buff', 'damage'],
  wager: ['1', '2', '3'],
} as const;
interface Reduction {
  targetId: string;
  lane: Lane;
  amount: number;
}
interface BurntPlate {
  source: Unit;
  lane: Lane;
  dueAt: number;
}
export interface BlockbusterDiceResult {
  wager: number;
  player: number[];
  opponent: number[];
  winner: Side | 'draw';
}
export interface BlockbusterMatchState {
  pulse: number;
  reductions: Reduction[];
  repeating: boolean;
  afterPartyUsed: boolean;
  plates: BurntPlate[];
  dice?: BlockbusterDiceResult;
}
export interface BlockbusterContext {
  state: GameState & {
    blockbusters?: BlockbusterMatchState;
    drawsLocked?: boolean;
  };
  definition(unit: Unit): Pick<FighterDefinition, 'id' | 'hands' | 'kind'>;
  power(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: EffectSource,
  ): void;
  damage(source: Unit, target: Unit, amount: number): number;
  selfDamage(source: Unit, target: Unit, amount: number): number;
  sacrifice(source: Unit, target: Unit): void;
  protect(target: Unit): void;
  cleanse(target: Unit, source?: EffectSource): void;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  burn(
    source: Unit,
    target: Unit,
    stacks: number,
    friendlyPenalty?: boolean,
  ): boolean;
  draw(side: Side, count: number): number;
  random(): number;
  event(event: Omit<BattleEvent, 'id'>): void;
}
const LANES: Lane[] = [0, 1, 2];
const other = (side: Side): Side => (side === 'player' ? 'opponent' : 'player');
function runtime(ctx: BlockbusterContext): BlockbusterMatchState {
  return (ctx.state.blockbusters ??= {
    pulse: Math.floor(ctx.state.elapsedMs / BLOCKBUSTER_PULSE_MS),
    reductions: [],
    repeating: false,
    afterPartyUsed: false,
    plates: [],
  });
}
export function cloneBlockbusterState(
  state: BlockbusterMatchState | undefined,
): BlockbusterMatchState | undefined {
  if (!state) return undefined;
  return {
    ...state,
    reductions: state.reductions.map((hit) => ({ ...hit })),
    plates: state.plates.map((plate) => ({
      ...plate,
      source: { ...plate.source },
    })),
    ...(state.dice
      ? {
          dice: {
            ...state.dice,
            player: [...state.dice.player],
            opponent: [...state.dice.opponent],
          },
        }
      : {}),
  };
}
export function isBlockbusterAbility(
  ability: string | undefined,
): ability is BlockbusterAbility {
  return (
    ability !== undefined &&
    ability !== 'nothing-to-lose' &&
    Object.hasOwn(BLOCKBUSTER_ABILITY_DESCRIPTIONS, ability)
  );
}
function fighters(ctx: BlockbusterContext, lane?: Lane): Unit[] {
  return ctx.state.units.filter(
    (unit) =>
      unit.hands > 0 &&
      (lane === undefined || unit.lane === lane) &&
      ['character', 'token'].includes(
        ctx.definition(unit).kind ?? 'character',
      ) &&
      (unit as Unit & { canFight?: boolean }).canFight !== false,
  );
}
function weakest(ctx: BlockbusterContext, units: Unit[]): Unit | undefined {
  return [...units].sort(
    (a, b) => ctx.power(a) - ctx.power(b) || a.id.localeCompare(b.id),
  )[0];
}
function strongest(ctx: BlockbusterContext, units: Unit[]): Unit | undefined {
  return [...units].sort(
    (a, b) => ctx.power(b) - ctx.power(a) || a.id.localeCompare(b.id),
  )[0];
}
function provenance(source: Unit) {
  return {
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
  };
}
function gain(
  ctx: BlockbusterContext,
  source: Unit,
  target: Unit,
  amount: number,
  text: string,
) {
  const first = ctx.state.nextEventId;
  ctx.gain(target, amount, undefined, source);
  for (const event of ctx.state.events)
    if (
      event.id >= first &&
      (event.sourceUnitId === undefined ||
        (event.type === 'buff' &&
          event.targetUnitId === target.id &&
          event.sourceUnitId === source.id))
    )
      Object.assign(event, provenance(source), {
        targetUnitId: target.id,
        cardId: target.cardId,
        text,
      });
}
function hit(
  ctx: BlockbusterContext,
  source: Unit,
  target: Unit,
  amount: number,
): number {
  return target.side === source.side
    ? ctx.selfDamage(source, target, amount)
    : ctx.damage(source, target, amount);
}
function choiceRequired(
  ability: keyof typeof BLOCKBUSTER_ABILITY_DESCRIPTIONS,
) {
  return ability === 'crowd-control'
    ? 'concert'
    : ability === 'best-two-of-three'
      ? 'wager'
      : ability === 'nothing-to-lose'
        ? 'investment'
        : undefined;
}
/** Pure preflight. The caller separately validates printed/base price and invests
 * extra Motion only after all command validation succeeds. */
export function blockbusterLegal(
  ctx: BlockbusterContext,
  ability: keyof typeof BLOCKBUSTER_ABILITY_DESCRIPTIONS,
  side: Side,
  lane: Lane,
  choice?: string,
): { valid: boolean; error?: string } {
  if (!Object.hasOwn(BLOCKBUSTER_ABILITY_DESCRIPTIONS, ability))
    return { valid: false, error: 'Unknown authored action' };
  const required = choiceRequired(ability);
  if (
    required &&
    !(BLOCKBUSTER_CHOICES[required] as readonly string[]).includes(choice ?? '')
  )
    return { valid: false, error: 'Choose an explicit legal action option' };
  if (!required && choice !== undefined)
    return { valid: false, error: 'This action has no choice option' };
  if (
    ability === 'trust-nobody' &&
    fighters(ctx, lane).filter((unit) => unit.side === side).length < 2
  )
    return {
      valid: false,
      error: 'The Setup needs two friendly fighters here',
    };
  if (
    ability === 'best-two-of-three' &&
    [side, other(side)].some(
      (seat) => ctx.state.players[seat].motion < Number(choice),
    )
  )
    return { valid: false, error: 'Both players must afford the wager' };
  return { valid: true };
}
/** Every actual reduction enters this one-pulse ledger before dead units leave.
 * The replay guard prevents an exponential chain of repeated Block Spins. */
export function recordBlockbusterReduction(
  ctx: BlockbusterContext,
  target: Unit,
  actual: number,
): void {
  if (!Number.isFinite(actual) || actual <= 0) return;
  const state = runtime(ctx),
    pulse = Math.floor(ctx.state.elapsedMs / BLOCKBUSTER_PULSE_MS);
  if (state.pulse !== pulse) {
    state.pulse = pulse;
    state.reductions = [];
  }
  if (!state.repeating)
    state.reductions.push({
      targetId: target.id,
      lane: target.lane,
      amount: actual,
    });
}
function destination(ctx: BlockbusterContext, unit: Unit): Lane | undefined {
  const score = (lane: Lane) =>
    fighters(ctx, lane)
      .filter((ally) => ally.side === unit.side)
      .reduce((sum, ally) => sum + ctx.power(ally), 0);
  return LANES.filter((lane) => ctx.openForMove(unit, lane)).sort(
    (a, b) => score(a) - score(b) || a - b,
  )[0];
}
function randomItem<T>(ctx: BlockbusterContext, items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[
    Math.min(
      items.length - 1,
      Math.floor(Math.max(0, ctx.random()) * items.length),
    )
  ];
}
export function resolveBlockbuster(
  ctx: BlockbusterContext,
  ability: BlockbusterAbility,
  source: Unit,
  choice?: string,
): boolean {
  if (!isBlockbusterAbility(ability)) return false;
  if (!blockbusterLegal(ctx, ability, source.side, source.lane, choice).valid)
    return false;
  const state = runtime(ctx),
    local = () => fighters(ctx, source.lane),
    allies = () => local().filter((unit) => unit.side === source.side),
    enemies = () => local().filter((unit) => unit.side !== source.side);
  if (ability === 'crossfire') {
    for (const target of enemies()) hit(ctx, source, target, 3);
    const friendly = strongest(ctx, allies());
    if (friendly) hit(ctx, source, friendly, 1);
  } else if (ability === 'run-it-back-twice') {
    const pulse = Math.floor(ctx.state.elapsedMs / BLOCKBUSTER_PULSE_MS);
    const history =
      state.pulse === pulse
        ? state.reductions
            .filter((hit) => hit.lane === source.lane)
            .map((hit) => ({ ...hit }))
        : [];
    state.repeating = true;
    try {
      for (let repeat = 0; repeat < 3; repeat++)
        for (const reduction of history) {
          const target = local().find((unit) => unit.id === reduction.targetId);
          if (target) hit(ctx, source, target, reduction.amount);
        }
    } finally {
      state.repeating = false;
    }
  } else if (ability === 'clear-the-intersection') {
    for (const target of local()) {
      const to = destination(ctx, target);
      if (
        to !== undefined &&
        ctx.move(target, to) &&
        target.side === source.side
      )
        gain(ctx, source, target, 2, 'SIDESHOW +2');
    }
  } else if (ability === 'crowd-control') {
    for (const target of local()) {
      if (choice === 'buff')
        gain(
          ctx,
          source,
          target,
          target.side === source.side ? 3 : 1,
          'CONCERT',
        );
      else hit(ctx, source, target, target.side === source.side ? 1 : 3);
    }
  } else if (ability === 'trust-nobody') {
    const sacrificed = weakest(ctx, allies())!;
    const recipient = strongest(
      ctx,
      allies().filter((unit) => unit.id !== sacrificed.id),
    )!;
    const inherited = sacrificed.hands + 4;
    ctx.sacrifice(source, sacrificed);
    gain(ctx, source, recipient, inherited, 'THE SETUP');
    ctx.protect(recipient);
  } else if (ability === 'best-two-of-three') {
    const wager = Number(choice),
      roll = () =>
        Array.from({ length: 3 }, () =>
          Math.min(6, 1 + Math.floor(Math.max(0, ctx.random()) * 6)),
        ),
      player = roll(),
      opponent = roll(),
      score = (rolls: number[]) =>
        [...rolls]
          .sort((a, b) => b - a)
          .slice(0, 2)
          .reduce((sum, die) => sum + die, 0),
      winner =
        score(player) === score(opponent)
          ? 'draw'
          : score(player) > score(opponent)
            ? 'player'
            : 'opponent';
    ctx.state.players.player.motion -= wager;
    ctx.state.players.opponent.motion -= wager;
    if (winner === 'draw') {
      ctx.state.players.player.motion += wager;
      ctx.state.players.opponent.motion += wager;
    } else {
      ctx.state.players[winner].motion = Math.min(
        9,
        ctx.state.players[winner].motion + wager * 2,
      );
      const target = weakest(
        ctx,
        local().filter((unit) => unit.side === winner),
      );
      if (target) gain(ctx, source, target, 3, 'DICE WIN +3');
    }
    state.dice = { wager, player, opponent, winner };
    ctx.event({
      type: 'dice',
      side: source.side,
      lane: source.lane,
      ...provenance(source),
      text: `${player.join(' / ')} · ${score(player)} : ${score(opponent)} · ${opponent.join(' / ')} · ${winner === 'draw' ? 'TIE · REFUND' : `${winner === 'player' ? 'YOU' : 'THE OPPS'} WIN`} · ${wager * 2} MOTION`,
    });
  } else if (ability === 'one-more-round') {
    if (!state.afterPartyUsed) {
      state.afterPartyUsed = true;
      if (ctx.state.elapsedMs >= ctx.state.durationMs - 30000)
        ctx.state.drawsLocked = true;
      ctx.state.durationMs += BLOCKBUSTER_PULSE_MS;
      for (const target of fighters(ctx).filter(
        (unit) => unit.side === source.side,
      ))
        gain(ctx, source, target, 2, 'AFTER PARTY +2');
      ctx.event({
        type: 'time-extension',
        side: source.side,
        ...provenance(source),
        amount: 10,
        text: '+10 SECONDS',
      });
    }
  } else if (ability === 'everybody-pull-up') {
    for (const target of fighters(ctx).filter(
      (unit) => unit.lane !== source.lane,
    ))
      if (ctx.move(target, source.lane) && target.side === source.side)
        gain(ctx, source, target, 2, 'KICKBACK +2');
  } else if (ability === 'hot-plate') {
    const occupied = LANES.filter((lane) =>
      fighters(ctx, lane).some((unit) => unit.side === source.side),
    );
    for (let meal = 0; meal < 3; meal++) {
      const lane = randomItem(ctx, occupied);
      if (lane === undefined) break;
      const recipient = weakest(
        ctx,
        fighters(ctx, lane).filter((unit) => unit.side === source.side),
      );
      if (recipient) {
        ctx.cleanse(recipient, source);
        gain(ctx, source, recipient, 2, 'SOUL FOOD +2');
      }
    }
    const lane = randomItem(ctx, occupied) ?? source.lane;
    state.plates.push({
      source: { ...source },
      lane,
      dueAt:
        (Math.floor(ctx.state.elapsedMs / BLOCKBUSTER_PULSE_MS) + 1) *
        BLOCKBUSTER_PULSE_MS,
    });
    ctx.event({
      type: 'burnt-plate',
      side: source.side,
      lane,
      ...provenance(source),
      text: 'BURNT PLATE · NEXT PULSE',
    });
  } else if (ability === 'new-blessings') {
    for (const target of allies())
      gain(ctx, source, target, 3, 'NEW BLESSINGS +3');
    ctx.draw(source.side, 2);
  }
  return true;
}
/** Caller has already paid the selected extra investment atomically. */
export function homelessInvestment(
  ctx: BlockbusterContext,
  unit: Unit,
  choice: string,
  deploymentCostAloneLeftZero: boolean,
): void {
  if (!(BLOCKBUSTER_CHOICES.investment as readonly string[]).includes(choice))
    throw new Error('Invalid investment choice');
  if (deploymentCostAloneLeftZero) {
    const target = strongest(
      ctx,
      fighters(ctx, unit.lane).filter((enemy) => enemy.side !== unit.side),
    );
    if (target) {
      const stolen = ctx.damage(unit, target, 2);
      if (stolen > 0) gain(ctx, unit, unit, stolen, 'NOTHING TO LOSE');
    }
  } else if (Number(choice) > 0)
    gain(ctx, unit, unit, Number(choice) + 1, 'INVESTED');
}
export function blockbusterTick(ctx: BlockbusterContext): void {
  const state = runtime(ctx),
    pulse = Math.floor(ctx.state.elapsedMs / BLOCKBUSTER_PULSE_MS);
  if (state.pulse !== pulse) {
    state.pulse = pulse;
    state.reductions = [];
  }
  const due = state.plates.filter(
    (plate) => plate.dueAt <= ctx.state.elapsedMs,
  );
  state.plates = state.plates.filter(
    (plate) => plate.dueAt > ctx.state.elapsedMs,
  );
  for (const plate of due) {
    const target = randomItem(
      ctx,
      fighters(ctx, plate.lane).filter(
        (unit) => unit.side === plate.source.side,
      ),
    );
    if (target) ctx.burn(plate.source, target, 1, true);
    ctx.event({
      type: 'burnt-plate-clear',
      side: plate.source.side,
      lane: plate.lane,
      ...provenance(plate.source),
      text: 'BURNT PLATE CLEARED',
    });
  }
}
