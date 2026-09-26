import type { Card } from "./data";
import type {
  Match,
  CardInstance,
  Lane,
  Owner,
  Statuses,
  CharacterDistrictMark,
} from "./gameEngine";

/** Stable collection/upgrade IDs; this registry replaces printed kits, never ownership. */
export const CREATIVE_KITS: Record<string, readonly [string, string]> = {
  "hair-stylist": [
    "Blowout",
    "On Reveal: Cleanse your weakest other ally here and give it +1 Hand. If cleansed, its next successful move grants another +1 Hand, once.",
  ],
  crossingguard: [
    "Safe Crossing",
    "On Reveal: Protect your weakest unprotected other ally here. Give it one Safe Crossing: its next successful move ignores movement Lock. Capacity and district restrictions still apply.",
  ],
  bustdown: [
    "Wrist Check",
    "On Reveal: Protect your weakest friendly character here. If this ward blocks a hostile ability, its wearer gains +2 Hands once. Other shields do not cash this watch.",
  ],
  boombox: [
    "Turn It Up",
    "On Reveal: Give every friendly character here +1 Hand. Leave one Encore through next round: the next friendly movement arrival here gains +1 Hand.",
  ],

  "yn-atv-lord": [
    "Hop On",
    "On Reveal: Move with your weakest other ally here to your weakest other district with two spaces. Both must be movable. Protect your passenger after arrival.",
  ],
  "mr-trick": [
    "Open Tab",
    "On Reveal: Open a Tab through next round. The next other friendly character played here becomes your guest. Its first successful enemy hit or new harmful status earns a Tip; cash it at round end for +2 Hands to the guest. One Tab per side.",
  ],
  "dr-umah": [
    "Group Project",
    "On Reveal: Start a Group Project through next round. Your next two different-element allies to resolve successful entrances gain +1 Hand each. When both contribute, each gains another +2 Hands. One project per side.",
  ],
  hooper: [
    "Ankle Breaker",
    "On Reveal: Challenge the strongest enemy here through next round. If it leaves this district, gain +3 Hands. Otherwise, at the end of next round, hit it for 3 and gain +1 Hand. One challenge per Hooper.",
  ],
  failedathlete: [
    "One Last Shot",
    "Ongoing: Once per match, gain +4 Hands and Protection when this district changes from tied or winning to losing. If deployed while losing, a later enemy arrival here while still losing can also trigger the comeback.",
  ],
  partytitan: [
    "Everybody Outside",
    "On Reveal: Bring the weakest movable ally from each other district here, if there is space. Gain +1 Hand for each ally that arrives, up to +2.",
  ],
  chessregular: [
    "Fork",
    "On Reveal: Mark the strongest enemy in each of two different districts through next round. The next enemy character placement saves marks in that district; give each remaining marked enemy -2 Hands. One Fork per side.",
  ],
  dmvworker: [
    "Take a Number",
    "On Reveal: Post one queue ticket here through next round. The next enemy character entrance here waits until round end, then resolves if that character is still active. One ticket per district per side; no repeat delay.",
  ],
  "tattoo-artist": [
    "Permanent Ink",
    "On Reveal: Tattoo your weakest uninked other ally here and give it +1 Hand. Its next successful move grants Protection and +1 Hand. Each character can receive this tattoo only once per match.",
  ],
  stud: [
    "Hold You Down",
    "On Reveal: Bond to your weakest other ally here. Once per match while together, intercept its next targeted hostile ability, then move the surviving pair to your weakest other district with two spaces. Protect your partner if both escape.",
  ],
  stonersr: [
    "Pass It Around",
    "On Reveal: Cleanse your weakest afflicted ally here and leave a token through next round. Your next other character arriving here gains +2 Hands. If you cleansed an ally, pass a smaller +1 token once to a different arrival.",
  ],
  laundry: [
    "Spin Cycle",
    "On Reveal: Cleanse your weakest other ally here and give it +1 Hand. Its next successful move cleanses it again, once.",
  ],
  "black-cowboy": [
    "Wanted",
    "On Reveal: Lasso the weakest enemy from another district here if there is room. If it arrives, mark it Wanted through next round. If your side destroys it, gain +3 Hands.",
  ],
  "lebron-james": [
    "Definitely Not Him",
    "A fictional regular guy. On Reveal: Cleanse and Protect your weakest other ally here. Once per match, when that Protection blocks an enemy ability, hit its source for 3.",
  ],
  "juneteenth-chair-guy": [
    "Fold-Out Justice",
    "Ongoing: Once per match, after an enemy damages another ally here or its Protection blocks an enemy ability, hit the attacker for 3 and give your weakest surviving other ally here Protection.",
  ],
  baby: [
    "Mama Bear",
    "On Reveal: Name your weakest other ally here as family. Once, follow its successful move if there is room. Once per match when an enemy damages it, hit the attacker for 2; if family was destroyed, also gain +2 Hands.",
  ],
  techbro: [
    "Burn Rate",
    "On Reveal: Borrow up to 2 Motion, up to the cap. At round end repay unspent borrowed Motion; any remainder reduces your next round starting Motion. Once per match.",
  ],
  failedrapper: [
    "One More Verse",
    "On Reveal: Leave a Verse here through next round. The next different friendly character played here gains +2 Hands after its entrance. One Verse per district per side.",
  ],
  busker: [
    "Pass the Hat",
    "Ongoing: Two different other allies moving here earn two Tips for +3 Hands to your weakest other ally here. At most one payout per round; the same character cannot tip twice toward one payout.",
  ],
  dancecaptain: [
    "Follow My Lead",
    "Ongoing: Once per round, the first friendly dancer move sets a destination. The next different friendly dancer arriving there gains +2 Hands. Dancers: Break, Bboy, Dance Circle Captain.",
  ],
  break: [
    "Floor Sweep",
    "On Reveal: Move your weakest other ally here to your weakest other open district. If it moves, leave a floor mark here through next round: Weaken the next enemy character entering. One mark per district per side.",
  ],
  bboy: [
    "Windmill",
    "On Reveal: Move through your weakest other occupied friendly district, then to the remaining district if open. Gain +1 Hand per successful move, up to +2.",
  ],
  "yn-gokarter": [
    "Lap Record",
    "On Reveal: Move to your weakest other open district. Ongoing: After visiting all three districts, gain +3 Hands once per match.",
  ],
  "og-skater": [
    "Still Got It",
    "On Reveal: Move to your weakest other open district. Leave a route at your origin through next round. The next friendly character played there follows you to the destination if movable and there is room. One route per origin per side.",
  ],
  divorceddad: [
    "My Weekend",
    "On Reveal: Bring your weakest movable ally costing 2 or less from another district here if there is room; Protect it. At the end of next round, try to return it to its original district. One visit per side.",
  ],
  bblnice: [
    "Good Company",
    "On Reveal: Pair your two weakest other allies anywhere through next round. Once per round, the first positive Hands gain on one shares up to 2 Hands with the other. Shared gains cannot repeat.",
  ],
  bbldemon: [
    "Problem Energy",
    "On Reveal: Mark the strongest enemy district with Drama through next round. Their next character played there gets -2 Hands; if played elsewhere, BBL Demon gains +2 Hands. One Drama per side.",
  ],
  barber: [
    "Line Up",
    "On Reveal: Trim up to 2 bonus Hands from the enemy here with the most bonus Hands. Give the amount actually trimmed to your weakest other ally here. If no enemy has bonus Hands, give that ally +1 Hand.",
  ],
  cornercoach: [
    "Run It Back",
    "On Reveal: Coach your weakest eligible ally here through next round. After its entrance fails, later other friendly character placements retry it until one succeeds. At most one successful retry; copying, summoning, refunds, choices and reworked entrances are excluded.",
  ],
  midnightmayor: [
    "Keys to the City",
    "On Reveal: Nominate your weakest other district through next round. The next friendly move there opens a one-use local 1-Motion character discount, minimum 1, and leaves a key: the next different friendly arrival there gets Protection. One nomination per side.",
  ],
  hater: [
    "Must Be Nice",
    "Ongoing: Once per round, after an enemy here gains bonus Hands, remove up to 1 of that new bonus and gain +1 Hand if any was removed. Cannot remove base Hands.",
  ],
  "atl-scammer": [
    "Pending Transfer",
    "On Reveal: File a claim through next round. Divert up to 1 Motion from the next enemy refund. If unused, at expiry open a one-use local 1-Motion character discount here through next round, minimum 1. Theft or fallback, never both.",
  ],
  lawyer: [
    "Objection",
    "On Reveal: Cleanse your weakest other ally here and give it an Appeal through next round. Its next harmful status waits until round end; moving or cleansing the client dismisses it and earns one local 1-Motion character discount at the client, minimum 1.",
  ],
  "rent-a-cop": [
    "Mall Rules",
    "On Reveal: Post a warning here through next round. The next enemy character that moves into or out of this district gets -2 Hands after moving. One warning per district per side.",
  ],
  "redneck-evil": [
    "Chain Reaction",
    "On Reveal: Apply 2 Burn to the strongest enemy here and prime it through next round. Its next Burn damage splashes 2 damage to the weakest other enemy here. One primer per target; splash cannot repeat.",
  ],
  "nigerian-father": [
    "High Expectations",
    "On Reveal: Tutor your weakest other ally here with 3 or fewer Hands for +1 Hand. If it gains another net +2 Hands by the end of next round, it gains Protection and +2 Hands. One goal per side.",
  ],
  "inmate-kingpin": [
    "Run the Yard",
    "On Reveal: Give Contraband and +1 Hand to your weakest other Inmate anywhere. Later Inmate deployments or moves pass it on; each of the first three distinct carriers gains +1 Hand. After three carriers, each survivor gains another +1. Once per Kingpin per match.",
  ],
  mural: [
    "Fresh Color",
    "On Reveal: Paint this district with your element through next round. The next other friendly character of a different element entering here gains +2 Hands. One paint per district per side.",
  ],
  nightcashier: [
    "Closing Time",
    "On Reveal: On round 4 or later, issue a Receipt here through next round. Your next other character costing 2 or less played here earns an immediate one-use local 1-Motion character discount, minimum 1. In the final round, that customer gains +2 Hands instead.",
  ],
  ahki: [
    "The Usual",
    "On Reveal: Remember your weakest other ally here and give it +1 Hand. Its next return to this district gains +2 Hands, once.",
  ],
  firstaid: [
    "Emergency Kit",
    "On Reveal: Cleanse your weakest afflicted character here, or your weakest character if none is afflicted. Store one emergency kit: prevent up to 2 Hands of its next enemy damage before lethal resolution. One kit per target.",
  ],
  honestthot: [
    "Meet Me There",
    "On Reveal: Name your weakest other district. Through next round, your next Air character entering there gains +2 Hands. One welcome per side.",
  ],
  abuela: [
    "Eat Something",
    "On Reveal: Restore up to 3 Hands actually lost to damage to your weakest injured ally anywhere and Protect it. If nobody is injured, Protect your weakest other ally here and pack one lunch: heal up to 2 Hands of its first later enemy damage if it survives.",
  ],
  icecream: [
    "Neighborhood Route",
    "On Reveal: Leave a Treat here. Ongoing: The first time you visit each district, leave one Treat. The next other friendly character arriving there gains +2 Hands. One Treat per district per side; each district once per truck.",
  ],
  torta: [
    "Hold Our Ground",
    "On Reveal: Pair yourself with your weakest other Earth ally here. At next round end, if both remain here and you are not losing this district, each gains +2 Hands. One pair per side.",
  ],
  concrete: [
    "Set in Stone",
    "On Reveal: Anchor your weakest other Earth ally here through next round. Its next hostile forced move is blocked and it gains +2 Hands. If unused at expiry, it gains +1 Hand instead. One anchor per ally.",
  ],
  gardener: [
    "Rooftop Harvest",
    "On Reveal: Plant a Seed here. At the end of next round, your weakest Plant ally here gains +3 Hands. One plot per district per side.",
  ],
  incel: [
    "Leave Me Alone",
    "Ongoing: At round end, if you are the only friendly character here, gain +2 Hands, at most twice per match.",
  ],
  circuitcaptain: [
    "Everybody on the Clock",
    "On Reveal: Post two jobs through next round. Your next two different Electric allies played or moved each gain +1 Hand. When both take a job, each gains another +2 Hands and restore 1 Motion once. One job pair per side.",
  ],
  canopykeeper: [
    "Show Up Then",
    "On Reveal: Promise to help your weakest other ally here. Through next round, if another card gives it Hands, cleanses it, or heals enemy damage, it gains +2 Hands and you gain +1 Hand, once.",
  ],
  slipstream: [
    "Boarding Pass",
    "On Reveal: Give your weakest other Air ally here a Boarding Pass through next round. Its next successful move gives it +2 Hands and Protection, once.",
  ],
};
export const REPLACED_BONDS = new Set([
  "honestthot",
  "abuela",
  "icecream",
  "torta",
  "concrete",
  "gardener",
  "incel",
  "circuitcaptain",
  "canopykeeper",
  "slipstream",
]);
export function applyCreativeCardKits(cards: Record<string, Card>): void {
  for (const [id, [ability, effect]] of Object.entries(CREATIVE_KITS)) {
    const card = cards[id];
    if (!card) throw new Error("Missing rework card: " + id);
    Object.assign(card, { ability, effect });
    if (REPLACED_BONDS.has(id)) delete cards[id].elementalBond;
    card.abilityUpgrades = card.abilityUpgrades.map((upgrade, index) => ({
      ...upgrade,
      name: ability + " " + ["Practice", "Confidence", "Mastery"][index],
      description:
        "Once per match, after a successful setup or payoff: " +
        (upgrade.effect.kind === "self-power"
          ? "gain +1 Hand."
          : upgrade.effect.amount < 0
            ? "target the weakest enemy here for -1 Hand; Protection and immunity apply."
            : "give your weakest other ally here +1 Hand."),
    }));
  }
}

export type CreativeMark = {
  id: string;
  kind: string;
  source: CardInstance;
  owner: Owner;
  lane: Lane;
  targets: string[];
  expires: number;
  amount?: number;
  origin?: Lane;
  seen?: string[];
  elements?: string[];
  usedRound?: number;
  pending?: Partial<Statuses>;
  attacker?: CardInstance;
  ready?: boolean;
};
export type CreativeTools = {
  power(c: CardInstance): number;
  modify(m: Match, id: string, fn: (c: CardInstance) => CardInstance): Match;
  protect(m: Match, source: CardInstance, id: string): Match;
  hit(
    m: Match,
    source: CardInstance,
    target: CardInstance,
    amount: number,
    note: string,
  ): Match;
  status(
    m: Match,
    source: CardInstance,
    target: CardInstance,
    key: "weakened" | "silenced" | "locked",
    note: string,
  ): Match;
  burn(
    m: Match,
    source: CardInstance,
    target: CardInstance,
    amount: number,
    note: string,
  ): Match;
  cleanse(m: Match, id: string): Match;
  move(m: Match, target: CardInstance, destination: Lane, note: string): Match;
  movePair(
    m: Match,
    first: CardInstance,
    second: CardInstance,
    destination: Lane,
    note: string,
  ): Match;
  enemyMove(
    m: Match,
    source: CardInstance,
    target: CardInstance,
    destination: Lane,
  ): Match;
  canMove(m: Match, target: CardInstance, destination: Lane): boolean;
  score(m: Match, owner: Owner, lane: Lane): number;
  reveal(m: Match, source: CardInstance): Match;
  train(m: Match, id: string): Match;
  refund(m: Match, owner: Owner, amount: number): Match;
  roundLimit(m: Match): number;
  trim(
    m: Match,
    source: CardInstance,
    target: CardInstance,
    amount: number,
  ): Match;
  disruption(
    before: Match,
    after: Match,
    source: CardInstance,
    id: string,
  ): Match;
  event(
    before: Match,
    after: Match,
    source: CardInstance,
    targets: string[],
    note: string,
  ): Match;
};
const lanes: Lane[] = [0, 1, 2];
const element = (c: CardInstance) => (c.type === "Rock" ? "Earth" : c.type);
const identity = (c: CardInstance) => c.copiedAbilityCardId ?? c.cardId;
const rival = (o: Owner): Owner => (o === "player" ? "cpu" : "player");
const board = (m: Match) =>
  m.boards
    .flat()
    .filter((c) => !c.hazard && (c.kind ?? "character") === "character");
const card = (m: Match, id: string) =>
  board(m).find((c) => c.instanceId === id);
const active = (c?: CardInstance) =>
  !!c && !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened;
const allies = (m: Match, s: CardInstance, local = true) =>
  board(m).filter(
    (c) =>
      c.owner === s.owner &&
      c.instanceId !== s.instanceId &&
      (!local || c.lane === s.lane),
  );
const enemies = (m: Match, s: CardInstance, local = true) =>
  board(m).filter((c) => c.owner !== s.owner && (!local || c.lane === s.lane));
const sorted = (cs: CardInstance[], t: CreativeTools, high = false) =>
  [...cs].sort(
    (a, b) =>
      (high ? -1 : 1) * (t.power(a) - t.power(b)) ||
      a.instanceId.localeCompare(b.instanceId),
  );
const marks = (m: Match) =>
  (m.creativeMarks ?? []).filter((x) => x.expires >= m.round);
const remove = (m: Match, id: string): Match => ({
  ...m,
  creativeMarks: (m.creativeMarks ?? []).filter((x) => x.id !== id),
});
const update = (m: Match, id: string, patch: Partial<CreativeMark>): Match => ({
  ...m,
  creativeMarks: (m.creativeMarks ?? []).map((x) =>
    x.id === id ? { ...x, ...patch } : x,
  ),
});
const buff = (m: Match, id: string, n: number, t: CreativeTools) =>
  t.modify(m, id, (c) => ({ ...c, powerModifier: c.powerModifier + n }));
const once = (m: Match, s: CardInstance, key: string, t: CreativeTools) =>
  t.modify(m, s.instanceId, (c) => ({
    ...c,
    creativeUsed: { ...c.creativeUsed, [key]: true },
  }));
const afflicted = (c: CardInstance) =>
  c.statuses.frozen ||
  c.statuses.silenced ||
  c.statuses.weakened ||
  c.statuses.locked ||
  c.statuses.burnStacks > 0;
const open = (m: Match, s: CardInstance, t: CreativeTools, spaces = 1) =>
  lanes
    .filter(
      (l) =>
        t.canMove(m, s, l) &&
        m.boards[l].filter((c) => c.owner === s.owner).length <= 4 - spaces,
    )
    .sort((a, b) => t.score(m, s.owner, a) - t.score(m, s.owner, b) || a - b);
function mark(
  m: Match,
  s: CardInstance,
  kind: string,
  targets: string[] = [],
  lane = s.lane!,
  extra: Partial<CreativeMark> = {},
  scope: "side" | "lane" | "target" | "source" = "side",
): Match {
  const same = (x: CreativeMark) =>
    x.kind === kind &&
    x.owner === s.owner &&
    (scope === "side" ||
      (scope === "lane" && x.lane === lane) ||
      (scope === "target" && x.targets[0] === targets[0]) ||
      (scope === "source" && x.source.instanceId === s.instanceId));
  return {
    ...m,
    creativeMarks: [
      ...(m.creativeMarks ?? []).filter((x) => !same(x)),
      {
        id: `${kind}:${s.instanceId}:${m.nextEventSequence}:${lane}`,
        kind,
        source: s,
        owner: s.owner,
        lane,
        targets,
        expires: m.round + 1,
        ...extra,
      },
    ],
  };
}
function discount(
  m: Match,
  s: CardInstance,
  lane: Lane,
  start = m.round,
): Match {
  const order = m.nextDiscountOrder;
  return {
    ...m,
    nextDiscountOrder: order + 1,
    discountTokens: [
      ...m.discountTokens.filter(
        (x) =>
          !(
            x.eligibility === "creative-local" &&
            x.owner === s.owner &&
            x.targetLane === lane
          ),
      ),
      {
        id: `creative:${s.instanceId}:${order}`,
        owner: s.owner,
        sourceInstanceId: s.instanceId,
        sourceLane: s.lane,
        targetLane: lane,
        eligibility: "creative-local",
        createdOrder: order,
        startsAtRound: start,
        expiresAfterRound: start + 1,
      },
    ],
  };
}
export function creativeDistrictMarks(m: Match): CharacterDistrictMark[] {
  const labels: Record<string, string> = {
    key: "next different friendly arrival: Protection",
    crossing: "next move ignores Lock",
    watch: "this ward breaks: +2",
    encore: "next friendly movement arrival: +1",
    lunch: "next enemy damage: heal up to 2 if alive",
    blowout: "next move: +1",
    "follow-family": "follow family once if space allows",
    tab: "next guest: hit or harmful status earns a Tip",
    project: "two different elements must contribute",
    jobs: "two different Electric workers",
    duel: "leave: +3 to Hooper; stay: take 3 at expiry",
    fork: "next enemy placement saves that district; other marks take 2",
    queue: "next enemy entrance waits until round end",
    delayed: "entrance queued for round end",
    ink: "next move grants Protection and +1",
    bond: "one interception and paired escape",
    chill: "next other friendly arrival: +2",
    cycle: "next move cleanses",
    bounty: "owner defeat earns +3",
    revenge: "shield break: hit attacker for 3",
    family: "first damage provokes retaliation",
    loan: "borrowed Motion; repayment due",
    debt: "next round Motion repayment",
    verse: "next different character played here: +2",
    floor: "next enemy entering is Weakened",
    route: "next friendly placement follows the route",
    visit: "return home at expiry if space allows",
    company: "share first positive gain each round, up to 2",
    drama: "enemy plays here: -2; elsewhere: Demon +2",
    coach: "failed entrance can be retried once",
    nomination: "next friendly move here opens a local discount",
    claim: "divert next enemy refund, up to 1",
    appeal: "delay next harmful status",
    warning: "next enemy move through here: -2",
    primer: "next Burn damage splashes 2",
    goal: "reach the tutored goal: Protection and +2",
    stash: "three distinct Inmates: +2 each",
    paint: "next different friendly element entering: +2",
    receipt: "next cheap play: immediate discount; final round +2",
    loyalty: "leave and return: +2",
    kit: "next enemy damage: prevent up to 2",
    welcome: "next Air arrival: +2",
    treat: "next other friendly arrival: +2",
    ground: "hold this district together: +2 each",
    anchor: "block one forced move: +2",
    seed: "at expiry: weakest Plant here +3",
    promise: "help this ally to fulfill the promise",
    boarding: "next move: +2 and Protection",
  };
  const visible = marks(m).map((x) => ({
    owner: x.owner,
    lane: x.lane,
    text: `${x.source.ability} · ${x.kind === "pending-appeal" ? "pending " + Object.keys(x.pending ?? {}).join(", ") : x.kind === "goal" ? `reach ${x.amount ?? 5} Hands: Protection and +2` : (labels[x.kind] ?? x.kind)}${["project", "jobs", "stash"].includes(x.kind) ? " · " + (x.seen?.length ?? 0) + "/" + (x.kind === "stash" ? 3 : 2) : ""}${x.kind === "tab" && x.amount ? " · Tip earned" : ""}${x.targets.length ? ": " + x.targets.map((id) => card(m, id)?.name ?? "departed target").join(", ") : ""}${x.ready ? " · ready" : ""}${x.expires === 99 ? " · until used" : " · through R" + x.expires}`,
  }));
  for (const c of board(m)) {
    const id = identity(c);
    const text =
      id === "failedathlete" && !c.creativeUsed?.comeback
        ? "comeback ready: +4 and Protection when district falls behind"
        : id === "juneteenth-chair-guy" && !c.creativeUsed?.chair
          ? "retaliation ready: hit attacker for 3"
          : id === "yn-gokarter" && !c.creativeUsed?.lap
            ? "districts visited " + (c.creativeVisits?.length ?? 1) + "/3"
            : id === "busker"
              ? "Tips " + (c.creativeCount ?? 0) + "/2"
              : id === "incel"
                ? "isolation rewards " + (c.creativeCount ?? 0) + "/2"
                : id === "dancecaptain" && c.creativeRound === m.round
                  ? "follow district " +
                    ((c.creativeLane ?? 0) + 1) +
                    (c.creativeCount === 1
                      ? " · spent this round"
                      : " · encore ready")
                  : undefined;
    if (text)
      visible.push({
        owner: c.owner,
        lane: c.lane!,
        text: c.ability + " · " + text + (!active(c) ? " · disabled" : ""),
      });
  }
  return visible;
}

/** Returns null only for a card outside this wave. Echoes cannot re-arm persistent contracts. */
export function creativeReveal(
  m: Match,
  s: CardInstance,
  t: CreativeTools,
  echoed = false,
): Match | null {
  if (!CREATIVE_KITS[s.cardId]) return null;
  if (
    !active(s) ||
    (echoed &&
      !["barber", "abuela", "partytitan", "bboy", "yn-atv-lord"].includes(
        s.cardId,
      ))
  )
    return m;
  const before = m,
    id = s.cardId,
    a = sorted(allies(m, s), t),
    all = sorted(allies(m, s, false), t),
    e = sorted(enemies(m, s), t, true),
    l = s.lane!;
  const put = (
    kind: string,
    ts: CardInstance[] = [],
    lane = l,
    extra: Partial<CreativeMark> = {},
    scope: "side" | "lane" | "target" | "source" = "side",
  ) => {
    m = mark(
      m,
      s,
      kind,
      ts.map((c) => c.instanceId),
      lane,
      extra,
      scope,
    );
  };
  const give = (c: CardInstance | undefined, n: number) => {
    if (c) m = buff(m, c.instanceId, n, t);
  };
  const clean = (c: CardInstance | undefined) => {
    if (c) m = t.cleanse(m, c.instanceId);
  };
  const cover = (c: CardInstance | undefined) => {
    if (c) m = t.protect(m, s, c.instanceId);
  };
  const travel = (c: CardInstance, destination: Lane | undefined) => {
    if (
      destination === undefined ||
      !t.canMove(m, c, destination) ||
      m.boards[destination].filter((x) => x.owner === c.owner).length >= 4
    )
      return false;
    m = t.move(m, c, destination, s.ability);
    return card(m, c.instanceId)?.lane === destination;
  };
  switch (id) {
    case "yn-atv-lord": {
      const passenger = a[0];
      const to =
        passenger && open(m, s, t, 2).find((x) => t.canMove(m, passenger, x));
      if (to !== undefined && passenger) {
        // Capacity and movement locks are checked for both before either departs.
        m = t.movePair(m, s, passenger, to, s.ability);
        if (card(m, passenger.instanceId)?.lane === to) cover(passenger);
      }
      break;
    }
    case "mr-trick":
      put("tab", [], l, { amount: 0 });
      break;
    case "dr-umah":
      put("project", [], l, { seen: [], elements: [] });
      break;
    case "hooper":
      if (e[0]) put("duel", [e[0]], l, {}, "source");
      break;
    case "failedathlete":
      m = t.modify(m, s.instanceId, (c) => ({
        ...c,
        creativeAhead: t.score(m, s.owner, l) >= t.score(m, rival(s.owner), l),
        creativeUsed: {
          ...c.creativeUsed,
          losingStart: t.score(m, s.owner, l) < t.score(m, rival(s.owner), l),
        },
      }));
      break;
    case "partytitan":
      for (const lane of lanes.filter((x) => x !== l)) {
        const target = sorted(
          all.filter((c) => c.lane === lane && t.canMove(m, c, l)),
          t,
        )[0];
        if (target && travel(target, l)) give(card(m, s.instanceId), 1);
      }
      break;
    case "chessregular": {
      const targets = lanes
        .map(
          (x) =>
            sorted(
              enemies(m, s, false).filter((c) => c.lane === x),
              t,
              true,
            )[0],
        )
        .filter((c): c is CardInstance => !!c)
        .slice(0, 2);
      if (targets.length === 2) put("fork", targets);
      break;
    }
    case "dmvworker":
      put("queue", [], l, {}, "lane");
      break;
    case "tattoo-artist": {
      const target = a.find((c) => !c.creativeUsed?.ink);
      if (target) {
        give(target, 1);
        m = once(m, target, "ink", t);
        put("ink", [target], l, { expires: 99 }, "target");
      }
      break;
    }
    case "stud":
      if (a[0] && !s.creativeUsed?.intercept)
        put("bond", [a[0]], l, { expires: 99 }, "source");
      break;
    case "stonersr": {
      const target = a.find(afflicted);
      if (target) clean(target);
      put(
        "chill",
        [],
        l,
        { amount: 2, ready: !!target, seen: [s.instanceId] },
        "lane",
      );
      break;
    }
    case "hair-stylist": {
      const target = a[0];
      if (target) {
        const didClean = afflicted(target);
        clean(target);
        give(card(m, target.instanceId), 1);
        if (didClean) put("blowout", [target], l, { expires: 99 }, "target");
      }
      break;
    }
    case "crossingguard": {
      const target = a.find((c) => !c.statuses.protected);
      if (target) {
        cover(target);
        put("crossing", [target], l, { expires: 99 }, "target");
      }
      break;
    }
    case "bustdown": {
      const target = a[0];
      if (target && !target.statuses.protected) {
        cover(target);
        put("watch", [target], l, { expires: 99 }, "target");
      }
      break;
    }
    case "boombox":
      for (const target of a) give(target, 1);
      put("encore", [], l, {}, "lane");
      break;
    case "laundry":
      if (a[0]) {
        clean(a[0]);
        give(a[0], 1);
        put("cycle", [a[0]], l, { expires: 99 }, "target");
      }
      break;
    case "black-cowboy": {
      const target = sorted(
        enemies(m, s, false).filter((c) => c.lane !== l),
        t,
      )[0];
      if (target && m.boards[l].filter((c) => c.owner !== s.owner).length < 4) {
        m = t.enemyMove(m, s, target, l);
        if (card(m, target.instanceId)?.lane === l)
          put("bounty", [target], l, {}, "source");
      }
      break;
    }
    case "lebron-james":
      if (a[0]) {
        clean(a[0]);
        cover(a[0]);
        if (!s.creativeUsed?.revenge)
          put("revenge", [a[0]], l, { expires: 99 }, "source");
      }
      break;
    case "juneteenth-chair-guy":
      break;
    case "baby":
      if (a[0] && !s.creativeUsed?.family) {
        put("family", [a[0]], l, { expires: 99 }, "source");
        if (!s.creativeUsed?.followFamily)
          put("follow-family", [a[0]], l, { expires: 99 }, "source");
      }
      break;
    case "techbro":
      if (!s.creativeUsed?.loan) {
        const key = s.owner === "player" ? "playerMotion" : "cpuMotion",
          amount = Math.min(2, 9 - m[key]);
        m = once(m, s, "loan", t);
        m = { ...m, [key]: m[key] + amount };
        put("loan", [], l, { amount, expires: m.round + 1 }, "source");
      }
      break;
    case "failedrapper":
      put("verse", [], l, {}, "lane");
      break;
    case "busker":
    case "dancecaptain":
      break;
    case "break": {
      const target = a[0];
      if (target && travel(target, open(m, target, t)[0]))
        put("floor", [], l, {}, "lane");
      break;
    }
    case "bboy": {
      const to = open(m, s, t).find((x) => all.some((c) => c.lane === x));
      if (travel(s, to)) {
        give(card(m, s.instanceId), 1);
        const next = card(m, s.instanceId);
        if (
          next &&
          travel(
            next,
            lanes.find((x) => x !== l && x !== to),
          )
        )
          give(card(m, s.instanceId), 1);
      }
      break;
    }
    case "yn-gokarter":
      m = t.modify(m, s.instanceId, (c) => ({
        ...c,
        creativeVisits: [...new Set([...(c.creativeVisits ?? []), l])],
      }));
      travel(card(m, s.instanceId)!, open(m, s, t)[0]);
      break;
    case "og-skater": {
      const to = open(m, s, t)[0];
      if (travel(s, to)) put("route", [], l, { origin: to }, "lane");
      break;
    }
    case "divorceddad": {
      const target = all.find(
        (c) => c.lane !== l && c.cost <= 2 && t.canMove(m, c, l),
      );
      if (target && travel(target, l)) {
        cover(target);
        put("visit", [target], l, { origin: target.lane! });
      }
      break;
    }
    case "bblnice":
      if (all.length >= 2) put("company", all.slice(0, 2));
      break;
    case "bbldemon": {
      const lane = [...lanes].sort(
        (x, y) =>
          t.score(m, rival(s.owner), y) - t.score(m, rival(s.owner), x) ||
          x - y,
      )[0];
      put("drama", [], lane);
      break;
    }
    case "barber": {
      const target = [...e].sort(
        (a, b) =>
          b.powerModifier - a.powerModifier ||
          a.instanceId.localeCompare(b.instanceId),
      )[0];
      if (target && target.powerModifier > 0) {
        const old = target.powerModifier;
        m = t.trim(m, s, target, Math.min(2, old));
        const now = card(m, target.instanceId);
        give(a[0], Math.min(2, Math.max(0, old - (now?.powerModifier ?? 0))));
      } else give(a[0], 1);
      break;
    }
    case "cornercoach": {
      const trainee = a.find((c) => COACH_SAFE.has(c.cardId));
      if (trainee) {
        const ready = trainee.creativeEntranceSucceeded === false;
        put("coach", [trainee], l, { ready });
      }
      break;
    }
    case "midnightmayor":
      put(
        "nomination",
        [],
        [...lanes]
          .filter((x) => x !== l)
          .sort(
            (x, y) => t.score(m, s.owner, x) - t.score(m, s.owner, y) || x - y,
          )[0],
      );
      break;
    case "hater":
      break;
    case "atl-scammer":
      put("claim");
      break;
    case "lawyer":
      if (a[0]) {
        clean(a[0]);
        put("appeal", [a[0]], l, {}, "target");
      }
      break;
    case "rent-a-cop":
      put("warning", [], l, {}, "lane");
      break;
    case "redneck-evil":
      if (e[0]) {
        m = t.burn(m, s, e[0], 2, s.ability);
        if (
          (card(m, e[0].instanceId)?.statuses.burnStacks ?? 0) >
          e[0].statuses.burnStacks
        )
          put("primer", [e[0]], l, {}, "target");
      }
      break;
    case "nigerian-father": {
      const target = a.find((c) => t.power(c) <= 3);
      if (target) {
        give(target, 1);
        put("goal", [target], l, {
          amount: t.power(card(m, target.instanceId)!) + 2,
        });
      }
      break;
    }
    case "inmate-kingpin": {
      const target = all.find((c) => c.cardId.startsWith("inmate-"));
      if (target && !s.creativeUsed?.stash) {
        m = once(m, s, "stash", t);
        give(target, 1);
        put(
          "stash",
          [target],
          l,
          { seen: [target.instanceId], expires: 99 },
          "source",
        );
      }
      break;
    }
    case "mural":
      put("paint", [], l, {}, "lane");
      break;
    case "nightcashier":
      if (m.round >= 4) put("receipt", [], l, {}, "lane");
      break;
    case "ahki":
      if (a[0]) {
        give(a[0], 1);
        put("loyalty", [a[0]], l, { expires: 99, ready: false }, "target");
      }
      break;
    case "firstaid": {
      const target = a.find(afflicted) ?? a[0];
      if (target) {
        clean(target);
        put("kit", [target], l, { expires: 99 }, "target");
      }
      break;
    }
    case "honestthot":
      put(
        "welcome",
        [],
        [...lanes]
          .filter((x) => x !== l)
          .sort(
            (x, y) => t.score(m, s.owner, x) - t.score(m, s.owner, y) || x - y,
          )[0],
      );
      break;
    case "abuela": {
      const target = all.find((c) => (c.recoverableDamage ?? 0) > 0) ?? a[0];
      if (target) {
        const heal = Math.min(3, target.recoverableDamage ?? 0);
        if (heal)
          m = t.modify(m, target.instanceId, (c) => ({
            ...c,
            powerModifier: c.powerModifier + heal,
            recoverableDamage: Math.max(0, (c.recoverableDamage ?? 0) - heal),
          }));
        cover(target);
        if (!heal) put("lunch", [target], l, { expires: 99 }, "target");
      }
      break;
    }
    case "icecream":
      if (!s.creativeVisits?.includes(l)) {
        m = t.modify(m, s.instanceId, (c) => ({
          ...c,
          creativeVisits: [...new Set([...(c.creativeVisits ?? []), l])],
        }));
        put("treat", [], l, { expires: 99 }, "lane");
      }
      break;
    case "torta": {
      const p = [s, ...a.filter((c) => element(c) === "Earth").slice(0, 1)];
      if (p.length === 2) put("ground", p);
      break;
    }
    case "concrete": {
      const target = a.find((c) => element(c) === "Earth");
      if (target) put("anchor", [target], l, {}, "target");
      break;
    }
    case "gardener":
      put("seed", [], l, {}, "lane");
      break;
    case "incel":
      break;
    case "circuitcaptain":
      put("jobs", [], l, { seen: [] });
      break;
    case "canopykeeper":
      if (a[0]) put("promise", [a[0]]);
      break;
    case "slipstream": {
      const target = a.find((c) => c.type === "Air");
      if (target) put("boarding", [target], l, {}, "target");
      break;
    }
  }
  const succeeded =
    JSON.stringify(
      before.boards.map((cs) =>
        cs.map((c) => [c.instanceId, c.lane, c.powerModifier, c.statuses]),
      ),
    ) !==
      JSON.stringify(
        m.boards.map((cs) =>
          cs.map((c) => [c.instanceId, c.lane, c.powerModifier, c.statuses]),
        ),
      ) ||
    before.playerMotion !== m.playerMotion ||
    before.cpuMotion !== m.cpuMotion ||
    JSON.stringify(before.creativeMarks ?? []) !==
      JSON.stringify(m.creativeMarks ?? []);
  if (succeeded && !echoed) m = t.train(m, s.instanceId);
  m = t.modify(m, s.instanceId, (c) => ({
    ...c,
    lastEffectNote:
      s.ability + (succeeded ? ": resolved." : ": no eligible setup."),
  }));
  return t.event(
    before,
    m,
    s,
    [],
    s.ability + (succeeded ? ": resolved." : ": no eligible setup."),
  );
}

function arrival(
  m: Match,
  entrant: CardInstance,
  t: CreativeTools,
  moved: boolean,
  origin?: Lane,
): Match {
  for (const x of marks(m)) {
    if (!marks(m).some((current) => current.id === x.id)) continue;
    if (!marks(m).some((y) => y.id === x.id)) continue;
    const friendly = entrant.owner === x.owner,
      here = entrant.lane === x.lane;
    const eligible = entrant.instanceId !== x.source.instanceId;
    const before = m;
    if (
      friendly &&
      here &&
      eligible &&
      ((x.kind === "chill" && !(x.seen ?? []).includes(entrant.instanceId)) ||
        x.kind === "treat" ||
        (x.kind === "paint" && entrant.type !== x.source.type) ||
        (x.kind === "welcome" && entrant.type === "Air"))
    ) {
      m = remove(m, x.id);
      m = buff(
        m,
        entrant.instanceId,
        x.kind === "chill" ? (x.amount ?? 2) : 2,
        t,
      );
      if (x.kind === "chill" && x.ready)
        m = mark(
          m,
          x.source,
          "chill",
          [],
          x.lane,
          {
            amount: 1,
            seen: [...(x.seen ?? []), entrant.instanceId],
            expires: x.expires,
          },
          "lane",
        );
    } else if (!friendly && here && x.kind === "floor") {
      m = remove(m, x.id);
      const current = card(m, entrant.instanceId);
      if (current)
        m = t.status(m, x.source, current, "weakened", "Floor Sweep");
    } else if (
      !friendly &&
      moved &&
      x.kind === "warning" &&
      (here || origin === x.lane)
    ) {
      m = remove(m, x.id);
      const current = card(m, entrant.instanceId);
      if (current) m = t.hit(m, x.source, current, -2, "Mall Rules");
    } else if (
      friendly &&
      eligible &&
      !moved &&
      here &&
      x.kind === "tab" &&
      !x.targets.length &&
      entrant.instanceId !== x.source.instanceId
    ) {
      m = update(m, x.id, { targets: [entrant.instanceId] });
    } else if (
      friendly &&
      here &&
      x.kind === "key" &&
      !x.targets.includes(entrant.instanceId)
    ) {
      m = remove(m, x.id);
      m = t.protect(m, x.source, entrant.instanceId);
    } else if (friendly && moved && here && x.kind === "encore") {
      m = remove(m, x.id);
      m = buff(m, entrant.instanceId, 1, t);
    } else if (friendly && moved && here && x.kind === "nomination") {
      m = remove(m, x.id);
      m = discount(m, x.source, x.lane);
      m = mark(m, x.source, "key", [entrant.instanceId], x.lane, {}, "lane");
    } else if (friendly && eligible && !moved && here && x.kind === "route") {
      m = remove(m, x.id);
      const current = card(m, entrant.instanceId);
      if (
        current &&
        x.origin !== undefined &&
        open(m, current, t).includes(x.origin)
      )
        m = t.move(m, current, x.origin, "Still Got It: follow the route");
    } else if (
      friendly &&
      eligible &&
      x.kind === "stash" &&
      entrant.cardId.startsWith("inmate-")
    ) {
      const isNew = !(x.seen ?? []).includes(entrant.instanceId);
      const seen = [...new Set([...(x.seen ?? []), entrant.instanceId])];
      if (isNew && seen.length <= 3) m = buff(m, entrant.instanceId, 1, t);
      m = update(m, x.id, { targets: [entrant.instanceId], seen });
      if (seen.length >= 3) {
        m = remove(m, x.id);
        for (const id of seen.slice(0, 3)) m = buff(m, id, 1, t);
      }
    } else if (
      friendly &&
      eligible &&
      x.kind === "jobs" &&
      entrant.type === "Electric" &&
      !x.targets.includes(entrant.instanceId) &&
      x.targets.length < 2
    ) {
      const assigned = { ...x, targets: [...x.targets, entrant.instanceId] };
      m = update(m, x.id, { targets: assigned.targets });
      m = buff(m, entrant.instanceId, 1, t);
      m = contribute(m, assigned, entrant.instanceId, t);
    }
    if (m !== before)
      m = t.event(
        before,
        m,
        x.source,
        [entrant.instanceId],
        x.source.ability + ": arrival resolved.",
      );
  }
  return m;
}
function contribute(
  m: Match,
  x: CreativeMark,
  id: string,
  t: CreativeTools,
): Match {
  const seen = [...new Set([...(x.seen ?? []), id])];
  m = update(m, x.id, { seen });
  if (
    x.targets.length === 2 &&
    x.targets.every((target) => seen.includes(target))
  ) {
    m = remove(m, x.id);
    for (const target of x.targets) m = buff(m, target, 2, t);
    if (x.kind === "jobs") m = t.refund(m, x.owner, 1);
  }
  return m;
}
export function creativeMoved(
  before: Match,
  m: Match,
  id: string,
  t: CreativeTools,
): Match {
  const old = card(before, id),
    current = card(m, id);
  if (!old || !current || old.lane === current.lane) return m;
  for (const x of marks(m)) {
    if (!marks(m).some((current) => current.id === x.id)) continue;
    const start = m;
    if (
      x.targets.includes(id) &&
      [
        "ink",
        "cycle",
        "boarding",
        "loyalty",
        "duel",
        "appeal",
        "pending-appeal",
        "blowout",
        "crossing",
      ].includes(x.kind)
    ) {
      if (x.kind === "loyalty") {
        if (current.lane !== x.lane) m = update(m, x.id, { ready: true });
        else if (x.ready) {
          m = remove(m, x.id);
          m = buff(m, id, 2, t);
        }
      } else if (x.kind === "duel") {
        if (active(card(m, x.source.instanceId))) {
          m = remove(m, x.id);
          m = buff(m, x.source.instanceId, 3, t);
        }
      } else {
        m = remove(m, x.id);
        if (x.kind === "pending-appeal")
          m = discount(m, x.source, current.lane!);
        if (x.kind === "ink" || x.kind === "blowout") m = buff(m, id, 1, t);
        if (x.kind === "ink" || x.kind === "boarding")
          m = t.protect(m, x.source, id);
        if (x.kind === "boarding") m = buff(m, id, 2, t);
        if (x.kind === "cycle") m = t.cleanse(m, id);
      }
    }
    if (start !== m)
      m = t.event(
        start,
        m,
        x.source,
        [id],
        x.source.ability + ": movement payoff.",
      );
  }
  if (active(current) && identity(current) === "yn-gokarter") {
    const visited = [
      ...new Set([...(current.creativeVisits ?? []), old.lane!, current.lane!]),
    ];
    m = t.modify(m, id, (c) => ({ ...c, creativeVisits: visited }));
    if (visited.length === 3 && !current.creativeUsed?.lap) {
      m = once(m, current, "lap", t);
      m = buff(m, id, 3, t);
    }
  }
  if (
    active(current) &&
    identity(current) === "icecream" &&
    !current.creativeVisits?.includes(current.lane!)
  ) {
    m = t.modify(m, id, (c) => ({
      ...c,
      creativeVisits: [...(c.creativeVisits ?? []), current.lane!],
    }));
    m = mark(m, current, "treat", [], current.lane!, { expires: 99 }, "lane");
  }
  for (const watcher of board(m).filter(
    (c) => c.owner === current.owner && c.instanceId !== id && active(c),
  )) {
    const start = m;
    if (
      identity(watcher) === "busker" &&
      watcher.lane === current.lane &&
      watcher.creativeRound !== m.round &&
      !(watcher.creativeTipIds ?? []).includes(id)
    ) {
      const tips = (watcher.creativeCount ?? 0) + 1;
      m = t.modify(m, watcher.instanceId, (c) => ({
        ...c,
        creativeRound: tips >= 2 ? m.round : c.creativeRound,
        creativeTipIds: tips >= 2 ? [] : [...(c.creativeTipIds ?? []), id],
        creativeCount: tips % 2,
      }));
      if (tips >= 2) {
        const target = sorted(allies(m, watcher), t)[0];
        if (target) m = buff(m, target.instanceId, 3, t);
      }
    }
    if (
      identity(watcher) === "dancecaptain" &&
      ["break", "bboy", "dancecaptain"].includes(current.cardId)
    ) {
      if (watcher.creativeRound !== m.round)
        m = t.modify(m, watcher.instanceId, (c) => ({
          ...c,
          creativeRound: m.round,
          creativeTarget: id,
          creativeLane: current.lane!,
          creativeCount: 0,
        }));
      else if (
        watcher.creativeTarget !== id &&
        watcher.creativeLane === current.lane &&
        watcher.creativeCount !== 1
      ) {
        m = t.modify(m, watcher.instanceId, (c) => ({
          ...c,
          creativeCount: 1,
        }));
        m = buff(m, id, 2, t);
      }
    }
    if (m !== start) {
      m = t.train(m, watcher.instanceId);
      m = t.event(
        start,
        m,
        watcher,
        [id],
        watcher.ability + ": movement reaction.",
      );
    }
  }
  for (const x of marks(m).filter(
    (x) => x.kind === "follow-family" && x.targets.includes(id),
  )) {
    const mother = card(m, x.source.instanceId);
    if (
      active(mother) &&
      mother!.lane !== current.lane &&
      open(m, mother!, t).includes(current.lane!)
    ) {
      m = remove(m, x.id);
      m = once(m, mother!, "followFamily", t);
      m = t.move(m, mother!, current.lane!, "Mama Bear: followed family");
    }
  }
  return arrival(m, card(m, id) ?? current, t, true, old.lane!);
}
/** Before an entrance: consume tickets first, so replay/echo cannot delay twice. */
export function creativeBeforeEntrance(
  m: Match,
  entrant: CardInstance,
  t: CreativeTools,
): { match: Match; delayed: boolean } {
  m = arrival(m, entrant, t, false);
  const q = marks(m).find(
    (x) =>
      x.kind === "queue" &&
      x.owner !== entrant.owner &&
      x.lane === entrant.lane,
  );
  if (
    !q ||
    !active(card(m, entrant.instanceId)) ||
    !entrant.effect.includes("On Reveal:")
  )
    return { match: m, delayed: false };
  const before = m;
  m = remove(m, q.id);
  m = mark(
    m,
    q.source,
    "delayed",
    [entrant.instanceId],
    entrant.lane!,
    { expires: m.round },
    "target",
  );
  return {
    match: t.event(
      before,
      m,
      q.source,
      [entrant.instanceId],
      "Take a Number: entrance queued until round end.",
    ),
    delayed: true,
  };
}
const COACH_SAFE = new Set([
  "edgar",
  "nguyen",
  "manman",
  "transplant",
  "bodegacat",
  "dogwalker",
  "sportsprodigy",
  "homelessyn",
  "dragonflyjones",
  "og",
]);
export function creativeAfterPlay(
  before: Match,
  m: Match,
  id: string,
  t: CreativeTools,
  placement?: CardInstance,
): Match {
  const entrant = placement ?? card(m, id);
  if (
    !entrant ||
    entrant.hazard ||
    (entrant.kind ?? "character") !== "character"
  )
    return creativeAfterAction(before, m, t);

  for (const x of marks(m)) {
    if (!marks(m).some((current) => current.id === x.id)) continue;
    const start = m,
      friendly = x.owner === entrant.owner,
      here = x.lane === entrant.lane;
    if (!friendly && ["fork", "drama"].includes(x.kind)) {
      m = remove(m, x.id);
      if (x.kind === "fork")
        for (const targetId of x.targets) {
          const target = card(m, targetId);
          if (target && target.lane !== entrant.lane)
            m = t.hit(m, x.source, target, -2, "Fork");
        }
      else if (here) m = t.hit(m, x.source, entrant, -2, "Problem Energy");
      else if (active(card(m, x.source.instanceId)))
        m = buff(m, x.source.instanceId, 2, t);
    } else if (friendly && x.source.instanceId !== id) {
      if (here && x.kind === "verse") {
        m = remove(m, x.id);
        m = buff(m, id, 2, t);
      }
      if (here && x.kind === "receipt" && entrant.cost <= 2) {
        m = remove(m, x.id);
        m =
          m.round >= t.roundLimit(m)
            ? buff(m, id, 2, t)
            : discount(m, x.source, x.lane);
      }

      if (x.kind === "coach") {
        if (
          x.ready &&
          marks(before).some(
            (previous) => previous.id === x.id && previous.ready,
          ) &&
          !x.targets.includes(id)
        ) {
          const trainee = card(m, x.targets[0]);
          if (trainee && active(trainee) && COACH_SAFE.has(trainee.cardId)) {
            m = remove(m, x.id);
            m = t.reveal(m, trainee);
            if (
              card(m, trainee.instanceId)?.creativeEntranceSucceeded === false
            )
              m = { ...m, creativeMarks: [...(m.creativeMarks ?? []), x] };
          }
        }
      }
    }
    if (m !== start)
      m = t.event(
        start,
        m,
        x.source,
        [id],
        x.source.ability + ": placement resolved.",
      );
  }
  for (const athlete of board(m).filter(
    (c) =>
      identity(c) === "failedathlete" &&
      active(c) &&
      c.owner !== entrant.owner &&
      c.lane === entrant.lane &&
      c.creativeUsed?.losingStart &&
      !c.creativeUsed?.comeback,
  )) {
    if (
      t.score(m, athlete.owner, athlete.lane!) <
      t.score(m, entrant.owner, athlete.lane!)
    ) {
      m = once(m, athlete, "comeback", t);
      m = buff(m, athlete.instanceId, 4, t);
      m = t.protect(m, athlete, athlete.instanceId);
      m = t.train(m, athlete.instanceId);
    }
  }
  return creativeAfterAction(before, m, t);
}
export function creativeAfterAction(
  before: Match,
  m: Match,
  t: CreativeTools,
): Match {
  // Snapshot external gains before sharing: generated gains cannot recurse.
  const gains = board(m)
    .map((c) => ({ c, old: card(before, c.instanceId) }))
    .filter((x) => x.old);
  for (const x of marks(m)) {
    if (!marks(m).some((current) => current.id === x.id)) continue;
    const start = m;
    if (x.kind === "company" && x.usedRound !== m.round) {
      const gain = gains.find(
        ({ c, old }) =>
          x.targets.includes(c.instanceId) &&
          c.powerModifier > old!.powerModifier,
      );
      if (gain) {
        m = update(m, x.id, { usedRound: m.round });
        const partner = x.targets.find((id) => id !== gain.c.instanceId)!;
        m = buff(
          m,
          partner,
          Math.min(2, gain.c.powerModifier - gain.old!.powerModifier),
          t,
        );
      }
    }
    if (x.kind === "promise") {
      const old = card(before, x.targets[0]),
        now = card(m, x.targets[0]);
      if (
        old &&
        now &&
        ((afflicted(old) && !afflicted(now)) ||
          (now.recoverableDamage ?? 0) < (old.recoverableDamage ?? 0) ||
          now.powerModifier > old.powerModifier)
      ) {
        m = remove(m, x.id);
        m = buff(m, now.instanceId, 2, t);
        m = buff(m, x.source.instanceId, 1, t);
      }
    }
    if (m !== start)
      m = t.event(
        start,
        m,
        x.source,
        x.targets,
        x.source.ability + ": promise fulfilled.",
      );
  }
  for (const watcher of board(m).filter((c) => active(c))) {
    const start = m;
    if (
      identity(watcher) === "failedathlete" &&
      !watcher.creativeUsed?.comeback
    ) {
      const ahead =
        t.score(m, watcher.owner, watcher.lane!) >=
        t.score(m, rival(watcher.owner), watcher.lane!);
      if (watcher.creativeAhead && !ahead) {
        m = once(m, watcher, "comeback", t);
        m = buff(m, watcher.instanceId, 4, t);
        m = t.protect(m, watcher, watcher.instanceId);
      }
      if (watcher.creativeAhead !== ahead)
        m = t.modify(m, watcher.instanceId, (c) => ({
          ...c,
          creativeAhead: ahead,
        }));
    }
    if (identity(watcher) === "hater" && watcher.creativeRound !== m.round) {
      const gain = gains.find(
        ({ c, old }) =>
          c.owner !== watcher.owner &&
          c.lane === watcher.lane &&
          c.powerModifier > Math.max(0, old!.powerModifier),
      );
      if (gain) {
        m = t.modify(m, watcher.instanceId, (c) => ({
          ...c,
          creativeRound: m.round,
        }));
        const target = card(m, gain.c.instanceId);
        if (target) {
          const old = target.powerModifier;
          m = t.trim(m, watcher, target, 1);
          if ((card(m, target.instanceId)?.powerModifier ?? old) < old)
            m = buff(m, watcher.instanceId, 1, t);
        }
      }
    }
    if (m !== start) {
      if (
        (card(m, watcher.instanceId)?.powerModifier ?? watcher.powerModifier) >
        watcher.powerModifier
      )
        m = t.train(m, watcher.instanceId);
      m = t.event(
        start,
        m,
        watcher,
        [watcher.instanceId],
        watcher.ability + ": board reaction.",
      );
    }
  }
  return m;
}

export function creativeDamage(
  before: Match,
  m: Match,
  source: Pick<CardInstance, "instanceId" | "owner">,
  victim: CardInstance,
  t: CreativeTools,
  burn = false,
): Match {
  const surviving = card(m, victim.instanceId),
    lost = Math.max(0, t.power(victim) - (surviving ? t.power(surviving) : 0));
  if (source.owner === victim.owner || !lost) return m;
  for (const x of marks(m)) {
    if (!marks(m).some((current) => current.id === x.id)) continue;
    const start = m,
      targeted = x.targets.includes(victim.instanceId),
      live = card(m, x.source.instanceId);
    if (
      x.kind === "tab" &&
      x.targets.includes(source.instanceId) &&
      x.amount !== 1
    )
      m = update(m, x.id, { amount: 1 });
    if (x.kind === "lunch" && targeted && surviving) {
      m = remove(m, x.id);
      const heal = Math.min(2, lost, surviving.recoverableDamage ?? lost);
      m = t.modify(m, surviving.instanceId, (c) => ({
        ...c,
        powerModifier: c.powerModifier + heal,
        recoverableDamage: Math.max(0, (c.recoverableDamage ?? 0) - heal),
      }));
    }
    if (
      x.kind === "bounty" &&
      targeted &&
      !surviving &&
      x.owner === source.owner
    ) {
      m = remove(m, x.id);
      if (active(live)) m = buff(m, x.source.instanceId, 3, t);
    }
    if (
      x.kind === "family" &&
      targeted &&
      active(live) &&
      !live!.creativeUsed?.family
    ) {
      m = remove(m, x.id);
      m = once(m, live!, "family", t);
      const attacker = card(m, source.instanceId);
      if (attacker) m = t.hit(m, live!, attacker, -2, "Mama Bear");
      if (!surviving) m = buff(m, live!.instanceId, 2, t);
    }
    if (x.kind === "primer" && targeted && burn) {
      m = remove(m, x.id);
      const target = sorted(
        board(m).filter(
          (c) =>
            c.owner === victim.owner &&
            c.lane === victim.lane &&
            c.instanceId !== victim.instanceId,
        ),
        t,
      )[0];
      if (target) m = t.hit(m, x.source, target, -2, "Chain Reaction: splash");
    }
    if (m !== start)
      m = t.event(
        start,
        m,
        x.source,
        [victim.instanceId],
        x.source.ability + ": damage reaction.",
      );
  }
  return chairReaction(m, source, victim, t);
}
function chairReaction(
  m: Match,
  source: Pick<CardInstance, "instanceId" | "owner">,
  victim: CardInstance,
  t: CreativeTools,
): Match {
  if (source.owner === victim.owner) return m;
  for (const chair of board(m).filter(
    (c) =>
      identity(c) === "juneteenth-chair-guy" &&
      c.owner === victim.owner &&
      c.instanceId !== victim.instanceId &&
      c.lane === victim.lane &&
      active(c) &&
      !c.creativeUsed?.chair,
  )) {
    const start = m;
    m = once(m, chair, "chair", t);
    const attacker = card(m, source.instanceId);
    if (attacker) m = t.hit(m, chair, attacker, -3, "Fold-Out Justice");
    const target = sorted(allies(m, chair), t)[0];
    if (target) m = t.protect(m, chair, target.instanceId);
    m = t.train(m, chair.instanceId);
    m = t.event(
      start,
      m,
      chair,
      [victim.instanceId],
      "Fold-Out Justice: retaliated and passed the chair.",
    );
  }
  return m;
}
export function creativeShieldBroken(
  m: Match,
  attacker: CardInstance,
  target: CardInstance,
  t: CreativeTools,
  wardSourceId?: string,
): Match {
  // A district guard can provoke Chair, but did not consume the target's own ward.
  if (wardSourceId === undefined) return chairReaction(m, attacker, target, t);
  for (const watch of marks(m).filter(
    (x) =>
      x.kind === "watch" &&
      x.targets.includes(target.instanceId) &&
      x.source.instanceId === wardSourceId,
  )) {
    m = remove(m, watch.id);
    m = buff(m, target.instanceId, 2, t);
  }
  m = chairReaction(m, attacker, target, t);
  const x = marks(m).find(
    (x) =>
      x.kind === "revenge" &&
      x.targets.includes(target.instanceId) &&
      active(card(m, x.source.instanceId)),
  );
  if (!x) return m;
  const start = m;
  m = remove(m, x.id);
  m = once(m, x.source, "revenge", t);
  const enemy = card(m, attacker.instanceId);
  if (enemy) m = t.hit(m, x.source, enemy, -3, "Definitely Not Him");
  return t.event(
    start,
    m,
    x.source,
    [attacker.instanceId],
    "Definitely Not Him: teammate shield broke; revenge.",
  );
}
export function creativeIntercept(
  m: Match,
  target: CardInstance,
  t: CreativeTools,
): { match: Match; interceptor?: CardInstance } {
  const x = marks(m).find(
    (x) =>
      x.kind === "bond" &&
      x.targets.includes(target.instanceId) &&
      active(card(m, x.source.instanceId)) &&
      card(m, x.source.instanceId)?.lane === target.lane &&
      !card(m, x.source.instanceId)?.creativeUsed?.intercept,
  );
  if (!x) return { match: m };
  const stud = card(m, x.source.instanceId)!;
  m = remove(m, x.id);
  m = once(m, stud, "intercept", t);
  m = mark(
    m,
    stud,
    "escape",
    [target.instanceId],
    target.lane!,
    { expires: m.round },
    "source",
  );
  return { match: m, interceptor: card(m, stud.instanceId) };
}
export function creativeFinishIntercept(
  m: Match,
  stud: CardInstance,
  t: CreativeTools,
): Match {
  const x = marks(m).find(
    (x) => x.kind === "escape" && x.source.instanceId === stud.instanceId,
  );
  if (!x) return m;
  const start = m;
  m = remove(m, x.id);
  const self = card(m, stud.instanceId),
    ally = card(m, x.targets[0]);
  if (self && ally) {
    const to = open(m, self, t, 2).find((l) => t.canMove(m, ally, l));
    if (to !== undefined) {
      m = t.movePair(m, self, ally, to, "Hold You Down");
      if (
        card(m, self.instanceId)?.lane === to &&
        card(m, ally.instanceId)?.lane === to
      )
        m = t.protect(m, self, ally.instanceId);
    }
  }
  return t.event(
    start,
    m,
    stud,
    x.targets,
    "Hold You Down: intercepted; surviving pair tried to escape.",
  );
}
export function creativeAnchor(
  m: Match,
  target: CardInstance,
  t: CreativeTools,
): Match | null {
  const x = marks(m).find(
    (x) => x.kind === "anchor" && x.targets.includes(target.instanceId),
  );
  if (!x) return null;
  const before = m;
  m = remove(m, x.id);
  m = buff(m, target.instanceId, 2, t);
  return t.event(
    before,
    m,
    x.source,
    [target.instanceId],
    "Set in Stone: blocked forced movement; +2 Hands.",
  );
}
export function creativeAppeal(
  before: Match,
  attempted: Match,
  target: CardInstance,
  attacker: CardInstance,
  t: CreativeTools,
): Match | null {
  const x = marks(before).find(
    (x) => x.kind === "appeal" && x.targets.includes(target.instanceId),
  );
  const after = card(attempted, target.instanceId);
  if (!x || !after) return null;
  const pending: Partial<Statuses> = {};
  for (const key of ["frozen", "silenced", "weakened", "locked"] as const)
    if (after.statuses[key] && !target.statuses[key]) pending[key] = true;
  if (after.statuses.burnStacks > target.statuses.burnStacks)
    pending.burnStacks = after.statuses.burnStacks - target.statuses.burnStacks;
  if (!Object.keys(pending).length) return null;
  let m = remove(attempted, x.id);
  m = {
    ...m,
    leaderRounds: before.leaderRounds ?? {},
    pendingLeaderReactions: before.pendingLeaderReactions ?? [],
  };
  m = t.modify(m, target.instanceId, (c) => ({
    ...c,
    statuses: {
      ...c.statuses,
      ...Object.fromEntries(
        Object.keys(pending).map((k) => [
          k,
          target.statuses[k as keyof Statuses],
        ]),
      ),
    },
  }));
  m = mark(
    m,
    x.source,
    "pending-appeal",
    [target.instanceId],
    target.lane!,
    { pending, attacker, expires: m.round },
    "target",
  );
  return t.event(
    before,
    m,
    x.source,
    [target.instanceId],
    "Objection: harmful status pending until round end. Move or cleanse to dismiss.",
  );
}
export function creativeCleansed(m: Match, id: string): Match {
  for (const x of marks(m).filter(
    (x) => x.kind === "pending-appeal" && x.targets.includes(id),
  )) {
    const client = card(m, id);
    if (client) m = discount(m, x.source, client.lane!);
  }
  return {
    ...m,
    creativeMarks: (m.creativeMarks ?? []).filter(
      (x) => !(x.kind === "pending-appeal" && x.targets.includes(id)),
    ),
  };
}
export function creativeRefund(
  before: Match,
  m: Match,
  owner: Owner,
  t: CreativeTools,
): Match {
  const key = owner === "player" ? "playerMotion" : "cpuMotion",
    gain = m[key] - before[key];
  if (gain <= 0) return m;
  const x = marks(m).find((x) => x.kind === "claim" && x.owner !== owner);
  if (!x) return m;
  const other = x.owner === "player" ? "playerMotion" : "cpuMotion",
    amount = Math.min(1, gain);
  const start = m;
  m = remove(m, x.id);
  m = { ...m, [key]: m[key] - amount, [other]: Math.min(9, m[other] + amount) };
  return t.event(
    start,
    m,
    x.source,
    [],
    "Pending Transfer: diverted 1 refunded Motion.",
  );
}
export function creativeRoundEnd(m: Match, t: CreativeTools): Match {
  for (const x of marks(m)) {
    if (!marks(m).some((current) => current.id === x.id)) continue;
    const start = m,
      source = card(m, x.source.instanceId),
      target = card(m, x.targets[0]);
    if (x.kind === "loan") {
      const key = x.owner === "player" ? "playerMotion" : "cpuMotion",
        paid = Math.min(m[key], x.amount ?? 0);
      m = { ...m, [key]: m[key] - paid };
      m = update(m, x.id, { kind: "debt", amount: (x.amount ?? 0) - paid });
    } else if (x.kind === "delayed") {
      m = remove(m, x.id);
      if (active(target)) m = t.reveal(m, target!);
    } else if (x.kind === "pending-appeal") {
      m = remove(m, x.id);
      const beforeStatus = m;
      if (target && !target.statuses.uncounterable)
        m = t.modify(m, target.instanceId, (c) => ({
          ...c,
          statuses: {
            ...c.statuses,
            ...x.pending,
            burnStacks: c.statuses.burnStacks + (x.pending?.burnStacks ?? 0),
          },
        }));
      if (target && x.attacker) {
        m = t.disruption(beforeStatus, m, x.attacker, target.instanceId);
        m = creativeStatusApplied(
          beforeStatus,
          m,
          x.attacker,
          target.instanceId,
        );
      }
    } else if (x.expires === m.round || m.round >= t.roundLimit(m)) {
      if (x.kind === "duel") {
        m = remove(m, x.id);
        if (active(source) && target && target.lane === x.lane) {
          m = t.hit(
            m,
            source!,
            target,
            -3,
            "Ankle Breaker: stayed for the duel",
          );
          m = buff(m, source!.instanceId, 1, t);
        } else if (active(source)) m = buff(m, source!.instanceId, 3, t);
      }
      if (x.kind === "visit") {
        m = remove(m, x.id);
        if (
          target &&
          x.origin !== undefined &&
          open(m, target, t).includes(x.origin)
        )
          m = t.move(m, target, x.origin, "My Weekend: return home");
      }
      if (x.kind === "anchor") {
        m = remove(m, x.id);
        if (target) m = buff(m, target.instanceId, 1, t);
      }
      if (x.kind === "claim") {
        m = remove(m, x.id);
        m = discount(m, x.source, x.lane);
      }
      if (x.kind === "goal") {
        m = remove(m, x.id);
        if (target && t.power(target) >= (x.amount ?? 5)) {
          m = buff(m, target.instanceId, 2, t);
          m = t.protect(m, x.source, target.instanceId);
        }
      }
      if (x.kind === "ground") {
        m = remove(m, x.id);
        if (
          x.targets.every((id) => card(m, id)?.lane === x.lane) &&
          t.score(m, x.owner, x.lane) >= t.score(m, rival(x.owner), x.lane)
        )
          for (const id of x.targets) m = buff(m, id, 2, t);
      }
      if (x.kind === "seed") {
        m = remove(m, x.id);
        const plant = sorted(
          board(m).filter(
            (c) =>
              c.owner === x.owner && c.lane === x.lane && c.type === "Plant",
          ),
          t,
        )[0];
        if (plant) m = buff(m, plant.instanceId, 3, t);
      }
    }
    if (start !== m)
      m = t.event(
        start,
        m,
        x.source,
        x.targets,
        x.source.ability + ": round-end resolution.",
      );
  }
  for (const tab of marks(m).filter((x) => x.kind === "tab" && x.amount)) {
    const before = m;
    m = remove(m, tab.id);
    const guest = card(m, tab.targets[0]);
    if (guest) m = buff(m, guest.instanceId, 2, t);
    m = t.event(
      before,
      m,
      tab.source,
      tab.targets,
      "Open Tab: earned Tip paid +2 Hands.",
    );
  }
  for (const c of board(m).filter(
    (c) =>
      identity(c) === "incel" &&
      active(c) &&
      (c.creativeCount ?? 0) < 2 &&
      allies(m, c).length === 0,
  )) {
    const before = m;
    m = t.modify(m, c.instanceId, (x) => ({
      ...x,
      creativeCount: (x.creativeCount ?? 0) + 1,
      powerModifier: x.powerModifier + 2,
    }));
    m = t.train(m, c.instanceId);
    m = t.event(
      before,
      m,
      c,
      [c.instanceId],
      "Leave Me Alone: isolated growth.",
    );
  }
  return m;
}
export function creativeRoundStart(m: Match, t: CreativeTools): Match {
  for (const x of (m.creativeMarks ?? []).filter((x) => x.kind === "debt")) {
    const start = m,
      key = x.owner === "player" ? "playerMotion" : "cpuMotion";
    m = remove(m, x.id);
    m = { ...m, [key]: Math.max(0, m[key] - (x.amount ?? 0)) };
    m = t.event(
      start,
      m,
      x.source,
      [],
      "Burn Rate: repaid outstanding funding.",
    );
  }
  return { ...m, creativeMarks: marks(m) };
}

export function creativeAbilityResolved(
  before: Match,
  m: Match,
  source: CardInstance,
  t: CreativeTools,
): Match {
  const coach = marks(before).find(
    (x) => x.kind === "coach" && x.targets.includes(source.instanceId),
  );
  const changed =
    JSON.stringify(
      before.boards.map((cs) =>
        cs.map((c) => [c.instanceId, c.lane, c.powerModifier, c.statuses]),
      ),
    ) !==
      JSON.stringify(
        m.boards.map((cs) =>
          cs.map((c) => [c.instanceId, c.lane, c.powerModifier, c.statuses]),
        ),
      ) ||
    before.playerMotion !== m.playerMotion ||
    before.cpuMotion !== m.cpuMotion ||
    before.discountTokens.length !== m.discountTokens.length;
  if (COACH_SAFE.has(source.cardId))
    m = t.modify(m, source.instanceId, (c) => ({
      ...c,
      creativeEntranceSucceeded: changed,
    }));
  if (coach && COACH_SAFE.has(source.cardId) && !changed)
    m = update(m, coach.id, { ready: true });
  for (const x of marks(before).filter(
    (x) =>
      x.kind === "project" &&
      x.owner === source.owner &&
      x.source.instanceId !== source.instanceId &&
      !x.targets.includes(source.instanceId) &&
      !(x.elements ?? []).includes(element(source)) &&
      x.targets.length < 2,
  )) {
    if (changed && marks(m).some((y) => y.id === x.id)) {
      const start = m;
      const assigned = {
        ...x,
        targets: [...x.targets, source.instanceId],
        elements: [...(x.elements ?? []), element(source)],
      };
      m = update(m, x.id, {
        targets: assigned.targets,
        elements: assigned.elements,
      });
      m = buff(m, source.instanceId, 1, t);
      m = contribute(m, assigned, source.instanceId, t);
      m = t.event(
        start,
        m,
        x.source,
        x.targets,
        x.source.ability + ": contribution recorded.",
      );
    }
  }
  return m;
}

/** A consumed kit reduces actual incoming damage, never produces a healing gain. */
export function creativePreventDamage(
  m: Match,
  target: CardInstance,
  amount: number,
  owner: Owner | undefined,
): { match: Match; amount: number } {
  if (owner === undefined || owner === target.owner || amount <= 0)
    return { match: m, amount };
  const kit = marks(m).find(
    (x) => x.kind === "kit" && x.targets.includes(target.instanceId),
  );
  return kit
    ? { match: remove(m, kit.id), amount: Math.max(0, amount - 2) }
    : { match: m, amount };
}
export function creativeCanCross(m: Match, id: string): boolean {
  return marks(m).some((x) => x.kind === "crossing" && x.targets.includes(id));
}

export function creativeStatusApplied(
  before: Match,
  m: Match,
  source: CardInstance,
  targetId: string,
): Match {
  const old = card(before, targetId),
    target = card(m, targetId);
  if (!old || !target || source.owner === target.owner) return m;
  const changed =
    (["silenced", "frozen", "weakened", "locked"] as const).some(
      (k) => target.statuses[k] && !old.statuses[k],
    ) || target.statuses.burnStacks > old.statuses.burnStacks;
  if (changed)
    for (const tab of marks(m).filter(
      (x) =>
        x.kind === "tab" &&
        x.targets.includes(source.instanceId) &&
        x.amount !== 1,
    ))
      m = update(m, tab.id, { amount: 1 });
  return m;
}
