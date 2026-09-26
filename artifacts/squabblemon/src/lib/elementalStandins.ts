/** Temporary arcade portraits for the bond wave, replaced by final character art later. */
const standins: Record<string, [string, string, string, string]> = {
  'puddle-runner': ['#60a5fa', 'PUDDLE RUNNER', '01', 'WATER'],
  'rain-caller': ['#60a5fa', 'RAIN CALLER', '02', 'WATER'],
  'hydrant-medic': ['#60a5fa', 'HYDRANT MEDIC', '03', 'WATER'],
  'floodgate-captain': ['#60a5fa', 'FLOODGATE CAPTAIN', '04', 'WATER'],
  'seed-vendor': ['#4ade80', 'SEED VENDOR', '01', 'PLANT'],
  'sidewalk-vinekeeper': ['#4ade80', 'SIDEWALK VINEKEEPER', '02', 'PLANT'],
  'moss-keeper': ['#4ade80', 'MOSS KEEPER', '03', 'PLANT'],
  'canopy-auntie': ['#4ade80', 'CANOPY AUNTIE', '04', 'PLANT'],
  'circuit-yn': ['#22d3ee', 'CIRCUIT YN', '01', 'ELECTRIC'],
  'switchboard-tech': ['#22d3ee', 'SWITCHBOARD TECH', '02', 'ELECTRIC'],
  'flash-courier': ['#22d3ee', 'FLASH COURIER', '03', 'ELECTRIC'],
  'power-station-operator': ['#22d3ee', 'POWER STATION OPERATOR', '04', 'ELECTRIC'],
  'gust-scout': ['#a78bfa', 'GUST SCOUT', '01', 'AIR'],
  'rooftop-runner': ['#a78bfa', 'ROOFTOP RUNNER', '02', 'AIR'],
  'block-messenger': ['#a78bfa', 'BLOCK MESSENGER', '03', 'AIR'],
  'skyline-captain': ['#a78bfa', 'SKYLINE CAPTAIN', '04', 'AIR'],
};

export function elementalStandin(cardId: string): string | null {
  const spec = standins[cardId];
  if (!spec) return null;
  const [color, label, number, element] = spec;
  const icon = element === 'WATER'
    ? '<path d="M180 102c-21 42-48 63-48 91a48 48 0 0 0 96 0c0-28-27-49-48-91Z" />'
    : element === 'PLANT'
    ? '<path d="M180 230v-87m0 48c-38 0-47-24-49-55 28 1 49 10 49 55Zm0-14c0-37 20-56 52-61-1 37-14 61-52 61Z" />'
    : element === 'ELECTRIC'
    ? '<path d="m192 106-54 79h37l-12 53 58-83h-39l10-49Z" />'
    : '<path d="M114 170c12-20 45-25 60-7 21 28-18 56-40 35m61-65c31-10 62 17 50 43-7 19-31 24-42 9m-79 53c46 22 100 15 123-17" />';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500">
    <defs><linearGradient id="body" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#171522"/></linearGradient></defs>
    <path d="M35 345 92 278l45 13-8-83 101-2-8 83 48-11 60 70-33 146H69Z" fill="#10141e" stroke="${color}" stroke-width="7"/>
    <path d="m72 394 54-90 55 47 55-47 52 90-22 100H96Z" fill="url(#body)" stroke="#0b101b" stroke-width="9"/>
    <path d="m128 219 17-76 27-22 44 20 17 80-17 44-60 4Z" fill="#d9ab7f" stroke="#14121c" stroke-width="9"/>
    <path d="m125 154 25-58 42-17 47 29 16 50-38-13-59 8-33 18Z" fill="#10111b" stroke="${color}" stroke-width="6"/>
    <path d="m147 181 15-5m37 0 15 5m-45 49 29 0" fill="none" stroke="#18151d" stroke-width="7" stroke-linecap="round"/>
    <path d="m69 386 49-38 43 46-16 89H91Zm222 0-49-38-43 46 16 89h54Z" fill="#171922" stroke="${color}" stroke-width="5"/>
    <circle cx="180" cy="184" r="105" fill="none" stroke="${color}" stroke-width="2" opacity=".7" stroke-dasharray="10 9"/>
    <g transform="translate(228 24) scale(.43)" fill="none" stroke="${color}" stroke-width="11" stroke-linejoin="round" stroke-linecap="round">${icon}</g>
    <path d="M30 18h93M30 18v52M330 18h-43m43 0v52" stroke="${color}" stroke-width="5" fill="none"/>
    <text x="31" y="48" fill="#f6edce" font-family="sans-serif" font-weight="900" font-size="18">SM / ${element}</text>
    <text x="180" y="330" fill="#fff5da" stroke="#15131b" stroke-width="3" paint-order="stroke" font-family="sans-serif" font-weight="900" font-size="24" text-anchor="middle">${label}</text>
    <text x="180" y="451" fill="#fff5da" font-family="sans-serif" font-weight="900" font-size="19" text-anchor="middle">ARCADE EDITION / ${number}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}