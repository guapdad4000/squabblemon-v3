import { isActiveOngoing } from './rosterBalance';
import type { CardInstance, Match, Lane, Owner } from "./gameEngine";
import type { AbilityUpgradeSnapshot } from "./abilityUpgrades";
import { snapshotUpgradesForCard } from "./abilityUpgrades";

export type LaneDamage = {
  round: number;
  lane: Lane;
  instanceId: string;
  amount: number;
};
export type DiceResult = {
  sequence: number;
  round: number;
  wager: number;
  player: number[];
  cpu: number[];
  winner: Owner | "draw";
};
export type BlockbusterTools = {
  modify: (
    m: Match,
    id: string,
    change: (c: CardInstance) => CardInstance,
  ) => Match;
  hit: (
    m: Match,
    source: CardInstance,
    target: CardInstance,
    amount: number,
    note: string,
  ) => Match;
  protect: (m: Match, source: CardInstance, id: string) => Match;
  enemyMove: (
    m: Match,
    source: CardInstance,
    target: CardInstance,
    to: Lane,
  ) => Match;
  reduce: (
    m: Match,
    target: CardInstance,
    amount: number,
    note: string,
  ) => Match;
  move: (m: Match, card: CardInstance, to: Lane, note: string) => Match;
  cleanse: (
    m: Match,
    id: string,
    change: (c: CardInstance) => CardInstance,
  ) => Match;
  status: (
    m: Match,
    source: CardInstance,
    target: CardInstance,
    status: "silenced" | "locked",
    note: string,
  ) => Match;
  burn: (m: Match, source: CardInstance, target: CardInstance) => Match;
  create: (
    id: string,
    owner: Owner,
    deck?: string,
    index?: number,
  ) => CardInstance;
  locked: (m: Match, owner: Owner) => Lane[];
  power: (card: CardInstance) => number;
  random: (seed: string, count: number) => number;
};
const lanes = [0, 1, 2] as const;
const fighters = (m: Match, lane?: Lane) =>
  (lane === undefined ? m.boards.flat() : m.boards[lane]).filter(
    (c) => !c.hazard && (c.kind ?? "character") === "character",
  );
const weakest = (cards: CardInstance[], t: BlockbusterTools) =>
  [...cards].sort(
    (a, b) =>
      t.power(a) - t.power(b) || a.instanceId.localeCompare(b.instanceId),
  )[0];
const strongest = (cards: CardInstance[], t: BlockbusterTools) =>
  [...cards].sort(
    (a, b) =>
      t.power(b) - t.power(a) || a.instanceId.localeCompare(b.instanceId),
  )[0];
const other = (owner: Owner): Owner => (owner === "player" ? "cpu" : "player");
const motion = (owner: Owner) =>
  owner === "player" ? "playerMotion" : "cpuMotion";
const clean = (c: CardInstance): CardInstance => ({
  ...c,
  statuses: {
    ...c.statuses,
    frozen: false,
    silenced: false,
    weakened: false,
    locked: false,
    burnStacks: 0,
  },
});
export function blockbusterExtraCost(cardId: string, choice = 0): number {
  return cardId === "the-dice-game"
    ? choice || 1
    : cardId === "the-concert"
      ? 0
      : choice;
}
export function resolveBlockbusterWave(
  match: Match,
  source: CardInstance,
  choice: number,
  t: BlockbusterTools,
): { match: Match; note: string; targets: string[] } {
  let m = match,
    succeeded = false;
  const l = source.lane!,
    owner = source.owner,
    rival = other(owner),
    targets = new Set<string>();
  const allies = () =>
    fighters(m, l).filter(
      (c) => c.owner === owner && c.instanceId !== source.instanceId,
    );
  const enemies = () => fighters(m, l).filter((c) => c.owner === rival);
  const buff = (card: CardInstance | undefined, amount: number) => {
    if (!card || !amount) return;
    targets.add(card.instanceId);
    m = t.modify(m, card.instanceId, (c) => ({
      ...c,
      powerModifier: c.powerModifier + amount,
      lastEffectNote: `${source.name}: +${amount} Hands.`,
    }));
    succeeded = true;
  };
  const hit = (card: CardInstance | undefined, amount: number) => {
    if (!card) return;
    targets.add(card.instanceId);
    const before = m;
    m =
      card.owner === owner
        ? t.reduce(m, card, amount, `${source.name}: -${amount} Hands.`)
        : t.hit(m, source, card, amount, `${source.name}: -${amount} Hands.`);
    succeeded ||= before.boards.flat().some((old) => {
      const current = m.boards
        .flat()
        .find((c) => c.instanceId === old.instanceId);
      return !current || current.powerModifier < old.powerModifier;
    });
  };
  const restore = (card: CardInstance | undefined, protect = false) => {
    if (!card) return;
    targets.add(card.instanceId);
    m = t.cleanse(m, card.instanceId, (c) => ({
      ...clean(c),
      statuses: {
        ...clean(c).statuses,
        protected: c.statuses.protected,
      },
      lastEffectNote: source.name + ": cleansed.",
    }));
    if (protect) m = t.protect(m, source, card.instanceId);
    succeeded = true;
  };
  const travel = (card: CardInstance, to: Lane) => {
    if (t.locked(m, card.owner).includes(to)) return;
    targets.add(card.instanceId);
    m = t.move(m, card, to, source.name + ": moved district.");
    succeeded ||=
      m.boards[to].some((c) => c.instanceId === card.instanceId) &&
      card.lane !== to;
  };
  const destination = (card: CardInstance) =>
    lanes
      .filter((to) => to !== card.lane && !t.locked(m, card.owner).includes(to))
      .sort(
        (a, b) =>
          fighters(m, a)
            .filter((c) => c.owner === card.owner)
            .reduce((n, c) => n + t.power(c), 0) -
            fighters(m, b)
              .filter((c) => c.owner === card.owner)
              .reduce((n, c) => n + t.power(c), 0) || a - b,
      )[0];
  const seed = `${source.instanceId}:${m.round}:${m.nextEventSequence}:${JSON.stringify(m.districtSnapshot)}`;
  let note = source.ability + " resolved.";
  switch (source.cardId) {
    case "miami-surgeon": {
      const c = weakest(allies(), t);
      restore(c);
      buff(c, 2);
      break;
    }
    case "roommate":
      if (allies().length) buff(source, 1);
      break;
    case "ahki":
      buff(weakest(allies(), t), 2);
      break;
    case "mr-trick": {
      const c = weakest(allies(), t),
        paid = c ? Math.min(2, m[motion(owner)]) : 0;
      m = { ...m, [motion(owner)]: m[motion(owner)] - paid };
      buff(c, paid);
      break;
    }
    case "dr-umah":
      for (const c of allies()) buff(c, 1);
      break;
    case "atl-scammer": {
      const taken = Math.min(1, m[motion(rival)]);
      m = {
        ...m,
        [motion(rival)]: m[motion(rival)] - taken,
        [motion(owner)]: Math.min(9, m[motion(owner)] + taken),
      };
      buff(source, taken);
      break;
    }
    case "hater":
      hit(strongest(enemies(), t), 1);
      break;
    case "teacher":
    case "rent-a-cop": {
      const c = (source.cardId === "teacher" ? strongest(enemies().filter(isActiveOngoing), t) : undefined) ?? strongest(enemies(), t);
      if (c) {
        targets.add(c.instanceId);
        m = t.status(
          m,
          source,
          c,
          source.cardId === "teacher" ? "silenced" : "locked",
          source.ability,
        );
        succeeded = true;
      }
      break;
    }
    case "tattoo-artist": {
      const c = weakest(allies(), t);
      buff(c, 2);
      if (c) m = t.protect(m, source, c.instanceId);
      break;
    }
    case "og-skater": {
      const to = destination(source);
      if (to !== undefined) {
        travel(source, to);
        if (m.boards[to].some((c) => c.instanceId === source.instanceId))
          buff(source, 2);
      }
      break;
    }
    case "inmate-kingpin":
      for (const c of allies()) buff(c, c.cardId.startsWith("inmate") ? 2 : 1);
      break;
    case "live-streamer-male":
      buff(source, Math.min(2, allies().filter((c) => c.cost <= 2).length));
      break;
    case "redneck":
      restore(weakest(allies(), t));
      break;
    case "redneck-evil": {
      const c = strongest(enemies(), t);
      if (c) {
        targets.add(c.instanceId);
        m = t.burn(m, source, c);
        succeeded = true;
      }
      break;
    }
    case "lawyer":
      restore(weakest(allies(), t), true);
      break;
    case "nigerian-father":
      for (const c of allies().filter((c) => t.power(c) <= 3)) buff(c, 2);
      break;
    case "bouncer": {
      const c = strongest(enemies().filter(isActiveOngoing), t) ?? strongest(enemies(), t);
      if (c) {
        const to = destination(c);
        if (to !== undefined) {
          targets.add(c.instanceId);
          m = t.enemyMove(m, source, c, to);
          succeeded = true;
        }
      }
      break;
    }
    case "the-shootout": {
      for (const target of enemies()) hit(target, 2);
      hit(strongest(allies(), t), 1);
      note = "Crossfire: 2 damage to every local enemy; 1 to your strongest local character.";
      break;
    }
    case "the-block-spin": {
      const history = (m.laneDamage ?? []).filter(
        (d) => d.round === m.round && d.lane === l,
      );
      m = { ...m, repeatingLaneDamage: true };
      for (let repeat = 0; repeat < 2; repeat++)
        for (const d of history) {
          const c = fighters(m, l).find((c) => c.instanceId === d.instanceId);
          if (c) hit(c, d.amount);
        }
      m = { ...m, repeatingLaneDamage: false };
      note = `Block Spin: replayed ${history.length} previous hits twice; departed or destroyed cards are skipped.`;
      break;
    }
    case "the-sideshow":
      for (const c of fighters(m, l)) {
        const to = destination(c);
        if (to !== undefined) travel(c, to);
      }
      break;
    case "the-concert":
      for (const c of fighters(m, l)) {
        if (choice === 1) hit(c, 1);
        else buff(c, 1);
      }
      note =
        choice === 1
          ? "Concert: -1 Hand to everyone in this lane."
          : "Concert: +1 Hand to everyone in this lane.";
      break;
    case "the-setup": {
      const crew = allies(),
        sacrifice = weakest(crew, t),
        recipient = strongest(
          crew.filter((c) => c.instanceId !== sacrifice?.instanceId),
          t,
        );
      if (sacrifice && recipient) {
        const amount = t.power(sacrifice) + 2;
        targets.add(sacrifice.instanceId);
        m = {
          ...m,
          boards: m.boards.map((cs) =>
            cs.filter((c) => c.instanceId !== sacrifice.instanceId),
          ) as Match["boards"],
          timedEffects: m.timedEffects.filter(
            (e) =>
              e.targetInstanceId !== sacrifice.instanceId ||
              e.amount === undefined,
          ),
        };
        buff(recipient, amount);
        note = `The Setup sacrificed ${sacrifice.name}; ${recipient.name} inherited ${amount} Hands.`;
      } else note = "The Setup needs two friendly characters in this lane.";
      break;
    }
    case "the-dice-game": {
      const wager = choice || 1,
        p = Array.from(
          { length: 3 },
          (_, i) => 1 + t.random(seed + ":player:" + i, 6),
        ),
        c = Array.from(
          { length: 3 },
          (_, i) => 1 + t.random(seed + ":cpu:" + i, 6),
        );
      const score = (roll: number[]) =>
        [...roll]
          .sort((a, b) => b - a)
          .slice(0, 2)
          .reduce((n, x) => n + x, 0);
      const winner =
        score(p) === score(c) ? "draw" : score(p) > score(c) ? "player" : "cpu";
      m = {
        ...m,
        playerMotion: m.playerMotion - wager,
        cpuMotion: m.cpuMotion - wager,
      };
      if (winner === "draw")
        m = {
          ...m,
          playerMotion: Math.min(9, m.playerMotion + wager),
          cpuMotion: Math.min(9, m.cpuMotion + wager),
        };
      else
        m = {
          ...m,
          [motion(winner)]: Math.min(9, m[motion(winner)] + wager * 2),
        };
      m = {
        ...m,
        diceResult: {
          sequence: m.nextEventSequence,
          round: m.round,
          wager,
          player: p,
          cpu: c,
          winner,
        },
      };
      note = `Dice Game: player [${p.join(", ")}] = ${score(p)}; rival [${c.join(", ")}] = ${score(c)}. ${winner === "draw" ? "Tie: wagers refunded." : winner + " wins the " + wager * 2 + "-Motion pot (cap 9)."}`;
      succeeded = true;
      break;
    }
    case "the-after-party":
      m = { ...m, afterParty: true };
      note = "After Party: this fight now ends after round 7. It cannot stack.";
      succeeded = true;
      break;
    case "the-kickback":
      for (const c of fighters(m).filter((c) => c.lane !== l)) travel(c, l);
      break;
    case "the-cookout": {
      const occupied = lanes.filter(lane => fighters(m, lane).some(c => c.owner === owner));
      for (let i = 0; i < 2 && occupied.length; i++) {
        const to = occupied[t.random(seed + ":food:" + i, occupied.length)];
        const food = {
          ...t.create("soulfood", owner, "cookout", m.nextEventSequence + i),
          instanceId: source.instanceId + ":food:" + i,
          lane: to,
          playedRound: m.round,
          arrivalOrder: m.nextArrivalOrder ?? 1,
        };
        m = {
          ...m,
          nextArrivalOrder: (m.nextArrivalOrder ?? 1) + 1,
          boards: m.boards.map((cs, index) =>
            index === to ? [...cs, food] : cs,
          ) as Match["boards"],
        };
        targets.add(food.instanceId);
        const recipient = weakest(
          fighters(m, to).filter((c) => c.owner === owner),
          t,
        );
        restore(recipient);
        buff(recipient, 1);
      }
      const to = occupied.length ? occupied[t.random(seed + ":burnt", occupied.length)] : l;
      const plate: CardInstance = {
        ...source,
        id: "the-cookout",
        cardId: "burnt-plate",
        instanceId: source.instanceId + ":burnt",
        name: "Burnt Plate",
        kind: "token",
        hazard: true,
        cost: 0,
        power: 0,
        basePower: 0,
        powerModifier: 0,
        lane: to,
        ability: "Still Smoking",
        effect:
          "At this round end, give a random friendly character here 1 Burn, then remove this plate.",
        abilityUpgrades: [],
        lastEffectNote: "Still Smoking: one Burn penalty, then cleared.",
      };
      m = {
        ...m,
        boards: m.boards.map((cs, index) =>
          index === to ? [...cs, plate] : cs,
        ) as Match["boards"],
      };
      targets.add(plate.instanceId);
      succeeded = true;
      note =
        "Cookout: meals delivered to occupied friendly districts; the Burnt Plate clears at round end.";
      break;
    }
    case "the-babyshower": {
      for (const c of allies()) buff(c, 1);
      const key = owner === "player" ? "playerHand" : "cpuHand",
        index = owner === "player" ? "playerDrawIndex" : "cpuDrawIndex";
      const ids = owner === "player" ? m.playerCardIds : m.cpuCardIds;
      if (ids[m[index]]) {
        m = {
          ...m,
          [key]: [
            ...m[key],
            t.create(
              ids[m[index]],
              owner,
              owner === "player" ? m.playerDeck : m.cpuDeck,
              m[index],
            ),
          ],
          [index]: m[index] + 1,
        };
        succeeded = true;
      }
      break;
    }
  }
  if (succeeded) {
    const upgrades = snapshotUpgradesForCard(
      m.abilityUpgradeSnapshot as AbilityUpgradeSnapshot,
      owner,
      source.cardId,
    );
    for (const upgrade of upgrades)
      buff(
        weakest(
          fighters(m, l).filter((c) => c.owner === owner),
          t,
        ),
        upgrade.effect.amount,
      );
  }
  return {
    match: m,
    note: succeeded ? note : note + " No eligible effect resolved.",
    targets: [...targets],
  };
}
