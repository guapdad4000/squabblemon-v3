import { CREW_MATCHUP_PATCH } from '../../../lib/squabblemon-engine/src/crewMatchupBalance';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cardCatalog, cards } from './data';
import { createCardInstance } from './gameEngine';
import { FULL_ROSTER_BUFFS, FULL_ROSTER_TEMPO_BUFFS } from '../../../lib/squabblemon-engine/src/fullRosterBuffs';
const reference = new URL('../../deliverables/full-roster-buffs-2026-10-07/', import.meta.url);
const before = JSON.parse(readFileSync(new URL('catalog-before.json', reference), 'utf8')) as typeof cardCatalog;

test('full roster sweep changes only approved printed values, keeping GUAP and all card identities intact', () => {
  assert.deepEqual(cards.guap, JSON.parse(readFileSync(new URL('guap-before.json', reference), 'utf8')));
  assert.equal(cardCatalog.length, before.length + 31);
  assert.equal(Object.keys(FULL_ROSTER_BUFFS).length, 16);
  for (const previous of before) {
    const current = cardCatalog.find(c => c.engineId === previous.engineId)!;
    const expected = FULL_ROSTER_BUFFS[previous.engineId];
    const tempo = FULL_ROSTER_TEMPO_BUFFS[previous.engineId];
    const eventCosts: Record<string, number> = {'the-block-spin':3, 'the-sideshow':2, 'the-after-party':2, 'the-kickback':2, 'the-setup':1};
    const eventCost = eventCosts[previous.engineId];
    for(const tag of previous.crewTags) assert(current.crewTags.includes(tag), previous.engineId+' retains '+tag);
    const adjusted = ['the-og-rap-legend','the-battle-rapper','fitness-bro','fitness-girl','personal-trainer','dancecaptain','cornercoach','the-hype-man','the-rapper','the-shootout','the-block-spin','the-sideshow','the-concert','the-setup','the-dice-game','the-after-party','the-kickback','the-cookout','the-babyshower'].includes(previous.engineId) ? { ...previous, effect: current.effect, crewTags:current.crewTags } : {...previous,crewTags:current.crewTags};
    const earlier = eventCost !== undefined ? {...adjusted, cost:eventCost} : tempo ? { ...adjusted, cost:tempo.cost, power:tempo.power } : expected === undefined ? adjusted : { ...adjusted, power: previous.power + 1 };
    assert.deepEqual(current, {...earlier, ...CREW_MATCHUP_PATCH[previous.engineId]}, previous.engineId);
    for (const owner of ['player','cpu'] as const) {
      const unit = createCardInstance(previous.engineId, owner);
      assert.equal(unit.basePower, current.power, `${owner}: ${previous.engineId} uses the shared authoritative body`);
      assert.equal(unit.cost, CREW_MATCHUP_PATCH[previous.engineId]?.cost ?? eventCost ?? tempo?.cost ?? previous.cost, `${owner}: only approved tempo changes apply`);
    }
  }
});
