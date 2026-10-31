const art = (name: string, size: 160 | 512 = 512) =>
  new URL(`./assets/progression/${name}-${size}.webp`, import.meta.url).href;
export const BREAKTHROUGH_TROPHY = art('breakthrough-trophy');
export const BASE_TARGET = art('base-target');
export const DRAW_LOCK = art('last-stand-lock', 160);
/** Art preview only. Normal PvP floors and grants remain owned by ranked.ts. */
export const TROPHY_DESIGNS = [
  {
    id: 'breakthrough',
    name: 'Breakthrough',
    type: 'KUMITE / OWN TROPHY TRACK',
    art: BREAKTHROUGH_TROPHY,
  },
  {
    id: 'ascended-hands',
    name: 'Ascended Hands',
    type: 'PVP / AFTER PARK ROYALTY',
    art: art('ascended-hands'),
  },
  {
    id: 'intergalactic-fade-master',
    name: 'Intergalactic Fade Master',
    type: 'PVP / COSMIC TIER',
    art: art('intergalactic-fade-master'),
  },
  {
    id: 'god-boxer',
    name: 'The God Boxer',
    type: 'PVP / FINAL TIER',
    art: art('god-boxer'),
  },
];
