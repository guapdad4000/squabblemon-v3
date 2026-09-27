/** Curated assets only: clients send catalog IDs, never external URLs or text. */
export const REACTION_PACK_ID = 'reaction-pack';
export const REACTION_PACK_UNLOCK = 'reactions:block-talk';
export const REACTION_COOLDOWN_MS = 4000;
export const REACTION_DURATION_MS = 5000;
export const CHARACTER_REACTION_PACKS = [
  {
    "id": "reaction-pack:big-city-pigeon:v1",
    "name": "Big City Pigeon Reactions",
    "unlock": "reaction-pack:big-city-pigeon:v1",
    "price": 400,
    "reactionIds": [
      "reaction:big-city-pigeon:laugh:v1",
      "reaction:big-city-pigeon:rage:v1",
      "reaction:big-city-pigeon:shocked:v1",
      "reaction:big-city-pigeon:respect:v1"
    ]
  },
  {
    "id": "reaction-pack:dr-fade:v1",
    "name": "Dr. Fade Reactions",
    "unlock": "reaction-pack:dr-fade:v1",
    "price": 400,
    "reactionIds": [
      "reaction:dr-fade:laugh:v1",
      "reaction:dr-fade:rage:v1",
      "reaction:dr-fade:shocked:v1",
      "reaction:dr-fade:respect:v1"
    ]
  },
  {
    "id": "reaction-pack:buddy:v1",
    "name": "Buddy Reactions",
    "unlock": "reaction-pack:buddy:v1",
    "price": 400,
    "reactionIds": [
      "reaction:buddy:laugh:v1",
      "reaction:buddy:rage:v1",
      "reaction:buddy:shocked:v1",
      "reaction:buddy:respect:v1"
    ]
  }
] as const;
export const REACTION_PACKS = [{ id: REACTION_PACK_ID, name: 'Block Talk Reactions', unlock: REACTION_PACK_UNLOCK, price: 300, reactionIds: ['hold-that', 'too-smooth'] }, ...CHARACTER_REACTION_PACKS] as const;
export const REACTIONS = [
  { id: 'big-w', poster: 'assets/reactions/big-w.png', animatedWebp: null, packId: null, name: 'Big W', gif: 'assets/results/win-w.gif', starter: true },
  { id: 'lets-go', poster: 'assets/reactions/lets-go.png', animatedWebp: null, packId: null, name: "Let's go", gif: 'assets/training/inmate-quick.gif', starter: true },
  { id: 'hold-that', poster: 'assets/reactions/hold-that.png', animatedWebp: null, packId: REACTION_PACK_ID, name: 'Hold that L', gif: 'assets/results/loss-l.gif', starter: false },
  { id: 'too-smooth', poster: 'assets/reactions/too-smooth.png', animatedWebp: null, packId: REACTION_PACK_ID, name: 'Too smooth', gif: 'assets/training/inmate-moves.gif', starter: false },
{"id": "reaction:big-city-pigeon:laugh:v1", "name": "Big City Pigeon \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/big-city-pigeon/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/big-city-pigeon/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/big-city-pigeon/laugh.webp", "starter": false, "packId": "reaction-pack:big-city-pigeon:v1"},
{"id": "reaction:big-city-pigeon:rage:v1", "name": "Big City Pigeon \u2014 Rage", "gif": "assets/reactions/character-pack-v1/big-city-pigeon/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/big-city-pigeon/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/big-city-pigeon/rage.webp", "starter": false, "packId": "reaction-pack:big-city-pigeon:v1"},
{"id": "reaction:big-city-pigeon:shocked:v1", "name": "Big City Pigeon \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/big-city-pigeon/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/big-city-pigeon/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/big-city-pigeon/shocked.webp", "starter": false, "packId": "reaction-pack:big-city-pigeon:v1"},
{"id": "reaction:big-city-pigeon:respect:v1", "name": "Big City Pigeon \u2014 Respect", "gif": "assets/reactions/character-pack-v1/big-city-pigeon/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/big-city-pigeon/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/big-city-pigeon/respect.webp", "starter": false, "packId": "reaction-pack:big-city-pigeon:v1"},
{"id": "reaction:dr-fade:laugh:v1", "name": "Dr. Fade \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/dr-fade/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/dr-fade/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/dr-fade/laugh.webp", "starter": false, "packId": "reaction-pack:dr-fade:v1"},
{"id": "reaction:dr-fade:rage:v1", "name": "Dr. Fade \u2014 Rage", "gif": "assets/reactions/character-pack-v1/dr-fade/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/dr-fade/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/dr-fade/rage.webp", "starter": false, "packId": "reaction-pack:dr-fade:v1"},
{"id": "reaction:dr-fade:shocked:v1", "name": "Dr. Fade \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/dr-fade/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/dr-fade/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/dr-fade/shocked.webp", "starter": false, "packId": "reaction-pack:dr-fade:v1"},
{"id": "reaction:dr-fade:respect:v1", "name": "Dr. Fade \u2014 Respect", "gif": "assets/reactions/character-pack-v1/dr-fade/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/dr-fade/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/dr-fade/respect.webp", "starter": false, "packId": "reaction-pack:dr-fade:v1"},
{"id": "reaction:buddy:laugh:v1", "name": "Buddy \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/buddy/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/buddy/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/buddy/laugh.webp", "starter": false, "packId": "reaction-pack:buddy:v1"},
{"id": "reaction:buddy:rage:v1", "name": "Buddy \u2014 Rage", "gif": "assets/reactions/character-pack-v1/buddy/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/buddy/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/buddy/rage.webp", "starter": false, "packId": "reaction-pack:buddy:v1"},
{"id": "reaction:buddy:shocked:v1", "name": "Buddy \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/buddy/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/buddy/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/buddy/shocked.webp", "starter": false, "packId": "reaction-pack:buddy:v1"},
{"id": "reaction:buddy:respect:v1", "name": "Buddy \u2014 Respect", "gif": "assets/reactions/character-pack-v1/buddy/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/buddy/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/buddy/respect.webp", "starter": false, "packId": "reaction-pack:buddy:v1"}
] as const;
export type ReactionId = typeof REACTIONS[number]['id'];
export type ReactionSeat = 'player' | 'cpu';
export type ReactionEvent = { id: string; reactionId: ReactionId; seat: ReactionSeat; sentAt: number; gameNumber: number };
export type ReactionChannel = { revision: number; latest: Partial<Record<ReactionSeat, ReactionEvent>> };
export type ReactionView = ReactionChannel & { serverTime: number; owned: ReactionId[] };
export const reactionById = (id: string) => REACTIONS.find(reaction => reaction.id === id);
export function ownedReactions(unlocks: readonly string[] = []): ReactionId[] {
  return REACTIONS.filter(r => r.starter || REACTION_PACKS.some(pack => pack.id === r.packId && unlocks.includes(pack.unlock))).map(r => r.id);
}
export class ReactionError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function addReaction(channel: ReactionChannel | undefined, input: { id: string; reactionId: string; seat: ReactionSeat; gameNumber: number }, owned: readonly string[], now: number): ReactionChannel {
  const current = channel ?? { revision: 0, latest: {} };
  const previous = current.latest[input.seat];
  if (previous?.id === input.id) {
    if (previous.reactionId !== input.reactionId || previous.gameNumber !== input.gameNumber) throw new ReactionError('This request was already used.', 409);
    return current;
  }
  const reaction = reactionById(input.reactionId);
  if (!reaction) throw new ReactionError('Unknown reaction.');
  if (!owned.includes(reaction.id)) throw new ReactionError('Unlock this reaction first.', 403);
  if (previous && now - previous.sentAt < REACTION_COOLDOWN_MS) throw new ReactionError('Give the room a moment before reacting again.', 429);
  return { revision: current.revision + 1, latest: { ...current.latest, [input.seat]: { ...input, reactionId: reaction.id, sentAt: now } } };
}
