import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Collection identities are permanent; alternate art never creates another playable card. */
export const FAIRYTALE_WAVE = [
  ['dorothy', 'dorothy', 'Dorothy', 'Epic', 'Air', 2, 3, 'No Place Like Home', 'On Reveal: Return your weakest other friendly character in any district with a printed cost of 2 or less to your hand. Its next deployment costs 1 less Motion (minimum 1) and gains +1 Hand.', 'Movement'],
  ['scarecrow', 'scarecrow', 'Scarecrow', 'Rare', 'Earth', 2, 3, 'Wrong Turn, Right Place', 'On Reveal: Swap districts with your weakest ally in another open district. If both can move, both gain +1 Hand. If there is no legal ally to swap with, move to the first completely empty legal district and gain +1 Hand.', 'Movement'],
  ['tinman', 'tin-man', 'Tin Man', 'Rare', 'Electric', 2, 3, 'Heart Starter', 'Ongoing: The first other ally entering your district each round gains +1 Hand. If it moved here or is another Oz traveler (Dorothy, Scarecrow, Tin Man, or Lion), it gains +2 Hands and Protection instead. Playing or moving an ally here qualifies.', 'Support'],
  ['lion', 'lion', 'Lion', 'Epic', 'Earth', 3, 4, 'Found My Courage', 'On Reveal: Gain Protection if you are alone here. Ongoing: Once per round, when another ally leaves your district, gain +2 Hands.', 'Growth'],
  ['oz', 'oz', 'Oz', 'Mythical', 'Light', 4, 5, 'The Grand Reveal', 'On Reveal: Once per match, repeat the most recent eligible entrance by another friendly Oz traveler (Dorothy, Scarecrow, Tin Man, or Lion) still on the board, including earlier rounds. If none is eligible, repeat the most recent eligible entrance by another friendly character. That ally gains +3 Hands if it moved this round, otherwise +2 if it is an Oz traveler. Cannot repeat ability-copying effects or persistent creative contracts.', 'Support'],
  ['alice', 'alice', 'Alice', 'Rare', 'Water', 2, 3, 'Drink Me / Eat Me', 'Ongoing: At round end, return to your hand once per match, except during the final round. Your next deployment gains +3 Hands and costs 1 less Motion, minimum 1.', 'Movement'],
  ['cheshire', 'cheshire', 'Cheshire', 'Epic', 'Air', 2, 3, 'The Smile Stays', 'Ongoing: While in your hand or on the board, the first ally returned to your hand each round leaves a 4-Hand Grin in its district. Maximum one friendly Grin per district.', 'Support'],
  ['queenofhearts', 'queen-of-hearts', 'Queen of Hearts', 'Legendary', 'Dark', 3, 4, 'Off With Their Heads', 'On Reveal: Execute the weakest enemy here if it has 6 or fewer Hands. A successful execution summons a 2-Hand Card Guard. Protection can block execution.', 'Disruption'],
  ['mrrabbit', 'mr-rabbit', 'Mr Rabbit', 'Rare', 'Air', 2, 2, 'Pocket Watch', 'Ongoing: While in your hand, other friendly characters returned to hand cost 1 less Motion on their next deployment (minimum 1). While on the board, gain +1 Hand each time another friendly character returns to hand.', 'Support'],
  ['sherlock', 'sherlock', 'Sherlock', 'Epic', 'Light', 2, 3, 'Stakeout', 'On Reveal: Watch both other unlocked districts through next round. Cancel the first enemy entrance ability in either, then close both stakeouts. If Sherlock is active when it cancels, he and your weakest other friendly character anywhere gain +2 Hands each.', 'Disruption'],
  ['watson', 'watson', 'Watson', 'Rare', 'Water', 1, 2, 'Still Breathing', 'On Reveal: Restore up to 3 Hands actually lost to damage to your weakest injured ally here and Protect it; otherwise Protect your weakest other ally here. Also Protect a friendly Sherlock anywhere and give him +2 Hands.', 'Sustain'],
  ['undercova', 'undercova-brotha', 'Undercova Brotha', 'Rare', 'Dark', 2, 3, 'Inside Man', 'Ongoing: Once per round, after an enemy deployed here resolves its entrance, steal 2 Hands plus up to 2 removable bonus Hands, gaining only the actual amount taken, up to 4. Escape to your weakest other open district only if Hands were taken. At most two payouts per side per match; copies share the limit.', 'Movement'],
  ['thefeds', 'the-feds', 'The Feds', 'Legendary', 'Dark', 4, 3, 'Asset Seizure', 'On Reveal: Confiscate up to 8 removable bonus Hands from the enemy here with the most bonus and Lock it. If no enemy has bonus Hands, Lock and Weaken the strongest enemy here instead. Confiscation never takes printed Hands or creates healing credit. Protection and immunity block the whole package.', 'Disruption'],
  ['dmvworker', 'dmv-worker', 'DMV Worker', 'Rare', 'Earth', 2, 2, 'Take a Number', 'On Reveal: The next enemy deployment here costs 1 extra Motion. The surcharge expires after next round and cannot stack.', 'Disruption'],
  ['ptang', 'p-tang', 'P. Tang', 'Legendary', 'Air', 3, 4, 'Belt Check', 'On Reveal: Deal 3 damage to the strongest enemy here, then knock the survivor into the next open district. If that damage lands and the target survives but cannot be moved, gain +2 Hands once for this deployment. Protection and immunity block the whole package.', 'Movement'],
  ['bonnetgirl', 'bonnet-girl', 'Bonnet Girl', 'Common', 'Normal', 1, 1, 'Now I’m Up', 'Ongoing: The first time an enemy damages another ally here, gain +2 Hands. Once per match.', 'Comeback'],
  ['corruptpastor', 'corrupt-pastor', 'Corrupt Pastor', 'Epic', 'Dark', 3, 3, 'Collection Plate', 'On Reveal: Take 1 Hand from each other ally here, leaving each with at least 1. Gain 2 Hands per actual donation.', 'Growth'],
  ['powerhouse', 'powerhouse', 'Powerhouse', 'Mythical', 'Electric', 4, 3, 'Overtime', 'Ongoing: While in your hand, bank up to 3 Motion refunded by other cards. On Reveal: Deal that much damage to every enemy here.', 'Disruption'],
  ['ronald', 'revolutionary-ronald', 'Revolutionary Ronald', 'Epic', 'Earth', 3, 4, 'WE OUTSIDE.', 'Ongoing: The first time each round an enemy damages another ally here, Protect your weakest movable character in another district, then bring it here if there is room.', 'Comeback'],
  ['trapvamp', 'trap-vamp', 'Trap Vamp', 'Legendary', 'Dark', 3, 3, 'Paid in Blood', 'Ongoing: Once per round, when your ability damages an enemy here, gain that much Hands, up to 2.', 'Growth'],
  ['squabblecook', 'squabble-house-male', 'SquabbleHouse Cook', 'Rare', 'Fire', 2, 3, 'Hands on the Clock', 'Ongoing: Once per round, when an enemy ability damages another ally here, deal 2 damage back to its source.', 'Comeback'],
  ['squabbleserver', 'squabble-house-female', 'SquabbleHouse Server', 'Common', 'Water', 1, 1, 'Fresh Pot', 'On Reveal: Cleanse Burn and Freeze from your weakest affected ally here.', 'Support'],
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
