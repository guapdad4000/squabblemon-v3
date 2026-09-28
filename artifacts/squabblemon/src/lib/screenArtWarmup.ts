import { getAssetUrl } from './assets';
import { isBattleActive, warmImages } from './imageWarmup';
import collectionSunset from '../assets/collection-sunset-standoff.webp';

/** Signature art for the main screens, fetched at low priority once the game is idle. */
const SCREEN_ART = [
  'assets/bounty-hunter/hero.webp',
  'assets/buddy-growth/buddy-welcome.webp',
  'assets/layered/button-obsidian.webp',
  'assets/layered/button-stone.webp',
  'assets/layered/motion-medallion.webp',
  'assets/layered/card-rim.webp',
  'assets/ui/action-gold.webp',
  'assets/ui/fight-emblem.webp',
  'assets/fight-night/rooms/train-platform.webp',
  'assets/fight-night/rooms/rooftop-court.webp',
  'assets/fight-night/rooms/laundromat-table.webp',
];

export function warmScreenArt() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
  const start = () => isBattleActive() ? undefined : void warmImages([collectionSunset, ...SCREEN_ART.map(path => getAssetUrl(path))]);
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1500);
}
