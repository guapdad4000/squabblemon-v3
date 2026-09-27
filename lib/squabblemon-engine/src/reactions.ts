/** Curated assets only: clients send catalog IDs, never external URLs or text. */
export const REACTION_PACK_ID = 'reaction-pack';
export const REACTION_PACK_UNLOCK = 'reactions:block-talk';
export const REACTION_COOLDOWN_MS = 4000;
export const REACTION_DURATION_MS = 5000;

export const REACTION_TRAY_SIZE = 4;
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
  },
{"id": "reaction-pack:ashlee:v1", "name": "Ashlee Reactions", "unlock": "reaction-pack:ashlee:v1", "price": 400, "reactionIds": ["reaction:ashlee:laugh:v1", "reaction:ashlee:rage:v1", "reaction:ashlee:shocked:v1", "reaction:ashlee:respect:v1"]},
{"id": "reaction-pack:buttahs:v1", "name": "Timberland Boot (Buttahs) Reactions", "unlock": "reaction-pack:buttahs:v1", "price": 400, "reactionIds": ["reaction:buttahs:laugh:v1", "reaction:buttahs:rage:v1", "reaction:buttahs:shocked:v1", "reaction:buttahs:respect:v1"]},
{"id": "reaction-pack:guap:v1", "name": "Guap Reactions", "unlock": "reaction-pack:guap:v1", "price": 400, "reactionIds": ["reaction:guap:laugh:v1", "reaction:guap:rage:v1", "reaction:guap:shocked:v1", "reaction:guap:respect:v1"]},
{"id": "reaction-pack:cologne-criminal:v1", "name": "Cologne Criminal Reactions", "unlock": "reaction-pack:cologne-criminal:v1", "price": 400, "reactionIds": ["reaction:cologne-criminal:laugh:v1", "reaction:cologne-criminal:rage:v1", "reaction:cologne-criminal:shocked:v1", "reaction:cologne-criminal:respect:v1"]},
{"id": "reaction-pack:kyle:v1", "name": "Kyle Reactions", "unlock": "reaction-pack:kyle:v1", "price": 400, "reactionIds": ["reaction:kyle:laugh:v1", "reaction:kyle:rage:v1", "reaction:kyle:shocked:v1", "reaction:kyle:respect:v1"]},
{"id": "reaction-pack:church-auntie:v1", "name": "Church Auntie Reactions", "unlock": "reaction-pack:church-auntie:v1", "price": 400, "reactionIds": ["reaction:church-auntie:laugh:v1", "reaction:church-auntie:rage:v1", "reaction:church-auntie:shocked:v1", "reaction:church-auntie:respect:v1"]}
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
{"id": "reaction:buddy:respect:v1", "name": "Buddy \u2014 Respect", "gif": "assets/reactions/character-pack-v1/buddy/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/buddy/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/buddy/respect.webp", "starter": false, "packId": "reaction-pack:buddy:v1"},
{"id": "reaction:ashlee:laugh:v1", "name": "Ashlee \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/ashlee/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/ashlee/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/ashlee/laugh.webp", "starter": false, "packId": "reaction-pack:ashlee:v1"},
{"id": "reaction:ashlee:rage:v1", "name": "Ashlee \u2014 Rage", "gif": "assets/reactions/character-pack-v1/ashlee/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/ashlee/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/ashlee/rage.webp", "starter": false, "packId": "reaction-pack:ashlee:v1"},
{"id": "reaction:ashlee:shocked:v1", "name": "Ashlee \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/ashlee/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/ashlee/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/ashlee/shocked.webp", "starter": false, "packId": "reaction-pack:ashlee:v1"},
{"id": "reaction:ashlee:respect:v1", "name": "Ashlee \u2014 Respect", "gif": "assets/reactions/character-pack-v1/ashlee/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/ashlee/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/ashlee/respect.webp", "starter": false, "packId": "reaction-pack:ashlee:v1"},
{"id": "reaction:buttahs:laugh:v1", "name": "Timberland Boot (Buttahs) \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/buttahs/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/buttahs/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/buttahs/laugh.webp", "starter": false, "packId": "reaction-pack:buttahs:v1"},
{"id": "reaction:buttahs:rage:v1", "name": "Timberland Boot (Buttahs) \u2014 Rage", "gif": "assets/reactions/character-pack-v1/buttahs/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/buttahs/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/buttahs/rage.webp", "starter": false, "packId": "reaction-pack:buttahs:v1"},
{"id": "reaction:buttahs:shocked:v1", "name": "Timberland Boot (Buttahs) \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/buttahs/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/buttahs/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/buttahs/shocked.webp", "starter": false, "packId": "reaction-pack:buttahs:v1"},
{"id": "reaction:buttahs:respect:v1", "name": "Timberland Boot (Buttahs) \u2014 Respect", "gif": "assets/reactions/character-pack-v1/buttahs/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/buttahs/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/buttahs/respect.webp", "starter": false, "packId": "reaction-pack:buttahs:v1"},
{"id": "reaction:guap:laugh:v1", "name": "Guap \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/guap/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/guap/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/guap/laugh.webp", "starter": false, "packId": "reaction-pack:guap:v1"},
{"id": "reaction:guap:rage:v1", "name": "Guap \u2014 Rage", "gif": "assets/reactions/character-pack-v1/guap/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/guap/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/guap/rage.webp", "starter": false, "packId": "reaction-pack:guap:v1"},
{"id": "reaction:guap:shocked:v1", "name": "Guap \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/guap/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/guap/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/guap/shocked.webp", "starter": false, "packId": "reaction-pack:guap:v1"},
{"id": "reaction:guap:respect:v1", "name": "Guap \u2014 Respect", "gif": "assets/reactions/character-pack-v1/guap/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/guap/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/guap/respect.webp", "starter": false, "packId": "reaction-pack:guap:v1"},
{"id": "reaction:cologne-criminal:laugh:v1", "name": "Cologne Criminal \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/cologne-criminal/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/cologne-criminal/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/cologne-criminal/laugh.webp", "starter": false, "packId": "reaction-pack:cologne-criminal:v1"},
{"id": "reaction:cologne-criminal:rage:v1", "name": "Cologne Criminal \u2014 Rage", "gif": "assets/reactions/character-pack-v1/cologne-criminal/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/cologne-criminal/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/cologne-criminal/rage.webp", "starter": false, "packId": "reaction-pack:cologne-criminal:v1"},
{"id": "reaction:cologne-criminal:shocked:v1", "name": "Cologne Criminal \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/cologne-criminal/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/cologne-criminal/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/cologne-criminal/shocked.webp", "starter": false, "packId": "reaction-pack:cologne-criminal:v1"},
{"id": "reaction:cologne-criminal:respect:v1", "name": "Cologne Criminal \u2014 Respect", "gif": "assets/reactions/character-pack-v1/cologne-criminal/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/cologne-criminal/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/cologne-criminal/respect.webp", "starter": false, "packId": "reaction-pack:cologne-criminal:v1"},
{"id": "reaction:kyle:laugh:v1", "name": "Kyle \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/kyle/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/kyle/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/kyle/laugh.webp", "starter": false, "packId": "reaction-pack:kyle:v1"},
{"id": "reaction:kyle:rage:v1", "name": "Kyle \u2014 Rage", "gif": "assets/reactions/character-pack-v1/kyle/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/kyle/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/kyle/rage.webp", "starter": false, "packId": "reaction-pack:kyle:v1"},
{"id": "reaction:kyle:shocked:v1", "name": "Kyle \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/kyle/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/kyle/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/kyle/shocked.webp", "starter": false, "packId": "reaction-pack:kyle:v1"},
{"id": "reaction:kyle:respect:v1", "name": "Kyle \u2014 Respect", "gif": "assets/reactions/character-pack-v1/kyle/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/kyle/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/kyle/respect.webp", "starter": false, "packId": "reaction-pack:kyle:v1"},
{"id": "reaction:church-auntie:laugh:v1", "name": "Church Auntie \u2014 Laugh", "gif": "assets/reactions/character-pack-v1/church-auntie/laugh.gif", "animatedWebp": "assets/reactions/character-pack-v1/church-auntie/laugh-animated.webp", "poster": "assets/reactions/character-pack-v1/church-auntie/laugh.webp", "starter": false, "packId": "reaction-pack:church-auntie:v1"},
{"id": "reaction:church-auntie:rage:v1", "name": "Church Auntie \u2014 Rage", "gif": "assets/reactions/character-pack-v1/church-auntie/rage.gif", "animatedWebp": "assets/reactions/character-pack-v1/church-auntie/rage-animated.webp", "poster": "assets/reactions/character-pack-v1/church-auntie/rage.webp", "starter": false, "packId": "reaction-pack:church-auntie:v1"},
{"id": "reaction:church-auntie:shocked:v1", "name": "Church Auntie \u2014 Shocked", "gif": "assets/reactions/character-pack-v1/church-auntie/shocked.gif", "animatedWebp": "assets/reactions/character-pack-v1/church-auntie/shocked-animated.webp", "poster": "assets/reactions/character-pack-v1/church-auntie/shocked.webp", "starter": false, "packId": "reaction-pack:church-auntie:v1"},
{"id": "reaction:church-auntie:respect:v1", "name": "Church Auntie \u2014 Respect", "gif": "assets/reactions/character-pack-v1/church-auntie/respect.gif", "animatedWebp": "assets/reactions/character-pack-v1/church-auntie/respect-animated.webp", "poster": "assets/reactions/character-pack-v1/church-auntie/respect.webp", "starter": false, "packId": "reaction-pack:church-auntie:v1"}
] as const;
export type ReactionId = typeof REACTIONS[number]['id'];
export type ReactionSeat = 'player' | 'cpu';
export type ReactionEvent = { id: string; reactionId: ReactionId; seat: ReactionSeat; sentAt: number; gameNumber: number };
export type ReactionChannel = { revision: number; latest: Partial<Record<ReactionSeat, ReactionEvent>> };
export type ReactionView = ReactionChannel & { serverTime: number; owned: ReactionId[]; tray: ReactionId[] };
export const reactionById = (id: string) => REACTIONS.find(reaction => reaction.id === id);
export function ownedReactions(unlocks: readonly string[] = []): ReactionId[] {
  return REACTIONS.filter(r => r.starter || REACTION_PACKS.some(pack => pack.id === r.packId && unlocks.includes(pack.unlock))).map(r => r.id);
}

/** An absent legacy preference gets starters; a deliberately empty tray stays empty. */
export function resolveReactionTray(saved: unknown, unlockedCosmeticIds: readonly string[] = []): ReactionId[] {
  if (!Array.isArray(saved)) return ['big-w', 'lets-go'];
  const owned = new Set(ownedReactions(unlockedCosmeticIds));
  const tray: ReactionId[] = [];
  for (const id of saved) {
    const reaction = typeof id === 'string' ? reactionById(id) : undefined;
    if (reaction && owned.has(reaction.id) && !tray.includes(reaction.id)) tray.push(reaction.id);
    if (tray.length === REACTION_TRAY_SIZE) break;
  }
  return tray;
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
