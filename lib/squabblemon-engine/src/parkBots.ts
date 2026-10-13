import { getDistrictResults, type CardInstance } from "./gameEngine";
import type { OnlineRoom } from "./multiplayer";
import { addReaction } from "./reactions";

export const PARK_BOT_PERSONAS = [
  {
    id: "coach",
    name: "Coach Fade",
    avatarKey: "dr-fade",
    bannerCardId: "dr-fade",
    reactionCharacter: "dr-fade",
    pace: 650,
    squabbleRound: 5,
    personality: "Patient coach · respects clean plays",
  },
  {
    id: "loudmouth",
    name: "Loudmouth Kyle",
    avatarKey: "kyle",
    bannerCardId: "kyle",
    reactionCharacter: "kyle",
    pace: 850,
    squabbleRound: 3,
    personality: "Talks big · gets loud on a comeback",
  },
  {
    id: "greenhouse",
    name: "Greenhouse Buddy",
    avatarKey: "buddy",
    bannerCardId: "buddy",
    reactionCharacter: "buddy",
    pace: 1000,
    squabbleRound: 4,
    personality: "Easygoing · appreciates clever support",
  },
  {
    id: "auntie",
    name: "Sunday Auntie",
    avatarKey: "church-auntie",
    bannerCardId: "church-auntie",
    reactionCharacter: "church-auntie",
    pace: 750,
    squabbleRound: 4,
    personality: "Competitive · never lets a swing slide",
  },
] as const;
export function parkBotPersona(id?: string) {
  return (
    PARK_BOT_PERSONAS.find((persona) => persona.id === id) ??
    PARK_BOT_PERSONAS[0]
  );
}
export function parkBotUsesSquabble(
  room: OnlineRoom,
  card?: CardInstance | null,
): boolean {
  return Boolean(
    room.match &&
    card &&
    card.kind !== "blockbuster" &&
    card.cardId !== "sideofhands" &&
    !room.match.squabbleByOwner?.cpu &&
    room.match.round >= parkBotPersona(room.ranked?.botPersona).squabbleRound &&
    card.basePower >= 4,
  );
}
/** Public board events only; no hand inspection, at most three reactions in a match. */
export function reactParkBot(
  before: OnlineRoom,
  after: OnlineRoom,
  now: number,
): OnlineRoom {
  if (
    !after.ranked?.bot ||
    !after.match ||
    after.status !== "active" ||
    !before.match ||
    (after.ranked.botReactionCount ?? 0) >= 3 ||
    now - (after.reactions?.latest.cpu?.sentAt ?? -Infinity) < 12_000
  )
    return after;
  const oldScore = getDistrictResults(before.match).filter(
    (d) => d.winner === "cpu",
  ).length;
  const newScore = getDistrictResults(after.match).filter(
    (d) => d.winner === "cpu",
  ).length;
  const bigPlay =
    !before.match.squabbleByOwner?.player &&
    after.match.squabbleByOwner?.player;
  const mood = bigPlay
    ? "shocked"
    : oldScore >= 2 && newScore < 2
      ? "rage"
      : oldScore < 2 && newScore >= 2
        ? "laugh"
        : after.match.round > before.match.round && after.match.round % 2 === 0
          ? "respect"
          : null;
  if (!mood) return after;
  const persona = parkBotPersona(after.ranked.botPersona);
  const reactionId = `reaction:${persona.reactionCharacter}:${mood}:v1`;
  const reactions = addReaction(
    after.reactions,
    {
      id: `park:${after.gameNumber}:${after.revision}`,
      reactionId,
      seat: "cpu",
      gameNumber: after.gameNumber,
    },
    [reactionId],
    now,
  );
  return {
    ...after,
    reactions,
    ranked: {
      ...after.ranked,
      botReactionCount: (after.ranked.botReactionCount ?? 0) + 1,
    },
  };
}
