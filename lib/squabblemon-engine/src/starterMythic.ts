/** Permanent campaign reward, independent of daily login and calendar time. */
export const STARTER_MYTHIC = Object.freeze({
  key: 'starter-mythic:nothing-to-lose:v1',
  title: 'Nothing to Lose',
  cardId: 'homeless-guy',
  targetChapterId: 'old-heads-know',
  softCurrency: 1000,
  packTickets: 3,
  duplicateShards: 25,
});
export const STARTER_MYTHIC_CHAPTERS = ['block-party', 'red-side-tapes', 'blue-side-blues', 'side-show', 'old-heads-know'] as const;
export type StarterMythicStatus = {
  state: 'locked' | 'ready' | 'claimed';
  chapters: { id: string; reached: boolean; completed: boolean }[];
  ownsCard: boolean;
};
export function starterMythicStatus(chapters: readonly { id: string; status: string }[], claimed: boolean, ownsCard: boolean): StarterMythicStatus {
  const route = STARTER_MYTHIC_CHAPTERS.map(id => {
    const status = chapters.find(chapter => chapter.id === id)?.status;
    return { id, reached: status === 'available' || status === 'cleared', completed: status === 'cleared' };
  });
  return { state: claimed ? 'claimed' : route[4].reached ? 'ready' : 'locked', chapters: route, ownsCard };
}
