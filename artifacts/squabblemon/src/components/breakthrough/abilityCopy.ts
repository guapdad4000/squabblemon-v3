import type { FighterDefinition } from '@workspace/squabblemon-engine/breakthrough';

export interface AbilitySummary {
  lead: string;
  tags: string[];
}

// A quick decision aid for the real-time audition. Keep card.description visible
// in the full rules view: these leads intentionally omit secondary conditions.
const summaries: Partial<
  Record<NonNullable<FighterDefinition['ability']>, AbilitySummary>
> = {
  none: { lead: 'Fight with this card’s Hands.', tags: [] },
  burn: { lead: 'Hit the nearest enemy here for 1.', tags: ['Every 5s'] },
  mend: {
    lead: 'Heal 1 damage from this fighter.',
    tags: ['Every 6s', 'Up to starting Hands'],
  },
  push: {
    lead: 'Push the nearest enemy here toward its own base.',
    tags: ['On deploy', 'Stops at blockers'],
  },
  'personal-security': {
    lead: 'Give an ally +2 and Protection; strip enemy bonus Hands or hit for 2.',
    tags: ['On deploy', 'Weakest other ally here', 'Strip up to 4 bonus Hands'],
  },
  'read-the-strike': {
    lead: 'Punish a stronger or boosted enemy; otherwise boost and Protect an ally.',
    tags: [
      'On deploy',
      'Hit 4 → gain 3 if damage lands',
      'Ally in another lane: +3',
    ],
  },
  'no-mercy': {
    lead: 'Hit the strongest enemy in every lane for 2; grow for each actual hit.',
    tags: ['On deploy', '+1 per damaged enemy', 'Gain up to +3'],
  },
  'secret-technique': {
    lead: 'Hit a boosted or costly enemy harder; gain +1 if damage lands.',
    tags: [
      'On deploy',
      'Here: bonus → cost 4+ → strongest',
      'Hit 4, otherwise 2',
    ],
  },
  'inside-man': {
    lead: 'Steal up to 4 Hands from a new enemy; escape after a payout if space allows.',
    tags: [
      'After enemy entrance here',
      'Shared 10s cooldown',
      '2 payouts per side',
    ],
  },
  'whos-the-master': {
    lead: 'Steal enemy bonus Hands; if none are boosted, hit the strongest for 3.',
    tags: ['On deploy', 'Enemy here', 'Steal up to 5 bonus Hands'],
  },
  'golden-glow': {
    lead: 'Strip bonus Hands and hit for 2; three friendly elements grant +3 and Protection.',
    tags: ['On deploy', 'Enemy here', 'Strip up to 4 bonus Hands'],
  },
  'black-blade': {
    lead: 'Give an ally +2 and Protection; hit the strongest enemy here for 2.',
    tags: ['On deploy', 'Weakest unprotected other ally here'],
  },
  'ankle-breaker': {
    lead: 'Challenge an enemy: gain +3 if it changes lanes; otherwise hit 3 and gain +1.',
    tags: [
      'On deploy',
      'Strongest enemy here',
      '10s; defeat or scoring cancels',
    ],
  },
  'new-here': {
    lead: 'Gain +1 Hands when you have no other ally here.',
    tags: ['On deploy'],
  },
  'still-standing': {
    lead: 'Gain +3 Hands if enemies here outnumber your other allies here.',
    tags: ['On deploy'],
  },
  connections: {
    lead: 'Pay 1 less Motion for your next successful play in another lane.',
    tags: ['On deploy', 'One pending discount', 'Minimum cost 0'],
  },
  'check-in': {
    lead: 'Give your weakest other ally here +3; clear its Freeze and Silence.',
    tags: ['On deploy', 'Burn stays'],
  },
  'ratios-receipts': {
    lead: 'Burn the strongest enemy here and hit for 1, or 2 if recently deployed.',
    tags: ['On deploy', 'Recent: within 10s', 'Burn: 1 / 2s for 6s'],
  },
  'smile-bombs': {
    lead: 'Plant 4 bombs that hit random enemies for 2; living KYLE grows on hits and KOs.',
    tags: ['Explode after 10s', 'Random lanes', '+1 per hit; +1 per KO'],
  },
  'eat-something': {
    lead: 'Give another ally +1 and Protection; heal its damage or pack a lunch.',
    tags: ['On deploy', 'Injured ally: any lane', 'While held: Light +1 / 10s'],
  },
  finnam: {
    lead: 'Grow from your other allies, up to +5; hit every enemy for 1.',
    tags: ['On deploy', 'Shared 10s cooldown', 'While held: Fire +1 / 10s'],
  },
  'buddy-buds': {
    lead: 'Discount plays here; plant buds that grant +3 after 20s.',
    tags: [
      'Active normal form: −1 Motion here',
      'Buddy: +3 after 20s',
      'Buds: latest ally in each lane',
    ],
  },
  'cold-shoulder': {
    lead: 'Freeze the strongest enemy here: stop it and make its Hands count as 0.',
    tags: [
      'On deploy',
      '10s or until cleansed',
      'Defeated by positive-Hands contact',
    ],
  },
  'still-rapping': {
    lead: 'Silence an enemy, prioritizing active Ongoing abilities.',
    tags: [
      'On deploy',
      'Strongest eligible enemy here',
      '10s or until cleansed',
    ],
  },
  'small-time-heat': {
    lead: 'Apply 1 Burn to every enemy in this lane.',
    tags: ['On deploy', 'Burn: every 2s for 6s', 'Up to 4 stacks'],
  },
  'good-vibes': {
    lead: 'Cleanse Freeze and Silence from an ally and give +2; otherwise give an ally +1.',
    tags: [
      'On deploy',
      'Weakest affected other ally here',
      'Burn and Weaken stay',
    ],
  },
  'hairline-link': {
    lead: 'Gain +2 Hands if another ally here costs 2 Motion or less.',
    tags: ['On deploy'],
  },
  'squad-check': {
    lead: 'Gain +1 Hands if you have an ally in another lane.',
    tags: ['On deploy'],
  },
  'deep-crew': {
    lead: 'Gain +3 Hands if you have at least two other allies here.',
    tags: ['On deploy'],
  },
  'old-head': {
    lead: 'Gain +3 when their whole board outnumbers yours; a huge deficit also hits for 1.',
    tags: [
      'On deploy',
      'Count includes this fighter',
      '3+ more enemies: weakest here −1',
    ],
  },
  'bull-rush': {
    lead: 'Gain +1 Hands and Burn the strongest enemy here.',
    tags: [
      'On deploy',
      '+1 Burn; +2 against Plant',
      'Burn: every 2s for 6s, cap 4',
    ],
  },
  'ride-out': {
    lead: 'Ride to your weakest other open lane; gain +1 only if you arrive.',
    tags: ['On deploy', 'Keep progress', 'Blocked by defenders'],
  },
  'bring-the-vibe': {
    lead: 'Bring your weakest movable ally from another lane here; both gain +1 on arrival.',
    tags: ['On deploy', 'Keep progress', 'Frozen or blocked allies stay'],
  },
  'water-break': {
    lead: 'Regain 1 Motion if another friendly fighter is already here.',
    tags: ['On deploy', 'Motion caps at 9'],
  },
  'fade-and-coach': {
    lead: 'Hit the strongest enemy here for 2; give your weakest ally in another lane +2.',
    tags: ['On deploy', 'Both parts resolve independently'],
  },
  'badge-sweep': {
    lead: 'Disable enemy abilities here for 10s; gain +1 for each unblocked Weaken.',
    tags: ['On deploy', 'Hands and marching stay'],
  },
  'whole-block-hot': {
    lead: 'Burn every enemy, up to 4 stacks; give every other friendly Fire fighter +1.',
    tags: ['On deploy', '3 Burn; 4 against Plant', 'Burn: every 2s for 6s'],
  },
  'block-party': {
    lead: 'Bring the weakest movable ally from each other lane here; grow for each arrival.',
    tags: [
      'On deploy',
      'Keep progress; defenders block',
      'Gain +1 each, up to +2',
    ],
  },
  'iron-driver': {
    lead: 'Gain +1 per other Earth ally, up to +4; two local Earth allies also unlock a hit for 2.',
    tags: [
      'On deploy',
      'Counts Earth across all lanes',
      'Hit strongest enemy here',
    ],
  },
  'double-knuckle': {
    lead: 'Hit up to two different strongest enemies here for 2 each.',
    tags: ['On deploy', 'Each strike checks defenses'],
  },
  'big-zoey-transfer': {
    lead: 'Give your weakest other ally here +2; hit the weakest enemy here for 2.',
    tags: ['On deploy', 'Both parts resolve independently'],
  },
  'clean-cut': {
    lead: 'Trim up to 2 enemy bonus Hands and give them to an ally; with no boosted enemy, give +1.',
    tags: [
      'On deploy',
      'Weakest other ally here',
      'While held: Normal +1 / 10s',
    ],
  },
  'church-shield': {
    lead: 'Buff and Protect an ally; reward a Light fighter’s Protection or Side Eye block with +2.',
    tags: [
      'On deploy: +3 Light, +2 otherwise',
      'Weakest other ally here',
      'While active: shared 10s cooldown',
    ],
  },
  'side-eye': {
    lead: 'Block one hostile ability package aimed at a friendly fighter in this lane.',
    tags: ['While active', 'Shared 10s cooldown', 'Does not block collisions'],
  },
};

export function abilitySummary(card: FighterDefinition): AbilitySummary {
  const summary = summaries[card.ability ?? 'none'] ?? {
    lead: card.description.split(/(?<=[.!?])\s+/)[0],
    tags:
      card.kind === 'support' || card.kind === 'blockbuster'
        ? ['Action']
        : (card.triggers ?? ['entrance']).map((trigger) =>
            trigger === 'entrance'
              ? 'On deploy'
              : trigger === 'held'
                ? 'While held'
                : 'While active',
          ),
  };
  return { lead: summary.lead, tags: [...summary.tags] };
}
