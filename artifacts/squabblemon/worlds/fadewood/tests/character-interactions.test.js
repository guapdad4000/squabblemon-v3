import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CHARACTER_PLACEMENTS as CHARACTER_PLACEMENTS } from '../src/character-placements.js';
import { CHARACTER_INTERACTIONS, STORY_SCREENS, createStoryNavigation, resolveStoryUrl } from '../src/story-destinations.js';
import { nearestCharacter, characterCameraShot } from '../src/character-interactions.js';

test('each uploaded character has two verified screen intents and its own camera composition', () => {
  assert.equal(CHARACTER_PLACEMENTS.length, 20);
  assert.deepEqual(Object.keys(CHARACTER_INTERACTIONS).sort(), CHARACTER_PLACEMENTS.map(({ id }) => id).sort());
  const compositions = new Set();
  for (const character of CHARACTER_PLACEMENTS) {
    const profile = CHARACTER_INTERACTIONS[character.id];
    assert.equal(profile.screens.length, 2);
    compositions.add(JSON.stringify(profile.shot));
    for (const screenId of profile.screens) {
      const intent = createStoryNavigation(character.id, screenId);
      assert.equal(intent.characterId, character.id);
      assert.equal(intent.route, STORY_SCREENS[screenId].route);
      assert.match(intent.route, /^\/game(?:[/?]|$)/);
    }
  }
  assert.equal(compositions.size, 20);
});

test('proximity picks the closer member of each pair and ignores missing-model stand-ins', () => {
  assert.equal(nearestCharacter([0, 0, 24.5], CHARACTER_PLACEMENTS), null);
  for (const character of CHARACTER_PLACEMENTS) {
    const point = { x: character.position[0], y: character.position[1], z: character.position[2] + .5 };
    assert.equal(nearestCharacter(point, CHARACTER_PLACEMENTS).id, character.id);
    assert.equal(nearestCharacter({ ...point, y: point.y + 3 }, [character]), null);
  }
  assert.equal(nearestCharacter([0, 0, 0], [{ id: 'small-house', position: [0, 0, 0] }]), null);
  assert.equal(nearestCharacter([NaN, 0, 0], CHARACTER_PLACEMENTS), null);
});

test('close-up compositions keep the real character in front and camera on the street side', () => {
  for (const character of CHARACTER_PLACEMENTS) {
    const first = characterCameraShot(character, 0);
    const final = characterCameraShot(character, 3);
    for (const shot of [first, final]) {
      assert.ok([...shot.position, ...shot.target, shot.fov, shot.roll].every(Number.isFinite));
      const x = shot.position.x - character.position[0], z = shot.position.z - character.position[2];
      assert.ok(x * Math.sin(character.yaw) + z * Math.cos(character.yaw) > 0, character.id);
      assert.ok(shot.target.y > character.position[1]);
    }
    assert.ok(first.position.distanceTo(final.position) > .2);
    assert.deepEqual(characterCameraShot(character, 5), final, 'camera settles instead of oscillating');
  }
  assert.equal(characterCameraShot({ id: 'not-a-character' }), null);
});

test('navigation stays inside each character authored choices and existing app routes', () => {
  assert.equal(createStoryNavigation('cornball', 'cellblock'), null);
  assert.equal(createStoryNavigation('small-house', 'market'), null);
  assert.equal(createStoryNavigation('yasuke', 'https://evil.example'), null);
  assert.equal(STORY_SCREENS.market.route, '/game/shop?view=corner');
  assert.equal(STORY_SCREENS.mail.route, '/game?notice=mail');
  assert.equal(STORY_SCREENS.friends.route, '/game/online?tab=friends');
  assert.equal(STORY_SCREENS.training.route, '/game/training');
});

test('launch links require an explicit safe app base and a verified route', () => {
  assert.equal(resolveStoryUrl(null, STORY_SCREENS.market.route), null);
  assert.equal(resolveStoryUrl('javascript:alert(1)', STORY_SCREENS.market.route), null);
  assert.equal(resolveStoryUrl('https://user:pass@example.com', STORY_SCREENS.market.route), null);
  assert.equal(resolveStoryUrl('https://example.com', '//evil.example'), null);
  assert.equal(resolveStoryUrl('https://example.com/', STORY_SCREENS.market.route), 'https://example.com/game/shop?view=corner');
  assert.equal(resolveStoryUrl('http://127.0.0.1:5173/squabblemon', STORY_SCREENS.mail.route), 'http://127.0.0.1:5173/squabblemon/game?notice=mail');
});
