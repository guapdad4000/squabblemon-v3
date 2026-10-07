export const starterChapterIds = ['block-party', 'red-side-tapes', 'blue-side-blues', 'side-show', 'old-heads-know'];
export const johnChapterIds = [...starterChapterIds, 'the-function', 'return', 'the-crown'];
export const mythicStatus = (state, ids, owns = false) => ({ state, ownsCard: owns || state === 'claimed', chapters: ids.map((id, i) => ({ id, reached: state !== 'locked' || i === 0, completed: state !== 'locked' })) });
export const accountStatus = {
  date: new Date().toISOString().slice(0, 10), streak: 1, claimedToday: false,
  nextResetAt: new Date(Date.now() + 86400000).toISOString(), pending: [],
  growth: { water: 0, ready: false, wateredToday: false, totalPlants: 0, plantsInGarden: 0, gardenNumber: 1, completedGardens: 0,
    tasks: ['login', 'daily-show-up', 'daily-take-room'].map(key => ({ key, complete: false, progress: 0, goal: 1 })) },
};
export const popupApiResponse = path => path.endsWith('/starter-mythic') ? mythicStatus('locked', starterChapterIds)
  : path.endsWith('/john-henry') ? mythicStatus('locked', johnChapterIds)
  : path.endsWith('/account') ? accountStatus : {};
