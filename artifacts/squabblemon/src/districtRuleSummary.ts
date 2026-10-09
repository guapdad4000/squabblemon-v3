import { DISTRICT_CATALOG, type DistrictId } from '@workspace/squabblemon-engine/districts';

// Board reminders use the issued rule as their key. A changed or older match
// keeps its own text instead of receiving a reminder for a different rule.
const reminders = {
  'raid-checkpoint': 'Unarmored Hands ×3 = boss damage.',
  'raid-barricade': 'Unarmored Hands ×3 = boss damage.',
  'raid-evidence': 'Unarmored Hands ×3 = boss damage.',
  'bodega': 'First play: −1 Motion (min 1).',
  'the-trap': 'First move in: +2 Hands.',
  'waff-l-house': 'Behind at round start? First play: +2 Hands.',
  'vip-section': 'Printed cost 4+: +2 Hands.',
  'county-jail': 'First play stays locked this fade.',
  'penthouse': 'R1–3: solo +3. R4+: each +1 Hand.',
  'time-square': '3 types: +3 district Hands.',
  'magic-city': 'R5–6: first play each round +2 Hands.',
  'the-subway': 'First play/round rides right after its ability.',
  'o-block': '+2 Hands with more allies; −1 with fewer.',
  'hollywood-strip': 'Newest ally: +3 Hands. Others: −1.',
  'dive-bar': '−1 Motion (min 1). Cards: −2 Hands.',
  'acorn-projects': 'Printed cost ≤2: +1/other ally (max +3).',
  'corrupt-church': 'First play/round: +1 Motion, +2 Hands.',
  'nail-salon': 'First play/round blocks 1 targeted ability.',
  'barbershop': 'First play/round cleanses other allies.',
  'underground-ring': 'Only your strongest card scores Hands.',
  'rooftop-garden': 'Round start (R2–6): +1 permanent Hand.',
  'pawn-shop': 'First play/round trades weakest ally for its Hands.',
  'pirate-radio': 'Exactly 2 allies: +3 Hands in other lanes.',
  'blackout-block': 'Plays are Silenced; moves in avoid it.',
  'flood-channel': 'Round 4 starts: all cards move right.',
  'construction-site': 'R4+: no plays here. Moving still works.',
  'night-market': 'First play/round draws before its ability.',
  'mirror-arcade': 'Score printed cost, not Hands. Frozen: 0.',
  'community-kitchen': 'First play/round: other lanes gain +1 Hand.',
  'rush-hour': 'First play/round pushes other cards right.',
} satisfies Record<DistrictId, string>;

const canonicalReminders = new Map(DISTRICT_CATALOG.map(district => [
  `${district.id}:${district.rule}`, reminders[district.id],
]));

export function getDistrictRuleSummary(district: { id: string; rule: string }): string {
  return canonicalReminders.get(`${district.id}:${district.rule}`) ?? district.rule;
}
