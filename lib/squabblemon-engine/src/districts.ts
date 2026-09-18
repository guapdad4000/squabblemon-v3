/** Versioned location rules. Issued matches keep their complete definitions. */
export type DistrictId = 'bodega' | 'the-trap' | 'waff-l-house' | 'vip-section' | 'county-jail' | 'penthouse' | 'time-square' | 'magic-city'
  | 'the-subway' | 'o-block' | 'hollywood-strip' | 'dive-bar' | 'acorn-projects' | 'corrupt-church' | 'nail-salon' | 'barbershop';
export type DistrictEffect =
  | { kind: 'first-discount'; amount: number; minimum: number }
  | { kind: 'move-bonus'; amount: number }
  | { kind: 'comeback'; amount: number }
  | { kind: 'expensive'; amount: number; minimumCost: number }
  | { kind: 'detain-first' }
  | { kind: 'penthouse'; solo: number; crew: number; changesAtRound: number }
  | { kind: 'diversity'; amount: number; types: number }
  | { kind: 'late-arrival'; amount: number; startsAtRound: number }
  | { kind: 'subway' }
  | { kind: 'outnumber'; bonus: number; penalty: number }
  | { kind: 'spotlight'; bonus: number; penalty: number }
  | { kind: 'dive-discount'; amount: number; minimum: number; penalty: number }
  | { kind: 'cheap-crew'; maximumCost: number; maximumBonus: number }
  | { kind: 'tithe'; tax: number; amount: number }
  | { kind: 'salon-protection' }
  | { kind: 'crew-cleanse' };
export type DistrictDefinition = {
  id: DistrictId; name: string; rule: string; strategy: string; accent: string; effect: DistrictEffect;
};
export type DistrictSnapshot = { version: 1; locations: [DistrictDefinition, DistrictDefinition, DistrictDefinition] };
export type DistrictDisplay = { id: string; name: string; rule: string; strategy: string; accent: string; status: string };

export const DISTRICT_CATALOG: readonly DistrictDefinition[] = [
  { id: 'bodega', name: 'BODEGA', rule: 'Your first play here costs 1 less Motion (minimum 1). Discounts do not stack.', strategy: 'Spend the opening discount now, or save it for a bigger character.', accent: '#fbbf24', effect: { kind: 'first-discount', amount: 1, minimum: 1 } },
  { id: 'the-trap', name: 'THE TRAP', rule: 'The first time each card moves here, it gains +2 Hands.', strategy: 'Play elsewhere, then move in. Playing directly here does not earn the bonus.', accent: '#fb7185', effect: { kind: 'move-bonus', amount: 2 } },
  { id: 'waff-l-house', name: 'WAFF-L HOUSE', rule: 'Started the round behind here? Your first play here this round gains +2 Hands.', strategy: 'The comeback bonus is decided at round start, before either player acts.', accent: '#facc15', effect: { kind: 'comeback', amount: 2 } },
  { id: 'vip-section', name: 'VIP SECTION', rule: 'Cards with a printed cost of 4 or more have +2 Hands here.', strategy: 'Discounted big characters still get the bonus. Frozen cards contribute 0.', accent: '#c084fc', effect: { kind: 'expensive', amount: 2, minimumCost: 4 } },
  { id: 'county-jail', name: 'COUNTY JAIL', rule: 'Each side’s first card played here cannot move for the rest of the match.', strategy: 'Choose your first arrival carefully. Later arrivals and cards moving in stay free.', accent: '#94a3b8', effect: { kind: 'detain-first' } },
  { id: 'penthouse', name: 'PENTHOUSE', rule: 'Rounds 1–3: your lone card has +3 Hands. From round 4: each of your cards has +1 instead.', strategy: 'Claim it with a solo threat, then bring the crew when the party starts.', accent: '#f0abfc', effect: { kind: 'penthouse', solo: 3, crew: 1, changesAtRound: 4 } },
  { id: 'time-square', name: 'TIME SQUARE', rule: 'Have 3 different card types here to give your side +3 district Hands.', strategy: 'Build a mixed crew. Losing a type removes the district bonus.', accent: '#22d3ee', effect: { kind: 'diversity', amount: 3, types: 3 } },
  { id: 'magic-city', name: 'MAGIC CITY', rule: 'On rounds 5 and 6, your first card played here each round gains +2 Hands.', strategy: 'Save a late arrival for the spotlight. Each side gets its own bonus.', accent: '#f472b6', effect: { kind: 'late-arrival', amount: 2, startsAtRound: 5 } },
  { id: 'the-subway', name: 'THE SUBWAY', rule: 'Your first play here each round moves right after its ability. Rightmost wraps left.', strategy: 'Abilities resolve here before the ride. Cards that already left do not ride again. Moving in does not trigger on-play rules.', accent: '#38bdf8', effect: { kind: 'subway' } },
  { id: 'o-block', name: 'O-BLOCK', rule: 'Your cards here have +2 Hands while you outnumber the rival; −1 while outnumbered.', strategy: 'Equal crews get no modifier. Reinforcements or movement can flip both sides’ bonuses. Hands cannot fall below 0.', accent: '#f87171', effect: { kind: 'outnumber', bonus: 2, penalty: 1 } },
  { id: 'hollywood-strip', name: 'HOLLYWOOD STRIP', rule: 'Your newest arrival has +3 Hands here. Your other cards here have −1.', strategy: 'Each play or move into this lane steals the spotlight. If that card leaves, your previous arrival gets it back. Minimum 0 Hands.', accent: '#fcd34d', effect: { kind: 'spotlight', bonus: 3, penalty: 1 } },
  { id: 'dive-bar', name: 'DIVE BAR', rule: 'Plays cost 1 less Motion (min 1; discounts don’t stack). Cards here have −2 Hands (min 0).', strategy: 'Get a cheaper play, then move out to shake off the Hands penalty. This penalty does not destroy cards.', accent: '#fb923c', effect: { kind: 'dive-discount', amount: 1, minimum: 1, penalty: 2 } },
  { id: 'acorn-projects', name: 'ACORN PROJECTS', rule: 'Your cards with printed cost 2 or less gain +1 Hands per other ally here, up to +3.', strategy: 'Build a crew around your cheap characters. The bonus shrinks when allies leave.', accent: '#a3e635', effect: { kind: 'cheap-crew', maximumCost: 2, maximumBonus: 3 } },
  { id: 'corrupt-church', name: 'CORRUPT CHURCH', rule: 'Your first play here each round costs +1 Motion and gains +2 Hands before its ability.', strategy: 'Pay the tithe for lasting Hands. The extra cost comes after discounts and adds to any Rent Due tax.', accent: '#d8b4fe', effect: { kind: 'tithe', tax: 1, amount: 2 } },
  { id: 'nail-salon', name: 'NAIL SALON', rule: 'Your first play here each round blocks the next targeted enemy ability against it.', strategy: 'Protection follows the card if it moves and lasts until used. Lane penalties still apply.', accent: '#f9a8d4', effect: { kind: 'salon-protection' } },
  { id: 'barbershop', name: 'BARBERSHOP', rule: 'Your first play here each round clears Freeze, Silence, and negative Hands from your other cards here.', strategy: 'The cleanup happens before the new card’s ability. Positive buffs stay; ongoing lane penalties still apply.', accent: '#2dd4bf', effect: { kind: 'crew-cleanse' } },
];

/** Deterministic Fisher–Yates: randomness belongs at match issuance, never in a play. */
export function createDistrictSnapshot(seed: string): DistrictSnapshot {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const pool = [...DISTRICT_CATALOG];
  for (let i = pool.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((state / 4294967296) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { version: 1, locations: JSON.parse(JSON.stringify(pool.slice(0, 3))) as DistrictSnapshot['locations'] };
}

export function validateDistrictSnapshot(value: unknown): DistrictSnapshot {
  const snapshot = value as DistrictSnapshot | undefined;
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.locations) || snapshot.locations.length !== 3
    || new Set(snapshot.locations.map(item => item?.id)).size !== 3) throw new Error('District snapshot is missing or outdated. Start a new match.');
  for (const location of snapshot.locations) {
    const definition = DISTRICT_CATALOG.find(item => item.id === location?.id);
    // Never silently reinterpret an issued snapshot after a content deployment.
    // PostgreSQL JSONB changes key order. Compare the complete set of effect
    // fields and their values, rather than the order they serialize in.
    const effect = location?.effect as unknown as Record<string, unknown> | undefined;
    if (!definition || !effect || typeof effect !== 'object' || Array.isArray(effect)
      || Object.keys(definition.effect).length !== Object.keys(effect).length
      || Object.entries(definition.effect).some(([key, expected]) => effect[key] !== expected)
      || ['name', 'rule', 'strategy', 'accent'].some(key => typeof location[key as keyof DistrictDefinition] !== 'string')) {
      throw new Error('District snapshot is missing or outdated. Start a new match.');
    }
  }
  return JSON.parse(JSON.stringify(snapshot)) as DistrictSnapshot;
}
