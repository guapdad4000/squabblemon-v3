import type { PatchInput } from '@workspace/api-client-react';

/**
 * Ready-to-review notes for the passes shipped between September 27 and 29.
 * They are only loaded into the private desk as drafts; nothing here publishes
 * or grants anything until an allowlisted admin previews and confirms each one.
 * Card numbers describe the live catalog (Motion / Hands) at the time of writing.
 */
export type PreparedPatch = Required<Omit<PatchInput, 'artCardId'>> & { artCardId: string };

const gift = { softCurrency: 100, packTickets: 1 } as const;

export const PREPARED_PATCHES: readonly PreparedPatch[] = [
  {
    version: '1.1',
    date: '2026-09-27',
    title: 'Fade Park Glow-Up',
    artCardId: 'church-auntie',
    overview: 'PvP got a full street makeover. Matches open with banner intros, reactions pop in comic bubbles, hits land with layered effects, and every result screen now tells the story of the fight.',
    buffs: [
      'New reaction packs: Buddy Kyle and Church Auntie join Ashlee, Buttahs, Guap and Cologne Criminal with fresh laugh, rage, respect and shocked art.',
    ],
    changes: [
      'PvP redesign: banner intros, a cleaner top bar, comic reaction bubbles, layered attack effects and arcade screen shake.',
      'Reactions now float on a glowing white bubble signed with the sender’s username, from a docked React button.',
      'Turn clock calls out 30 and 10 seconds left, rings a bell at time’s up, and glows red in the final 10 seconds.',
      'Card effect animations play twice as fast and silently so turns keep moving.',
      'Wins throw confetti; losses bring rain with sign splashes and easy-to-read receipt text. New tie scenes for wide and portrait screens.',
      'Pages now change with a torn-paper wipe instead of a blank fade.',
      'Basic panels across the game use a full-resolution chalkboard texture with light chalk text.',
      'The app feels faster: screens stay loaded between visits, art warms up early, and mail and style saves show instantly.',
      'Fixed: desktop mouse-wheel scrolling, and green or cyan edges showing around animated art on iPhone Safari.',
    ],
    ...gift,
  },
  {
    version: '1.2',
    date: '2026-09-27',
    title: 'Crews Get Their Hands Up',
    artCardId: 'sherlock',
    overview: 'Water, Cellblock, the detectives and the Counterplay crew all got stronger, Inmate Kingpin stopped losing his stash, and five new characters moved onto the block.',
    buffs: [
      'Water crew: Puddle Runner, Rain Caller, Hydrant Medic and Floodgate Captain each gain +1 printed Hand.',
      'Cellblock: Inmate Crafty now gains +3 Hands when backed up by another Inmate or a support card; Inmate Boyfriend, Informant, Contraband and LeBron James all hit harder.',
      'Pinay Nurse is now 2 Motion / 3 Hands and Check In gives +3 Hands while cleansing freeze and silence.',
      'Crossing Guard, Laundromat Regular, Water Boy and Ice Cream Truck each gain +1 printed Hand.',
      'Demario and Luigion are both 2 / 3. Luigion eating a Mushroom now gives +2 Hands.',
      'Sherlock is now 2 Motion / 3 Hands, and Watson restores and Protects your weakest injured ally.',
      'Church Auntie’s Covered gives a Light ally +3 Hands (+2 for anyone else) and Protection.',
    ],
    changes: [
      'Inmate Kingpin (1 / 2): if no other Inmate is on board, he holds Contraband and passes it to the next Inmate you play instead of losing it.',
      'TRON’s For the Hood only refunds 1 Motion when all three allies actually gain Hands.',
      'Fixed: Soul Food and Pinay Nurse no longer skip a frozen or silenced ally that is tied for lowest Hands.',
      'New characters: Shotta, Balikbayan Box Bot, Lola, Repo Man and Mad Hatter, each with their own kit and upgrades.',
    ],
    ...gift,
  },
  {
    version: '1.3',
    date: '2026-09-28',
    title: 'Element Tune-Up',
    artCardId: 'goth-kid',
    overview: 'Three balance passes in one day. Water and Electric were a little too comfortable, so we trimmed their biggest payoffs and gave Light, Plant, Dark and the detectives more to work with.',
    buffs: [
      'Closet Nerd and Shotta each drop from 4 to 3 Motion.',
      'Mad Hatter drops to 2 Motion. Change Places! returns your weakest ally to hand with +1 Hand and a Motion discount on its next play.',
      'Goth Kid’s Dead Air moves to the first empty district and Silences the first enemy that shows up there.',
      'Rooftop Gardener, Matcha Freak and Performative Male each gain +1 printed Hand.',
      'Mansa Musa gives Earth allies +2 Hands (+1 for others) and makes your next card in another district 1 Motion cheaper.',
      'STUD’s Hold You Down now bonds with your weakest ally and takes a targeted hit for it.',
      'Queen of Hearts can now execute enemies with up to 6 Hands.',
    ],
    changes: [
      'Last Train Conductor’s move bonus is now +2 Hands, or +3 for Water.',
      'Alchy is now 2 Motion / 2 Hands. Gas Station Sushi Chef and TRON are now 3 / 2.',
      'Pirate Radio DJ’s second-Electric trigger no longer refunds Motion.',
      'Circuit Captain’s finished job gives each worker +1 Hand instead of +2.',
      'Wiretap loses its solo Motion refund.',
      'Fixed: interrupted Fairytale and Homecoming moves no longer pay out their arrival bonuses.',
      'iPad battles render more smoothly, with better quality settings and faster art loading.',
    ],
    ...gift,
  },
  {
    version: '1.4',
    date: '2026-09-28',
    title: 'Fadebook & Homies',
    artCardId: 'lola',
    overview: 'Squabblemon is social now. Pick a username, find your people on Fadebook, send Homie invites, and add opponents right after a match.',
    buffs: [
      'Fadebook: set a unique username and search for other players.',
      'Homies: send, accept and manage invites, and add your opponent from the result screen after a PvP match.',
    ],
    changes: [
      'Events board: send bugs, suggestions and general feedback straight to the team.',
      'The deck picker gives cards more room so you can see your crew while you build.',
      'Fixed: Fadebook search finds players both before and after they change their username, and old friend links keep working.',
    ],
    ...gift,
  },
  {
    version: '1.5',
    date: '2026-09-29',
    title: 'Red Night on the Block',
    artCardId: 'red-side-2',
    overview: 'Red Side and Blue Side sent new faces, and the Wizard gang brought the West with them. OG Red Night leads the crew and takes Hands every time he looks your way.',
    buffs: [
      'OG Red Night (2 / 3, Legendary): Eyes on the Crossing steals 1 Hand from the strongest enemy on reveal and at the start of the next two rounds.',
      'Red Plaid Petey (1 / 2) takes the shortcut to your weakest district, gains +1 Hand and makes your next Red Side card cheaper.',
      'Red Robber (2 / 3) deals 1 damage and has a 50% chance to call a second Robber into another district.',
      'Red Hexer (3 / 4) Weakens the strongest enemy; Ruby Shades (3 / 4) gives your weakest ally anywhere +2 Hands.',
      'Wicked Witch (4 / 5) blasts every buffed enemy for 2 and summons Flying Monkeys, who toss the weakest enemy out and Burn them.',
    ],
    changes: [
      'New Blue Side cards join the pool alongside the Red Side crew.',
      'OG Red Night’s steals are blocked by Protection and immunity. With no enemy present, he takes from your strongest other ally instead.',
      'Demario now summons a 2-Hand Mushroom from hand each round, plus two more when he is revealed.',
    ],
    ...gift,
  },
  {
    version: '1.6',
    date: '2026-09-29',
    title: 'Earn Your Block',
    artCardId: 'cracked-head',
    overview: 'Chapter One’s rivals are now yours to play. Beat them in story mode to put them in your collection, and every story fight pays out more than before.',
    buffs: [
      'Win Welcome to the Block to earn Ganger Blue (3 / 3): gives your weakest ally in another district +2 Hands and Protection.',
      'Win Receipts on Camera to earn Ganger Red (3 / 4): hits the strongest enemy for 2 and gains +1 Hand if it lands.',
      'Win Snitch at the Corner to earn Snitch (3 / 3, Mythical): Silences the strongest enemy, or Weakens it if already Silenced.',
      'Complete Block Crowned to earn Cracked Head (5 / 5, Legendary): damages up to three enemies and gains Hands for each hit.',
      'Every story fight now pays at least 100 Clout and 1 Street Pack Ticket. Bosses pay 200 Clout, and each chapter finale pays 250 Clout and 10 tickets.',
    ],
    changes: [
      'Already cleared those fights? Open the story map and any missing payout is added to your account.',
      'Story cards can join your saved crews, but they never drop from random packs. You have to earn them.',
      'Story battles gained new special-move videos, posters and reward reveals.',
      'Patch notes now live on the Events board, and every official patch arrives in Mailman with a gift you can claim once.',
    ],
    ...gift,
  },
];
