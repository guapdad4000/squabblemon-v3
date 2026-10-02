import { squabblehouseStaffCardIds } from './squabblehouseWave';

export const CONTINUOUS_POWER_DEPARTURES: unique symbol = Symbol('squabblemon.continuous-power-departures');

type ContinuousPowerCard = {
  readonly instanceId: string;
  readonly cardId: string;
  readonly owner: 'player' | 'cpu';
  readonly kind?: string;
  readonly hazard?: boolean;
  readonly basePower: number;
  readonly powerModifier: number;
  readonly copiedAbilityCardId?: string;
  readonly continuousPower?: number;
  readonly statuses: { readonly frozen: boolean; readonly silenced: boolean; readonly weakened: boolean };
};

type ContinuousPowerMatch<TCard extends ContinuousPowerCard> = {
  readonly boards: readonly (readonly TCard[])[];
  readonly timedEffects?: readonly { readonly targetInstanceId?: string }[];
  readonly [CONTINUOUS_POWER_DEPARTURES]?: readonly TCard[];
};

const isCharacter = (card: ContinuousPowerCard) =>
  !card.hazard && (card.kind ?? 'character') === 'character';

export const rawCombatPower = (card: ContinuousPowerCard): number =>
  card.hazard ? 0 : Math.max(0, card.basePower + card.powerModifier + (card.continuousPower ?? 0));

/** Reconciles the replay-safe Manager aura without touching unaffected card references. */
export function syncContinuousPower<TCard extends ContinuousPowerCard, TMatch extends ContinuousPowerMatch<TCard>>(
  match: TMatch,
): TMatch {
  let result = match;
  for (;;) {
    const cards = result.boards.flat();
    const managers = cards.filter(card => (card.copiedAbilityCardId ?? card.cardId) === 'squabble-house-manager' && isCharacter(card)
      && !card.statuses.frozen && !card.statuses.silenced && !card.statuses.weakened);
    if (!managers.length && !cards.some(card => card.continuousPower !== undefined)) return result;
    const counts = new Map<string, number>();
    for (const manager of managers) {
      const bonus = cards.filter(card => card.owner === manager.owner && card.instanceId !== manager.instanceId
        && isCharacter(card) && squabblehouseStaffCardIds.has(card.cardId)).length;
      if (bonus) counts.set(manager.instanceId, (counts.get(manager.instanceId) ?? 0) + bonus);
    }
    let changed = false;
    const expiredAuraDeaths: TCard[] = [];
    const boards = result.boards.map(lane => {
      let laneChanged = false;
      const next = lane.map(card => {
        const power = counts.get(card.instanceId);
        if (card.continuousPower === power) return card;
        laneChanged = true;
        changed = true;
        const updated = power === undefined
          ? (() => {
            const { continuousPower: _continuousPower, ...withoutContinuousPower } = card;
            return withoutContinuousPower as TCard;
          })()
          : { ...card, continuousPower: power };
        if ((card.continuousPower ?? 0) > (power ?? 0) && rawCombatPower(card) > 0
          && rawCombatPower(updated) === 0) expiredAuraDeaths.push(card);
        return updated;
      });
      return laneChanged ? next : lane;
    });
    if (!changed) return result;
    result = { ...result, boards } as TMatch;
    if (!expiredAuraDeaths.length) return result;
    const dead = new Set(expiredAuraDeaths.map(card => card.instanceId));
    result = {
      ...result,
      [CONTINUOUS_POWER_DEPARTURES]: [
        ...(result[CONTINUOUS_POWER_DEPARTURES] ?? []),
        ...expiredAuraDeaths,
      ],
      boards: result.boards.map(lane => {
        const remaining = lane.filter(card => !dead.has(card.instanceId));
        return remaining.length === lane.length ? lane : remaining;
      }),
      ...(result.timedEffects ? { timedEffects: result.timedEffects.filter(effect =>
        !effect.targetInstanceId || !dead.has(effect.targetInstanceId)) } : {}),
    } as TMatch;
  }
}