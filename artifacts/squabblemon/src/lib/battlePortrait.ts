import portraits from './battlePortraits.json';
import { getAssetUrl } from './assets';

const catalog = portraits as Record<string, { asset: string; revision: string | null }>;
/** Small battle faces share a portrait; inspection always retains the original. */
export function battlePortraitUrl(original: string): string {
  const base = `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/`;
  if (!original.startsWith(base)) return original;
  const [path, query, extra] = original.slice(base.length).split('?');
  const entry = catalog[path];
  if (!entry || extra !== undefined || (query ?? '') !== (entry.revision ? `v=${entry.revision}` : '')) return original;
  return getAssetUrl(entry.asset);
}
