import assert from 'node:assert/strict';
import test from 'node:test';
import { stat } from 'node:fs/promises';
import { createStoryMatch } from '../../../lib/squabblemon-engine/src/gameEngine';
import { storyContent } from '../../../lib/squabblemon-engine/src/story';
import { STORY_ENVIRONMENTS, withStoryEnvironments } from '../../../lib/squabblemon-engine/src/storyEnvironments';
import { BATTLE_VENUES, resolveBattleArtwork } from './battleVenues';
import type { StoryEncounterSnapshot } from './gameEngine';

const storyMatch = (battlefieldAssetId?: string) => ({
  cpuDeck: 'block',
  storyEncounter: { id: 'custom-story-encounter', battlefieldAssetId } as StoryEncounterSnapshot,
});

test('custom Story artwork remains the issued scene in both viewport orientations', () => {
  const scene = 'assets/story/squabble-house/environments/dining-room.webp';
  assert.deepEqual(resolveBattleArtwork(storyMatch(scene)), {
    landscapeAssetId: scene,
    portraitAssetId: scene,
  });
});

test('issued built-in venues retain their authored landscape and portrait pair', () => {
  for (const venue of Object.values(BATTLE_VENUES)) {
    for (const issuedAsset of [venue.assetId, venue.portraitAssetId]) {
      assert.deepEqual(resolveBattleArtwork(storyMatch(issuedAsset)), {
        landscapeAssetId: venue.assetId,
        portraitAssetId: venue.portraitAssetId,
      });
    }
  }
});

test('unissued training and Story scenes keep their existing venue fallback', () => {
  const training = BATTLE_VENUES['corner-store'];
  const story = BATTLE_VENUES['civic-hill'];
  assert.deepEqual(resolveBattleArtwork({ cpuDeck: 'block' }), {
    landscapeAssetId: training.assetId,
    portraitAssetId: training.portraitAssetId,
  });
  assert.deepEqual(resolveBattleArtwork(storyMatch()), {
    landscapeAssetId: story.assetId,
    portraitAssetId: story.portraitAssetId,
  });
});


test('every authored Story battle issues its mapped scene to both board orientations and has real art', async () => {
  const scenes = new Set<string>();
  let mappedBattles = 0;
  for (const chapter of storyContent.chapters) {
    for (const node of chapter.nodes) {
      const environment = STORY_ENVIRONMENTS[node.id];
      if (node.kind !== 'battle' || !environment) continue;
      const scene = `assets/story/environments/backgrounds/${environment}.webp`;
      assert.equal(node.cinematic.environmentAssetId, scene, node.id);
      assert.equal(node.encounter.battlefieldAssetId, scene, node.id);
      const match = createStoryMatch(node.encounter, 'block');
      assert.deepEqual(resolveBattleArtwork(match), {
        landscapeAssetId: scene, portraitAssetId: scene,
      }, node.id);
      scenes.add(scene);
      mappedBattles++;
    }
  }
  assert.ok(mappedBattles > 0, 'the authored battle catalog must be exercised');
  for (const scene of scenes) {
    const file = await stat(new URL(`../public/${scene}`, import.meta.url));
    assert.ok(file.isFile() && file.size > 0, `Missing issued Story battle art: ${scene}`);
  }
});

test('authored Story environment handoff preserves encounter rules and never mutates source content', () => {
  const chapters = storyContent.chapters.map(chapter => ({ ...chapter,
    nodes: chapter.nodes.map(node => node.kind === 'battle' && STORY_ENVIRONMENTS[node.id]
      ? { ...node, encounter: { ...node.encounter, battlefieldAssetId: 'assets/legacy-story-scene.webp' } }
      : node),
  }));
  const before = structuredClone(chapters);
  const assigned = withStoryEnvironments(chapters);
  assert.deepEqual(chapters, before, 'authored content must remain immutable');
  chapters.forEach((chapter, chapterIndex) => {
    chapter.nodes.forEach((node, nodeIndex) => {
      if (node.kind !== 'battle') return;
      const next = assigned[chapterIndex].nodes[nodeIndex];
      assert.equal(next.kind, 'battle');
      if (next.kind !== 'battle') return;
      const environment = STORY_ENVIRONMENTS[node.id];
      assert.deepEqual(next.encounter, { ...node.encounter,
        battlefieldAssetId: environment ? `assets/story/environments/backgrounds/${environment}.webp` : node.encounter.battlefieldAssetId,
      }, `${node.id}: only the issued background changes`);
    });
  });
});
