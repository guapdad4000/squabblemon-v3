import assert from 'node:assert/strict';
import test from 'node:test';
import { ANUNAKI_EVENT_REACTION_PACKS, type ReactionId, type ReactionView } from '@workspace/squabblemon-engine/reactions';
import { isAnunakiReaction, reactionViewForClient } from './reactionCompatibility';

test('every Anunaki reaction stays hidden from a legacy request, including a tab change during an existing match', () => {
  for (const id of ANUNAKI_EVENT_REACTION_PACKS.flatMap(pack => pack.reactionIds)) {
    const view: ReactionView = { revision: 2, serverTime: 100, owned: ['big-w', id as ReactionId], tray: [id as ReactionId], latest: {
      player: { id: 'p', reactionId: id as ReactionId, seat: 'player', sentAt: 100, gameNumber: 1 },
      cpu: { id: 'c', reactionId: 'big-w', seat: 'cpu', sentAt: 100, gameNumber: 1 },
    } };
    assert.equal(isAnunakiReaction(id), true);
    const legacy = reactionViewForClient(view, false);
    assert.deepEqual(legacy.owned, ['big-w']);
    assert.deepEqual(legacy.tray, []);
    assert.equal(legacy.latest.player, undefined);
    assert.equal(legacy.latest.cpu?.reactionId, 'big-w');
    assert.equal(legacy.revision, view.revision);
    assert.equal(reactionViewForClient(view, true), view);
    assert.equal(view.latest.player?.reactionId, id, 'per-request filtering must not mutate the stored event');
  }
});
