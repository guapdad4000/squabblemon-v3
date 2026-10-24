import { getAssetUrl } from './assets';

const paths = ['defeat-impact-atlas', 'defeat-tombstone-atlas'] as const;
let ready = false;
let pending: Promise<boolean> | null = null;
export const isDefeatMediaReady = () => ready;

/** Two imminent combat atlases bypass the background collection-art queue. */
export function warmDefeatMedia(): Promise<boolean> {
  if (ready) return Promise.resolve(true);
  if (pending) return pending;
  if (typeof Image === 'undefined') return Promise.resolve(false);
  pending = Promise.all(paths.map(path => new Promise<boolean>(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => { image.removeAttribute('src'); finish(false); }, 8000);
    image.onerror = () => finish(false);
    image.onload = () => {
      if (image.decode) void image.decode().then(() => finish(true), () => finish(false));
      else finish(true);
    };
    image.src = getAssetUrl(`assets/combat/supplied/${path}.webp`);
  }))).then(results => {
    ready = results.every(Boolean);
    pending = null; // A later effect can retry a failed or timed-out request.
    return ready;
  });
  return pending;
}
