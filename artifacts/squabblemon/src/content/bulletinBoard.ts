export type BulletinLink = { label: string; href: string };

export const FEEDBACK_HREF = '/game/events?section=feedback';
export const FEEDBACK_SECTION_ID = 'events-feedback';

export type BulletinEvent = {
  id: string;
  kind: 'event';
  status: 'available' | 'update' | 'planned';
  eyebrow: string;
  title: string;
  statusLabel: string;
  summary: string;
  image: string;
  sticker: string;
  accent: 'red' | 'yellow' | 'green';
  details: string;
  availability: readonly string[];
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
  link: BulletinLink;
};

/**
 * Canonical Safehouse board content. Everything here must describe something a
 * player can actually do today, or be clearly marked as planned. Bump
 * `edition` whenever a new post should light the NEW marker in the room.
 */
export const bulletinBoard = {
  edition: '2026-10-30-kumite-breakthrough-beta',
  updatedLabel: 'Kumite Breakthrough · Beta in preparation',
  events: [
    {
      id: 'kumite-breakthrough-beta',
      kind: 'event',
      status: 'planned',
      eyebrow: 'New mode · Beta in preparation',
      title: 'Kumite Breakthrough',
      statusLabel: 'Public matchmaking not yet open',
      summary: 'Three lanes. Refilling Motion. Two breaches to win. Get to know the new real-time fight.',
      image: 'assets/events/kumite-breakthrough-patch-1-15.webp',
      sticker: 'BETA',
      accent: 'yellow',
      details: 'Both sides play at once. Build a push, defend your base and fight through the final 30-second Last Stand. This is a separate mode from the weekly Kumite bracket and ordinary Fade Park PvP.',
      availability: ['Read the full rules below', 'Online queue and progression remain in preparation', 'Patch 1.15 mail gift after publication: 1 Street Pack Ticket + 50 Clout'],
      link: { label: 'Explore Kumite', href: '/game/kumite' },
    },
    {
      id: 'block-party-weekend',
      kind: 'event',
      status: 'available',
      eyebrow: 'Available now',
      title: 'Block Party',
      statusLabel: 'Open any time · No schedule',
      summary: 'The Fadecade arcade challenges are open. Pick a cabinet, bring a legal gang, and put the new roster balance under pressure.',
      image: 'assets/layered/festival-street.webp',
      sticker: 'OPEN',
      accent: 'red',
      details: 'Block Party points you at the existing Fadecade challenges. There is no timed window and no community total: run challenges whenever you like, with whichever legal gang you like.',
      availability: ['Existing Fadecade arcade challenges', 'Any legal gang can enter', 'No start or end date'],
      link: { label: 'Enter the Fadecade', href: '/game/challenges' },
    },
    {
      id: 'rules-1-1-roster-pass',
      kind: 'event',
      status: 'update',
      eyebrow: 'Available update',
      title: 'Rules 1.1 · Roster Pass',
      statusLabel: 'Available update',
      summary: 'A roster balance pass is in the game. Blockbusters were tuned and timing windows clarified, so it is a good moment to revisit your gangs.',
      image: 'brand/squabblemon-standard-gold-share.jpg',
      sticker: '1.1',
      accent: 'yellow',
      details: 'The Rules 1.1 roster pass gives underplayed identities clearer jobs. Your saved gangs still work; open the gang builder to see how your lines hold up.',
      availability: ['Roster balance changes', 'Blockbuster tuning', 'Clarified timing windows'],
      link: { label: 'Open gang builder', href: '/game/decks' },
    },
    {
      id: 'ranked-fight-night',
      kind: 'event',
      status: 'planned',
      eyebrow: 'Planned',
      title: 'Friday Fight Night',
      statusLabel: 'Planned · No date set',
      summary: 'A community fight night is planned. There is no date or reward yet. Online play is open now if you want matches today.',
      image: 'assets/fight-night/rooms/rooftop-court.webp',
      sticker: 'PLANNED',
      accent: 'green',
      details: 'Fight Night is an idea on the wall, not a scheduled event. We have not set a date, format, or rewards. The button below opens the online play that already exists.',
      availability: ['Planned: no date announced', 'No rewards promised', 'Online play is available now'],
      link: { label: 'Open online play', href: '/game/online' },
    },
  ] satisfies readonly BulletinEvent[],
  developerPosts: [
    {
      id: 'roadmap-fall-2026',
      kind: 'developer',
      eyebrow: 'Roadmap',
      title: 'What we are thinking about next',
      publishedLabel: 'From the dev room',
      summary: 'These are ideas on the wall, not promises. Tell us which ones matter to you.',
      bullets: [
        'Rotating event objectives',
        'Season brackets, spectator tools, and match replays',
        'More story chapters around the neighborhood',
      ],
      image: 'assets/characters/promoter.webp',
      sticker: 'WIP',
      link: { label: 'Share a roadmap suggestion', href: FEEDBACK_HREF },
    },
    {
      id: 'dev-note-balance',
      kind: 'developer',
      eyebrow: 'Dev message',
      title: 'Keep sending the receipts',
      publishedLabel: 'Balance team',
      summary: 'Rules 1.1 is a starting line. We are watching deck diversity, first player advantage, and every Blockbuster that turns a close match into a lock.',
      sticker: 'NOTE',
      link: { label: 'Send balance feedback', href: FEEDBACK_HREF },
    },
  ] satisfies readonly DeveloperPost[],
} as const;

export const BULLETIN_SEEN_STORAGE_KEY = 'squabblemon_bulletin_seen';
