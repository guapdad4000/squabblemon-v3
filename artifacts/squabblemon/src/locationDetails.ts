import type { LOCATION_ARTWORK } from './locationArtwork';

export type LocationDetails = { category: string; description: string };

/** Flavor for the location inspector. Issued match rules remain authoritative. */
export const LOCATION_DETAILS = {
  'bodega': {
    category: 'Corner store',
    description: 'Cold drinks, crowded shelves, and a counter that hears everything. This corner stays open long after the rest of the block calls it a night.',
  },
  'the-trap': {
    category: 'Backstreet hideout',
    description: 'Low lights spill through boarded windows while the bass carries down the alley. Every doorway has a lookout, and every arrival gets noticed.',
  },
  'waff-l-house': {
    category: 'All-night diner',
    description: 'The griddle never cools and the coffee never quits. After midnight, this booth-lined diner turns into the block’s unofficial meeting room.',
  },
  'vip-section': {
    category: 'Nightclub lounge',
    description: 'Past the velvet rope, the lights get softer and the jewelry gets louder. The whole room watches who gets a seat.',
  },
  'county-jail': {
    category: 'County lockup',
    description: 'Steel doors, hard benches, and fluorescent lights that never sleep. Every sound travels down the corridor.',
  },
  'penthouse': {
    category: 'Skyline suite',
    description: 'High above the street noise, the windows frame a city that never settles down. The elevator opens straight into the afterparty.',
  },
  'time-square': {
    category: 'Neon crossroads',
    description: 'Towering signs paint the pavement in electric color. Tourists, hustlers, and late-night crews all cross paths under the same glow.',
  },
  'magic-city': {
    category: 'After-hours club',
    description: 'Pink neon cuts through the haze while the speakers keep the room moving. The night gets louder every time another crew walks in.',
  },
  'the-subway': {
    category: 'Underground station',
    description: 'Train brakes scream beneath the city and warm air rolls across the platform. Everybody is waiting for their next stop.',
  },
  'o-block': {
    category: 'Neighborhood turf',
    description: 'Apartment windows overlook a corner that remembers every face. The sidewalks belong to the people who show up for each other.',
  },
  'hollywood-strip': {
    category: 'Spotlight boulevard',
    description: 'Marquee lights and camera flashes turn the sidewalk into a stage. Around here, making an entrance is part of the job.',
  },
  'dive-bar': {
    category: 'Neighborhood bar',
    description: 'Faded signs, sticky floors, and a jukebox with a long memory. The regulars know which stool belongs to who.',
  },
  'acorn-projects': {
    category: 'Housing courtyard',
    description: 'Concrete walkways connect the buildings, and every balcony has a view of the courtyard. Word travels fast between these doors.',
  },
  'corrupt-church': {
    category: 'Crooked sanctuary',
    description: 'Colored light falls across old pews while quiet deals happen behind the pulpit. Even the collection plate has a story.',
  },
  'nail-salon': {
    category: 'Beauty spot',
    description: 'Glossy polish, bright mirrors, and conversations that carry across every station. Fresh nails leave with fresher neighborhood news.',
  },
  'barbershop': {
    category: 'Neighborhood institution',
    description: 'Clippers buzz under the striped pole while the chairs fill with familiar faces. A fresh cut comes with a full report from the block.',
  },
  'underground-ring': {
    category: 'Basement fight club',
    description: 'Bare bulbs hang above the ropes and the crowd presses close to the canvas. Down here, every hit echoes through the concrete.',
  },
  'rooftop-garden': {
    category: 'Skyline hideaway',
    description: 'Green leaves climb above the brick and satellite dishes. Up on this roof, the city sounds a little farther away.',
  },
  'pawn-shop': {
    category: 'Secondhand storefront',
    description: 'Gold chains, old speakers, and somebody’s favorite things crowd the glass cases. Every price tag hides a story.',
  },
  'pirate-radio': {
    category: 'Rooftop broadcast',
    description: 'A homemade antenna reaches over the rooftops while a hidden booth keeps the speakers alive. This signal belongs to the streets.',
  },
  'blackout-block': {
    category: 'Darkened streets',
    description: 'The streetlights are out and the windows have gone quiet. Footsteps and distant sirens fill the space the neon left behind.',
  },
  'flood-channel': {
    category: 'Stormwater passage',
    description: 'Rainwater races between concrete walls beneath the bridges. Even on a clear night, this stretch of the city feels restless.',
  },
  'construction-site': {
    category: 'Work zone',
    description: 'Steel beams, warning tape, and unfinished floors cut into the skyline. Beyond the fence, the city is still taking shape.',
  },
  'night-market': {
    category: 'After-dark bazaar',
    description: 'Lanterns swing above packed stalls and steam rises between the crowds. The best finds come after the rest of the city closes up.',
  },
  'mirror-arcade': {
    category: 'Neon game room',
    description: 'Cabinet screens flicker across mirrored walls while tokens rattle in the trays. Every corner glows like another high score waiting to happen.',
  },
  'community-kitchen': {
    category: 'Neighborhood table',
    description: 'Big pots simmer behind the serving counter and nobody leaves hungry. The whole block has a place at this table.',
  },
  'rush-hour': {
    category: 'Traffic crossroads',
    description: 'Headlights stack up beneath the signals while horns bounce between the buildings. Everybody has somewhere to be, all at once.',
  },
  'raid-checkpoint': { category: 'Police perimeter', description: 'Floodlights search the checkpoint. Silence or freeze officers to dismantle their armor.' },
  'raid-barricade': { category: 'Precinct barricade', description: 'The department blocks the street. Every surviving unarmored Hand powers your shot at Oink.' },
  'raid-evidence': { category: 'Evidence lockup', description: 'Confiscated gear fills the yard. Guard your crew and traps from the crooked precinct.' },
  'legacy-0': {
    category: 'Hometown turf',
    description: 'Familiar corners and warm windows stretch across the neighborhood. Every block has a story, and somebody here knows yours.',
  },
  'legacy-1': {
    category: 'Digital hangout',
    description: 'The messages keep flying and the whole crew stays tapped in. News hits this chat before it makes it down the street.',
  },
  'legacy-2': {
    category: 'Network hideout',
    description: 'Rows of hardware hum beneath a cold electric glow. Behind these doors, the neighborhood’s noise becomes a signal.',
  },
} satisfies Record<keyof typeof LOCATION_ARTWORK, LocationDetails>;

export function getLocationDetails(id: string): LocationDetails {
  return Object.hasOwn(LOCATION_DETAILS, id)
    ? LOCATION_DETAILS[id as keyof typeof LOCATION_DETAILS]
    : LOCATION_DETAILS['legacy-0'];
}
