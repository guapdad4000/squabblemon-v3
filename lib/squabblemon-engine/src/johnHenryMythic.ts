/** A second permanent Mythical roadmap, earned by clearing the original campaign. */
export const JOHN_HENRY_MYTHIC = Object.freeze({
  key: "mythic:steel-driver:v1",
  title: "Steel Driver",
  cardId: "john-henry",
  targetChapterId: "the-crown",
  softCurrency: 1500,
  packTickets: 5,
  duplicateShards: 50,
});
export const JOHN_HENRY_CHAPTERS = [
  "block-party",
  "red-side-tapes",
  "blue-side-blues",
  "side-show",
  "old-heads-know",
  "the-function",
  "return-of-the-block",
  "the-crown",
] as const;
export type JohnHenryMythicStatus = {
  state: "locked" | "ready" | "claimed";
  ownsCard: boolean;
  chapters: { id: string; reached: boolean; completed: boolean }[];
};
export function johnHenryMythicStatus(
  chapters: readonly { id: string; status: string }[],
  claimed: boolean,
  ownsCard: boolean,
): JohnHenryMythicStatus {
  const route = JOHN_HENRY_CHAPTERS.map((id) => {
    const status = chapters.find((c) => c.id === id)?.status;
    return {
      id,
      reached: status === "available" || status === "cleared",
      completed: status === "cleared",
    };
  });
  return {
    state: claimed
      ? "claimed"
      : route.every((c) => c.completed)
        ? "ready"
        : "locked",
    ownsCard,
    chapters: route,
  };
}
