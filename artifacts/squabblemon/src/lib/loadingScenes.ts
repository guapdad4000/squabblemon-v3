import { loadingScenes } from './broadcastCatalog';

export type LoadingScene = (typeof loadingScenes)[number];

const LAST_SCENE_KEY = 'squabblemon:last-loading-scene';
const EPISODE_RELEASE_MS = 900;
let activeScene: LoadingScene | undefined;
let holders = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

function previousSceneId(): string | null {
  try { return window.localStorage.getItem(LAST_SCENE_KEY); }
  catch { return null; }
}

function rememberScene(id: string) {
  try { window.localStorage.setItem(LAST_SCENE_KEY, id); }
  catch { /* Storage can be unavailable in private or embedded sessions. */ }
}

/** Selection is an episode decision, not a render/phase decision. */
export function currentLoadingScene(): LoadingScene {
  if (activeScene) return activeScene;
  if (!loadingScenes.length) throw new Error('A loading scene is required');
  const root = typeof document === 'undefined' ? null : document.getElementById('root');
  const bootScene = loadingScenes.find(scene => scene.id === root?.dataset.bootLoadingScene);
  if (root) delete root.dataset.bootLoadingScene;
  if (bootScene) {
    activeScene = bootScene;
    return activeScene;
  }
  const previous = previousSceneId();
  const previousIndex = loadingScenes.findIndex(scene => scene.id === previous);
  // Cycle instead of random choice: every supplied street appears across visits,
  // including after hard reloads, with no immediate repeat.
  activeScene = loadingScenes[(previousIndex + 1) % loadingScenes.length];
  rememberScene(activeScene.id);
  return activeScene;
}

/** Adjacent loader remounts share an episode; a real absence ends it. */
export function retainLoadingEpisode(): () => void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = undefined;
  holders += 1;
  return () => {
    holders = Math.max(0, holders - 1);
    if (holders !== 0) return;
    releaseTimer = setTimeout(() => {
      if (holders === 0) activeScene = undefined;
      releaseTimer = undefined;
    }, EPISODE_RELEASE_MS);
  };
}