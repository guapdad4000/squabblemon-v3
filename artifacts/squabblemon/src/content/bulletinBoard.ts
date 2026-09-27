export type BulletinLink = { label: string; href: string };

export type BulletinEvent = {
  id: string;
  kind: 'event';
  status: 'live' | 'upcoming';
  eyebrow: string;
  title: string;
  dateLabel: string;
  summary: string;
  image: string;
  sticker: string;
  accent: 'red' | 'yellow' | 'green';
  details: string;
  schedule: readonly string[];
  reward: string;
  link: BulletinLink;
};

export type DeveloperPost = {
  id: string;
  kind: 'developer';
  eyebrow: string;
  title: string;
  publishedLabel: string;
  summary: string;
  bullets?: readonly string[];
  image?: string;
  sticker: string;
  link?: BulletinLink;
};

/**
 * Safehouse news lives in one small feed so events and developer notes can be
 * updated without touching the board component. Bump `edition` whenever a new
 * post should light the NEW marker in the room.
 */
export const bulletinBoard = {
  edition: '2026-09-26-rules-1-1',
  updatedLabel: 'Updated September 26, 2026',
  events: [
    {
      id: 'block-party-weekend',
      kind: 'event',
      status: 'live',
      eyebrow: 'Featured event',
      title: 'Block Party Weekend',
      dateLabel: 'Live now · Ends September 29',
      summary: 'Run the Fadecade, stack event wins, and put the new roster balance through real neighborhood pressure.',
      image: 'assets/layered/festival-street.webp',
      sticker: 'LIVE',
      accent: 'red',
      details: 'Every completed set adds to the neighborhood total. Bring any legal gang, finish the card, and help unlock the community reward before the block closes.',
      schedule: ['Open queue all weekend', 'Bonus window: 6–9 PM PT', 'Community total updates hourly'],
      reward: 'Event wins, bonus Clout, and a community pack ticket',
      link: { label: 'Hit the Fadecade', href: '/game/challenges' },
    },
    {
      id: 'rules-1-1-roster-pass',
      kind: 'event',
      status: 'live',
      eyebrow: 'Game update',
      title: 'Rules 1.1 · Roster Pass',
      dateLabel: 'Live on the block',
      summary: 'Forty cards were buffed, rebuilt, or clarified. Blockbusters now hit harder without ending the conversation.',
      image: 'brand/squabblemon-standard-gold-share.jpg',
      sticker: '40×',
      accent: 'yellow',
      details: 'The Rules 1.1 roster pass touches every district and gives underplayed identities clearer jobs. Your saved gangs still work, but the board is wide open for new lines.',
      schedule: ['40 card updates', 'Blockbuster tuning', 'Clarified timing windows'],
      reward: 'A healthier field and more viable gang combinations',
      link: { label: 'Rebuild your gang', href: '/game/decks' },
    },
    {
      id: 'ranked-fight-night',
      kind: 'event',
      status: 'upcoming',
      eyebrow: 'Coming up',
      title: 'Friday Fight Night',
      dateLabel: 'October 2 · 6 PM PT',
      summary: 'A ranked community window with bonus Clout for completing a full set. Wins help, finishing the card matters more.',
      image: 'assets/fight-night/rooms/rooftop-court.webp',
      sticker: 'NEXT',
      accent: 'green',
      details: 'Fight Night is a scheduled ranked window built around complete sets instead of quick farming. Play the whole card to bank the best event payout.',
      schedule: ['Check-in: 5:45 PM PT', 'Main card: 6–8 PM PT', 'Rewards settle at 8:15 PM PT'],
      reward: 'Completion Clout plus a clean-card bonus',
      link: { label: 'Scout Fight Night', href: '/game/online' },
    },
  ] satisfies readonly BulletinEvent[],
  developerPosts: [
    {
      id: 'roadmap-fall-2026',
      kind: 'developer',
      eyebrow: 'Roadmap',
      title: 'What we’re building next',
      publishedLabel: 'From the dev room · September 26',
      summary: 'The board is phase one of a living events system. Here is what is on the wall after it.',
      bullets: [
        'Rotating event objectives and limited reward tracks',
        'Season brackets, spectator tools, and match replays',
        'More story chapters with neighborhood specific rewards',
      ],
      image: 'assets/characters/promoter.webp',
      sticker: 'WIP',
    },
    {
      id: 'dev-note-balance',
      kind: 'developer',
      eyebrow: 'Dev message',
      title: 'Keep sending the receipts',
      publishedLabel: 'Balance team · September 26',
      summary: 'Rules 1.1 is a starting line. We are watching deck diversity, first player advantage, and every Blockbuster that turns a close match into a lock.',
      sticker: 'NOTE',
      link: { label: 'Test the new roster', href: '/game/decks' },
    },
  ] satisfies readonly DeveloperPost[],
} as const;

export const BULLETIN_SEEN_STORAGE_KEY = 'squabblemon_bulletin_seen';
