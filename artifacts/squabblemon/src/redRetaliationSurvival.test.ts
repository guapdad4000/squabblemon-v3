import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateBalanceMatch,seededLegalBalancePolicy} from '../../../lib/squabblemon-engine/src/balanceLab';
const decks=[{"id": "focus-cellblock-classic", "name": "Cellblock \u2014 No Kingpin", "cardIds": ["inmate-crafty", "inmate-boyfriend", "inmate-informant", "inmate-contraband", "lebron-james", "bustdown", "cognac", "rastamon", "wifey", "stud"]}, {"id": "focused-red-set", "name": "Blood / Red Set", "cardIds": ["triple-og-red", "block-spinner", "redside1", "ganger-red", "cane-corso-red", "initiation", "guap", "folks", "cognac", "bustdown"]}];
test('trained Red retaliation survives a reaction destroying its source without accessing a missing follow-up target',()=>{
 const result=simulateBalanceMatch({deckA:decks[0],deckB:decks[1],districtSeed:'full-deck-sweep-a',rotation:0,tier:3,seat:'a-player',policy:seededLegalBalancePolicy,allowSquabble:true});
 assert(['a','b','draw'].includes(result.logicalWinner));
});
