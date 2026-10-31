/**
 * Verified against the existing Squabblemon GameApp router and its screens.
 * These are navigation intents. The street never grants progress or bypasses
 * the account, Story prerequisites, match, or purchase checks in that app.
 */
const screen = (id, title, route, component, description, features) => Object.freeze({
  id, title, route, component, description, features: Object.freeze(features),
});

export const STORY_SCREENS = Object.freeze({
  market: screen('market', 'Fade Market', '/game/shop?view=corner', 'CornerStore', 'The neighborhood counter for daily packs, styles, and the shelves you already know.', ['Daily pack', 'Street shelves', 'Signature styles']),
  blueWelcome: screen('blue-welcome', 'Welcome to the Block', '/game/story?node=welcome-to-the-block', 'Story / NodeOverlay', 'Meet the blue side in the opening Story encounter. Your existing Story progress decides what is available.', ['Story encounter', 'Crew selection', 'Star objectives']),
  bluePressure: screen('blue-pressure', 'Blue Side Pressure', '/game/story?node=blue-side-pressure', 'Story / NodeOverlay', 'A four-round pressure match on the blue side. Keep enough Motion for the last turn.', ['Four-round match', 'Story progress', 'Earned rewards']),
  redReceipts: screen('red-receipts', 'Receipts on Camera', '/game/story?node=receipts-on-camera', 'Story / NodeOverlay', 'The red side brought receipts. Continue the encounter through the existing Story screen.', ['Story encounter', 'District control', 'Star objectives']),
  redRetaliation: screen('red-retaliation', 'Red Side Retaliation', '/game/story?node=red-side-retaliation', 'Story / NodeOverlay', 'An old argument gets a harder hand. Enter the red side Story encounter when it is unlocked.', ['Story encounter', 'Motion management', 'Earned rewards']),
  friends: screen('friends', 'Friendly Fades', '/game/online?tab=friends', 'Multiplayer', 'Invite a friend, choose your gang, and settle it in a private room.', ['Private room', 'Invite code', 'Rematches']),
  ranked: screen('ranked', 'Fade Park', '/game/online', 'FadePark', 'Choose your gang and find the next ranked fade in the park.', ['Ranked lobby', 'Crew selection', 'Rank progress']),
  training: screen('training', 'The Dojo', '/game/training', 'ChallengesHub', 'Practice your hands in the existing training hub before you take them back to the block.', ['Training', 'Challenge hub', 'Practice match']),
  mail: screen('mail', 'Special Delivery', '/game?notice=mail', 'Home / SafehouseMail', 'Letters, neighborhood updates, and gifts arrive through your Safehouse mail.', ['Letters', 'Neighborhood news', 'Gifts']),
  diner: screen('diner', 'The Last Waffle', '/game/story?season=special-squabble-house', 'Story / StoryTheater', 'One missing waffle and a night shift that throws hands. The six existing Squabble House chapters start here.', ['Six film chapters', 'House puzzles', 'Story rewards']),
  cellblock: screen('cellblock', 'The Library Hour', '/game/story?season=special-cellblock', 'Story / StoryTheater', 'Kingpin has been selling the library seats. Crafty follows the books, stamps, and noodles.', ['Cellblock chapter', 'Story scenes', 'Story rewards']),
  leon: screen('leon', 'A Place to Return', '/game/story?season=special-leon', 'Story / StoryTheater', 'Leon has a cart, a deadline, and a landlord holding an envelope. His existing Story chapter is waiting.', ['Leon’s chapter', 'Story scenes', 'Story rewards']),
  yasuke: screen('yasuke', 'A Banner Without a Master', '/game/story?season=special-yasuke', 'Story / StoryTheater', 'A sponsor sold Yasuke’s face and left the kids out. Read the contract, then meet the champion.', ['Yasuke chapter', 'Story scenes', 'Story rewards']),
  seasonTwo: screen('season-two', 'You Let Who Drive?', '/game/story?season=season-2', 'Story / StoryTheater', 'Cornball borrowed Wifey’s car. The neighborhood has been hearing about it ever since.', ['Season Two', 'Eight chapters', 'Existing Story progress']),
  seasonOne: screen('season-one', 'Back on the Block', '/game/story?season=season-1', 'Story / StoryTheater', 'New friends, old grudges, and family business. Return to the first season of your Story.', ['Season One', 'Eight chapters', 'Existing Story progress']),
  alice: screen('alice', 'The Borrowed Hour', '/game/story?season=special-alice', 'Story / StoryTheater', 'Follow the Hatter into Alice’s existing Wonderland chapters. The Queen has been charging late fees for leaving brunch.', ['Alice in Wonderland', 'Two chapters', 'Existing Story progress']),
  arena: screen('arena', 'Underground Kumite', '/game/kumite?view=arena', 'Kumite', 'The not-so-secret entrance leads into the existing weekly Kumite arena. Registration, opponents, and rewards come from your Squabblemon account.', ['Weekly PvP', 'Tournament arena', 'Account registration']),
  safehouse: screen('safehouse', 'The Safehouse', '/game', 'Home', 'Your own front door opens the existing Safehouse: your room, collection, growth lab, letters, and the rest of the game.', ['Home court', 'Your account', 'Saved progress']),
  storyArchive: screen('story-archive', 'Anunaki Signal', '/game/story', 'Story / StoryTheater', 'Something ancient has found your block. Follow the signal, then explore the stories waiting in the Story archive.', ['Anunaki signal', 'Story archive', 'Explore the block']),
  sherlock: screen('sherlock', 'The Missing Motion', '/game/story?season=special-sherlock', 'Story / StoryTheater', 'Sherlock is following a trail through the block. Open his existing six Story chapters and pick up the case.', ['Sherlock’s case', 'Six chapters', 'Existing Story progress']),
  crackedHead: screen('cracked-head', 'Cracked Head Takes the Block', '/game/story?node=cracked-head-takes-the-block', 'Story / NodeOverlay', 'Cracked Head is posted in the garage. Continue his existing Story encounter when your progress unlocks it.', ['Story encounter', 'Existing unlocks', 'Star objectives']),
  snitch: screen('snitch', 'Snitch at the Corner', '/game/story?node=snitch-at-the-corner', 'Story / NodeOverlay', 'The corner has ears. Meet Snitch through his existing Story encounter.', ['Story encounter', 'Existing unlocks', 'Star objectives']),
  noiseComplaint: screen('noise-complaint', 'Noise Complaint Main Event', '/game/story?node=s2-noise-complaint-main-event', 'Story / NodeOverlay', 'Officer Oink brought a noise complaint. Enter the existing Season Two encounter through your Story progress.', ['Season Two encounter', 'Officer Oink', 'Existing unlocks']),
});

const portal = (screenId, title, prompt, color, connection = 'connected') => Object.freeze({ screenId, title, prompt, color, connection });

/** World props select these verified destinations; their geometry never supplies a URL. */
export const PORTAL_DESTINATIONS = Object.freeze({
  'anunaki-ufo': portal('storyArchive', 'Anunaki Signal', 'Investigate the Anunaki signal', '#8ef2ca', 'chapter-pending'),
  'underground-arena': portal('arena', 'Not-So-Secret Fight Club', 'Enter Underground Kumite', '#ffaf79'),
  'alice-hat': portal('alice', 'Follow the Hatter', 'Open Alice’s missions', '#dcabff'),
  'safehouse-door': portal('safehouse', 'Home Court', 'Enter the Safehouse', '#f4d77d'),
});

export function createPortalNavigation(portalId, screenId = PORTAL_DESTINATIONS[portalId]?.screenId) {
  const portal = Object.hasOwn(PORTAL_DESTINATIONS, portalId ?? '') ? PORTAL_DESTINATIONS[portalId] : null;
  const destination = Object.hasOwn(STORY_SCREENS, screenId ?? '') ? STORY_SCREENS[screenId] : null;
  if (!portal || portal.screenId !== screenId || !destination) return null;
  return Object.freeze({ type: 'squabblemon:story-navigate', version: 1, source: 'fadewood-story-v3', portalId, screenId, route: destination.route, component: destination.component, connection: portal.connection });
}

const character = (title, line, color, screens, shot) => Object.freeze({ title, line, color, screens: Object.freeze(screens), shot: Object.freeze(shot) });

// Shot: relative facing angle, lens distance, eye height, aim height, roll.
// All eyes stay in the character's street-facing hemisphere.
export const CHARACTER_INTERACTIONS = Object.freeze({
  cornball: character('The corner-store connection', 'You outside? Good. The whole block is outside.', '#9cce9b', ['market', 'blueWelcome'], { angle: -.22, distance: 4.15, eye: 1.24, aim: 1.12, roll: -.018 }),
  'og-blue': character('Blue side · old head', 'You can hold ground. Now hold it under pressure.', '#78aaff', ['bluePressure', 'friends'], { angle: -.20, distance: 3.72, eye: 1.04, aim: 1.25, roll: -.026 }),
  'ganger-blue': character('Blue side · next up', 'Come through. Show the block what you brought.', '#78aaff', ['blueWelcome', 'friends'], { angle: .20, distance: 3.48, eye: 1.12, aim: 1.15, roll: .020 }),
  'og-red': character('Red side · old head', 'Word travels fast. Keep your hands faster.', '#ff8d80', ['redRetaliation', 'friends'], { angle: -.24, distance: 3.63, eye: 1.02, aim: 1.27, roll: .024 }),
  'ganger-red': character('Red side · no receipts lost', 'We brought receipts. You brought a crew?', '#ff8d80', ['redReceipts', 'friends'], { angle: .24, distance: 3.50, eye: 1.22, aim: 1.15, roll: -.020 }),
  'homeless-guy': character('Leon · taking a minute by the market', 'I got a spot right here. Still got a story to tell.', '#deb68c', ['leon', 'mail'], { angle: .14, distance: 3.45, eye: .90, aim: .28, roll: -.012 }),
  'squabble-house-manager': character('Night shift · no days off', 'You want a plate, or you want a problem?', '#f4cf68', ['diner', 'market'], { angle: -.17, distance: 3.85, eye: 1.05, aim: 1.20, roll: .021 }),
  wifey: character('Fade Park · keeping it together', 'Come sit for a minute. Everybody’s got a story.', '#cbb9ed', ['friends', 'seasonTwo'], { angle: -.14, distance: 3.40, eye: 1.34, aim: 1.12, roll: -.014 }),
  'baby-momma': character('Fade Park · say it with your chest', 'You got another one in you? No rush.', '#f3b6a7', ['ranked', 'seasonOne'], { angle: .19, distance: 3.42, eye: 1.25, aim: 1.12, roll: .018 }),
  'inmate-kingpin': character('County · reservations required', 'Library’s open. Depends who’s asking.', '#c3bae3', ['cellblock', 'seasonOne'], { angle: -.12, distance: 3.90, eye: .98, aim: 1.28, roll: -.024 }),
  yasuke: character('The dojo · quiet resolve', 'Take your time. Then make the first move count.', '#d5b47d', ['training', 'yasuke'], { angle: .18, distance: 3.63, eye: 1.06, aim: 1.22, roll: .012 }),
  mailman: character('Special delivery · wings on the clock', 'Whole block on my route. I’ll be back at the post office.', '#e6bb73', ['mail', 'safehouse'], { angle: -.18, distance: 3.65, eye: 1.15, aim: 1.12, roll: .016 }),
  'dr-fade': character('Dr. Fade · Kumite on the other side', 'You found the entrance. Let’s see if you’re ready.', '#c8cba6', ['arena', 'training'], { angle: 1.25, distance: 3.75, eye: 1.06, aim: 1.20, roll: -.022 }),
  'blue-yb': character('Blue YB · park practice', 'Catch me at Fade Park. Bring your hands.', '#72a9ef', ['blueWelcome', 'friends'], { angle: 1.0, distance: 3.52, eye: 1.12, aim: 1.08, roll: .022 }),
  sherlock: character('Sherlock · working the block', 'Every street has a clue. Walk with me.', '#c1a377', ['sherlock', 'storyArchive'], { angle: .12, distance: 3.55, eye: 1.20, aim: 1.10, roll: -.016 }),
  nova: character('Nova · little boss of the park', '…', '#e4c26e', ['safehouse', 'friends'], { angle: -.18, distance: 3.20, eye: .70, aim: .35, roll: -.010 }),
  'golden-doberman': character('Golden Doberman · on patrol', '…', '#d6a759', ['safehouse', 'training'], { angle: .18, distance: 3.25, eye: .80, aim: .56, roll: .010 }),
  'cracked-head': character('The garage · still outside', 'Garage is open. You got something to say?', '#d0b066', ['crackedHead', 'storyArchive'], { angle: -.30, distance: 3.65, eye: 1.18, aim: .80, roll: -.020 }),
  snitch: character('Catch Lane · word gets around', 'I ain’t saying nothing. But I heard everything.', '#c9ba91', ['snitch', 'seasonOne'], { angle: .22, distance: 3.7, eye: 1.26, aim: .92, roll: .018 }),
  'officer-oinkston': character('Hands Ave · noise complaint', 'I heard this block been getting loud.', '#7ab4da', ['noiseComplaint', 'seasonTwo'], { angle: -.18, distance: 3.65, eye: 1.16, aim: .68, roll: -.016 }),
});

export function createStoryNavigation(characterId, screenId) {
  const character = CHARACTER_INTERACTIONS[characterId];
  const destination = STORY_SCREENS[screenId];
  if (!character?.screens.includes(screenId) || !destination) return null;
  return Object.freeze({ type: 'squabblemon:story-navigate', version: 1, source: 'fadewood-story-v3', characterId, screenId, route: destination.route, component: destination.component });
}

/** Never derive an app URL from an untrusted route or navigate this audition. */
export function resolveStoryUrl(appBaseUrl, route) {
  if (!appBaseUrl || !Object.values(STORY_SCREENS).some((screen) => screen.route === route)) return null;
  try {
    const base = new URL(appBaseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
    // A configured base may include a deployment base path such as /squabblemon.
    return new URL(`${base.pathname.replace(/\/$/, '')}${route}`, base.origin).href;
  } catch { return null; }
}
