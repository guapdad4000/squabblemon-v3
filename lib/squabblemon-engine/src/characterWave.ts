import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** The first full community character wave. Variants stay cosmetic. */
export const CHARACTER_WAVE = [
  ['homelessguy', 'homeless-guy', 'Homeless Guy', 'Mythical', 'Normal', 4, 3, 'Wild Card', 'On Reveal: Copy the type of your lowest-Hands elemental ally and gain +2 Hands. If you have none, gain +1 instead. Ongoing: At round end, gain +1 Hand while another ally shares your type.', 'Growth'],
  ['fangirl', 'fangirl', 'Fangirl', 'SuperCommon', 'Light', 1, 1, 'Day One', 'On Reveal: Give your strongest other ally here +2 Hands. If Grown-Man Fanboy is here, Protect that ally and give both fans +1 Hand.', 'Support'],
  ['grownfanboy', 'grown-man-fanboy', 'Grown-Man Fanboy', 'Epic', 'Normal', 3, 3, "I'm Your Biggest Fan", "On Reveal: Match your strongest other ally here's printed Hands, up to 6. If Fangirl is here, Protect that ally and give both fans +1 Hand.", 'Support'],
  ['lawlessyn', 'lawless-yn', 'Lawless YN', 'Rare', 'Dark', 2, 2, 'No Rules', 'On Reveal: Steal Protection from the strongest enemy here. If nobody is Protected, apply Weaken to that enemy instead.', 'Disruption'],
  ['streetapostle', 'street-apostle', 'The Street Apostle', 'Epic', 'Plant', 3, 3, 'Spread the Word', 'On Reveal: Give your lowest-Hands other Plant ally here +1 Hand. Ongoing: Your first Plant established in a new district each round gives your weakest Plant elsewhere +2 Hands.', 'Growth'],
  ['asphaltapostle', 'asphalt-apostle', 'The Asphalt Apostle', 'Epic', 'Earth', 3, 4, 'Stand on Business', 'Ongoing: At round end, give your weakest other unmoved Earth ally here +2 Hands. If you control this district, Protect that ally.', 'Support'],
  ['colognecriminal', 'cologne-criminal', 'Cologne Criminal', 'Epic', 'Poison', 3, 3, 'Unsolicited Sample', 'On Reveal: Apply Weaken to the strongest enemy here. If already Weakened, apply 1 Burn instead. Ongoing: Your first successful Weaken each round gives your weakest Poison ally +2 Hands.', 'Disruption'],
  ['passportbro', 'passport-bro', 'Passport Bro', 'Epic', 'Water', 3, 3, 'International Waters', 'On Reveal: Move your lowest-Hands other ally here to your weakest other district. Ongoing: Your first Water ally moved each round is cleansed, gains +1 Hand, and refunds 1 Motion.', 'Movement'],
  ['seafoodassassin', 'seafood-assassin', 'Seafood Assassin', 'Legendary', 'Poison', 4, 3, 'Extra Sauce', 'On Reveal: Apply 3 Burn to every enemy here. Enemies already Burning are also Weakened. Give your weakest other Poison ally +1 Hand for each enemy hit.', 'Disruption'],
  ['homelesslegend', 'homeless-legend', 'Homeless Legend', 'Legendary', 'Plant', 4, 4, 'Still Standing', 'Ongoing: The first time this would be destroyed, survive at 1 Hand and give every other Plant ally +1 Hand.', 'Sustain'],
  ['godofhookah', 'god-of-hookah', 'God of Hookah', 'Mythical', 'Poison', 5, 4, 'Everybody Catching Smoke', 'On Reveal: In every district, Weaken the strongest enemy. If that enemy is already Weakened, apply 2 Burn instead.', 'Disruption'],
  ['mailman', 'the-mailman', 'The Mailman', 'Mythical', 'Electric', 4, 3, 'Special Delivery', 'On Reveal: Give the weakest other Electric ally in every district +1 Hand. If you have Electric allies in all three districts, refund 1 Motion.', 'Support'],
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
      description: 'After the base ability succeeds, this card gains +1 Hand.', unlockLevel,
      effect: characterWaveUpgradeEffects[engineId][index],
    })),
  }],
));
