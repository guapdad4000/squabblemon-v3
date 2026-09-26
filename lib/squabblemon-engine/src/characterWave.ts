import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Stable collection IDs: balance updates never replace owned cards or cosmetics. */
export const CHARACTER_WAVE = [
  ['homelessguy', 'homeless-guy', 'Homeless Guy', 'Mythical', 'Normal', 3, 4, 'Nothing to Lose', 'On Reveal: Choose 0–4 extra Motion; gain that many Hands, plus 1 if you invested any Motion. If the deployment cost alone spent your last Motion, instead steal up to 2 Hands from the strongest enemy here.', 'Growth'],
  ['fangirl', 'fangirl', 'Fangirl', 'SuperCommon', 'Light', 1, 1, 'Day One', 'On Reveal: Your strongest other ally here becomes your idol. Ongoing: The first time your idol gains Hands each round, gain +1 Hand.', 'Support'],
  ['grownfanboy', 'grown-man-fanboy', 'Grown-Man Fanboy', 'Epic', 'Normal', 3, 4, 'He Doesn’t Know You', 'On Reveal: Your strongest other ally becomes your idol. Ongoing: Intercept the first hostile ability targeting your idol each round. If Fangirl is here when you take the hit, gain +2 Hands.', 'Support'],
  ['lawlessyn', 'lawless-yn', 'Lawless YN', 'Rare', 'Dark', 2, 2, 'Wrong Block', 'On Reveal: Move the weakest enemy here to their strongest other open district. Protection, immunity and movement locks can stop this.', 'Disruption'],
  ['streetapostle', 'street-apostle', 'The Street Apostle', 'Epic', 'Plant', 3, 3, 'Spread the Word', 'Ongoing: The first time another Plant ally gains Hands each round, repeat up to 2 of that gain onto your weakest Plant ally in each other district. Copied gains cannot trigger this again.', 'Growth'],
  ['asphaltapostle', 'asphalt-apostle', 'The Asphalt Apostle', 'Epic', 'Earth', 3, 4, 'Concrete Congregation', 'On Reveal: Protect your weakest other Earth ally anywhere and give it +1 Hand. Ongoing: Once per round, block the first hostile forced move against an Earth ally; give that ally +2 Hands instead.', 'Support'],
  ['colognecriminal', 'cologne-criminal', 'Cologne Criminal', 'Epic', 'Poison', 3, 3, 'You Can Still Smell Him', 'On Reveal: Leave Lingering Scent here through the end of next round. The first enemy entering this district each round gets 2 Burn, even if moved here. Scent stays after you leave.', 'Disruption'],
  ['passportbro', 'passport-bro', 'Passport Bro', 'Epic', 'Water', 3, 3, 'Geographic Arbitrage', 'On Reveal: Move your weakest other ally here to your weakest other open district. Ongoing: Once per round, when another Water ally leaves a district you are losing, cleanse it and give it +2 Hands.', 'Movement'],
  ['seafoodassassin', 'seafood-assassin', 'Seafood Assassin', 'Legendary', 'Poison', 4, 3, 'Extra Sauce', 'On Reveal: Apply 2 Burn to every enemy here, then immediately detonate all their Burn as Hands damage and consume it. Protection blocks the whole hit.', 'Disruption'],
  ['homelesslegend', 'homeless-legend', 'Homeless Legend', 'Legendary', 'Plant', 4, 5, 'Built Different', 'Ongoing: Survive your first lethal Hands reduction at 1 Hand. At round end, recover up to 2 Hands lost to damage.', 'Sustain'],
  ['godofhookah', 'god-of-hookah', 'God of Hookah', 'Mythical', 'Poison', 4, 4, 'Pass the Hose', 'Ongoing: At round end, the first enemy damaged by Burn in each district passes 1 Burn to the weakest unburned enemy in the next district. New Burn waits until next round.', 'Disruption'],
  ['mailman', 'the-mailman', 'The Mailman', 'Mythical', 'Electric', 3, 3, 'Express Delivery', 'Ongoing: Your second Electric character played each round sends a Package to your weakest other open district. The next Electric character played there costs 1 less Motion and gains +2 Hands. Only one Package can be pending.', 'Support'],
] as const;

export const characterWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  CHARACTER_WAVE.map(([engineId]) => [engineId, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const characterWaveRarities: Record<string, CardRarity> = Object.fromEntries(CHARACTER_WAVE.map(([engineId, , , rarity]) => [engineId, rarity]));
export const characterWaveCards: Record<string, Card> = Object.fromEntries(CHARACTER_WAVE.map(
  ([engineId, id, name, , type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: engineId + ':upgrade:' + (index + 1), name: ability + ' ' + ['Practice', 'Confidence', 'Mastery'][index],
      description: 'The first time the base ability succeeds this match, gain +1 Hand.', unlockLevel,
      effect: characterWaveUpgradeEffects[engineId][index],
    })),
  }],
));
