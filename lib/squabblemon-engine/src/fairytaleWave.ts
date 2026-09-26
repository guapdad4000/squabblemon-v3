import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Collection identities are permanent; alternate art never creates another playable card. */
export const FAIRYTALE_WAVE = [
  ['dorothy', 'dorothy', 'Dorothy', 'Epic', 'Air', 2, 3, 'No Place Like Home', 'On Reveal: Return your weakest other character here with a printed cost of 2 or less to your hand. Its next deployment costs 1 less Motion, minimum 1.', 'Movement'],
  ['scarecrow', 'scarecrow', 'Scarecrow', 'Rare', 'Earth', 2, 3, 'Wrong Turn, Right Place', 'On Reveal: Swap districts with your weakest ally in another open district. If both can move, both gain +1 Hand.', 'Movement'],
  ['tinman', 'tin-man', 'Tin Man', 'Rare', 'Electric', 2, 3, 'Heart Starter', 'Ongoing: The first other ally entering your district each round gains +1 Hand and Protection. Playing or moving an ally here qualifies.', 'Support'],
  ['lion', 'lion', 'Lion', 'Epic', 'Earth', 3, 4, 'Found My Courage', 'On Reveal: Gain Protection if you are alone here. Ongoing: Once per round, when another ally leaves your district, gain +2 Hands.', 'Growth'],
  ['oz', 'oz', 'Oz', 'Mythical', 'Light', 4, 5, 'The Grand Reveal', 'On Reveal: Once per match, repeat the most recent eligible other friendly character entrance still on the board, including earlier rounds. If that ally moved this round, it also gains +2 Hands. Cannot repeat ability-copying effects.', 'Support'],
  ['alice', 'alice', 'Alice', 'Rare', 'Water', 2, 3, 'Drink Me / Eat Me', 'Ongoing: At round end, return to your hand once per match, except during the final round. Your next deployment gains +3 Hands and costs 1 less Motion, minimum 1.', 'Movement'],
  ['cheshire', 'cheshire', 'Cheshire', 'Epic', 'Air', 3, 4, 'The Smile Stays', 'Ongoing: The first ally returned to your hand each round leaves a 3-Hand Grin in its district. Maximum one friendly Grin per district.', 'Support'],
  ['queenofhearts', 'queen-of-hearts', 'Queen of Hearts', 'Legendary', 'Dark', 4, 4, 'Off With Their Heads', 'On Reveal: Execute the weakest enemy here if it has 4 or fewer Hands. A successful execution summons a 2-Hand Card Guard. Protection can block execution.', 'Disruption'],
  ['sherlock', 'sherlock', 'Sherlock', 'Epic', 'Light', 3, 4, 'Stakeout', 'On Reveal: Set a visible trap in the strongest other enemy district. It cancels the next enemy entrance ability there, then disappears. If it cancels while Sherlock is active, he and your weakest other friendly character anywhere gain +2 Hands each. Expires after next round.', 'Disruption'],
  ['watson', 'watson', 'Watson', 'Rare', 'Water', 2, 3, 'Still Breathing', 'On Reveal: Restore up to 3 Hands actually lost to damage to your weakest injured ally here and Protect it; otherwise Protect your weakest other ally here. Also Protect a friendly Sherlock anywhere.', 'Sustain'],
  ['undercova', 'undercova-brotha', 'Undercova Brotha', 'Rare', 'Dark', 2, 2, 'Inside Man', 'Ongoing: Once per match, after the first enemy deployed here resolves its entrance, steal 1 Hand from it and escape to your weakest other open district.', 'Movement'],
  ['thefeds', 'the-feds', 'The Feds', 'Legendary', 'Dark', 4, 4, 'Asset Seizure', 'On Reveal: Remove up to 4 bonus Hands from the strongest enemy here and Lock it. This removal cannot take it below its printed Hands.', 'Disruption'],
  ['dmvworker', 'dmv-worker', 'DMV Worker', 'Rare', 'Earth', 2, 2, 'Take a Number', 'On Reveal: The next enemy deployment here costs 1 extra Motion. The surcharge expires after next round and cannot stack.', 'Disruption'],
  ['ptang', 'p-tang', 'P. Tang', 'Legendary', 'Air', 3, 4, 'Belt Check', 'On Reveal: Deal 2 damage to the strongest enemy here, then knock the survivor into the next open district. Protection blocks the whole hit.', 'Movement'],
  ['bonnetgirl', 'bonnet-girl', 'Bonnet Girl', 'Common', 'Normal', 1, 1, 'Now I’m Up', 'Ongoing: The first time an enemy damages another ally here, gain +2 Hands. Once per match.', 'Comeback'],
  ['corruptpastor', 'corrupt-pastor', 'Corrupt Pastor', 'Epic', 'Dark', 3, 3, 'Collection Plate', 'On Reveal: Take 1 Hand from each other ally here, leaving each with at least 1. Gain 2 Hands per actual donation.', 'Growth'],
  ['powerhouse', 'powerhouse', 'Powerhouse', 'Mythical', 'Electric', 4, 3, 'Overtime', 'Ongoing: While in your hand, bank up to 3 Motion refunded by other cards. On Reveal: Deal that much damage to every enemy here.', 'Disruption'],
  ['ronald', 'revolutionary-ronald', 'Revolutionary Ronald', 'Epic', 'Earth', 3, 4, 'Organize', 'Ongoing: Once per round, when an enemy damages another ally here, give your weakest ally in each other district +1 Hand.', 'Comeback'],
  ['trapvamp', 'trap-vamp', 'Trap Vamp', 'Legendary', 'Dark', 3, 3, 'Paid in Blood', 'Ongoing: Once per round, when your ability damages an enemy here, gain that much Hands, up to 2.', 'Growth'],
  ['squabblecook', 'squabble-house-male', 'Squabble House Worker — Male', 'Rare', 'Fire', 2, 2, 'Hands on the Clock', 'Ongoing: Once per round, when an enemy ability damages another ally here, deal 2 damage back to its source.', 'Comeback'],
  ['squabbleserver', 'squabble-house-female', 'Squabble House Worker — Female', 'Common', 'Water', 1, 1, 'Fresh Pot', 'On Reveal: Cleanse Burn and Freeze from your weakest affected ally here.', 'Support'],
] as const;

export const fairytaleUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  FAIRYTALE_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const fairytaleRarities: Record<string, CardRarity> = Object.fromEntries(FAIRYTALE_WAVE.map(([id, , , rarity]) => [id, rarity]));
export const FAIRYTALE_ALTERNATE_ART = ['dorothy', 'scarecrow', 'tin-man', 'lion', 'alice', 'cheshire', 'sherlock', 'watson'] as const;
export const fairytaleCards: Record<string, Card> = Object.fromEntries(FAIRYTALE_WAVE.map(
  ([engineId, id, name, , type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: engineId + ':upgrade:' + (index + 1), name: ability + ' ' + ['Practice', 'Confidence', 'Mastery'][index],
      description: 'The first time the base ability succeeds this match, gain +1 Hand.', unlockLevel,
      effect: fairytaleUpgradeEffects[engineId][index],
    })),
  }],
));
