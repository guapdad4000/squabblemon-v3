import { BREAKTHROUGH_STARTER_DECKS } from './breakthroughCatalog';
import type { AiStyle } from './breakthrough';
export const BREAKTHROUGH_RIVAL_WAIT_MS = 6000;
/** Stable identities preserve per-opponent reward caps; no synthetic accounts or assets. */
export const BREAKTHROUGH_RIVALS = [
  ['redline', 'Redline Ren', 'rush'], ['lockstep', 'Lockstep Liv', 'counter'],
  ['nightshift', 'Nightshift Nico', 'support'], ['southpaw', 'Southpaw Sol', 'rush'],
  ['coldfront', 'Coldfront Cee', 'counter'], ['backbeat', 'Backbeat Bo', 'support'],
  ['quickstep', 'Quickstep Quinn', 'rush'], ['ironwall', 'Ironwall Imani', 'counter'],
  ['crossfade', 'Crossfade Kai', 'support'], ['lastlight', 'Lastlight Lux', 'counter'],
].map(([id, name, style], index) => ({
  userId: `kumite-rival:${id}`, name, style: style as AiStyle,
  avatarKey: BREAKTHROUGH_STARTER_DECKS[index].hero,
  cards: [...BREAKTHROUGH_STARTER_DECKS[index].catalogCardIds],
}));
