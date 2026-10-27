import portraits from './kumitePortraits.json';
import { getAssetUrl } from './assets';

const catalog = portraits as Record<string, {asset: string; width: number; originalWidth: number}>;
/** Known, approved Kumite art only. Unknown URLs/revisions keep their original source. */
export function kumiteArtSources(original: string | undefined, sizes: string) {
  if (!original) return {};
  const base = `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/`;
  if (!original.startsWith(base)) return {};
  const path = original.slice(base.length);
  const entry = catalog[path];
  if (!entry) return {};
  return {srcSet: `${getAssetUrl(entry.asset)} ${entry.width}w, ${original} ${entry.originalWidth}w`, sizes};
}
