import test from 'node:test';
import assert from 'node:assert/strict';
import { starterRecipes, cardCatalog, catalogCardById, validateSavedDeck } from '../data';
import { crewLoaner, ownedCrewVersion } from './communityCrew';
const recipe=starterRecipes[0];
const crew={id:'example',name:'A Very Long Community Deck Name With Style',strategy:'Spread pressure',cardIds:[...recipe.catalogCardIds],heroCardId:recipe.hero};
test('loaner uses exact snapshot without changing ownership or source array',()=>{
 const original=[...crew.cardIds];const loaner=crewLoaner(crew);
 assert.deepEqual(loaner.cards,original);assert.notEqual(loaner.cards,crew.cardIds);
 loaner.cards.pop();assert.deepEqual(crew.cardIds,original);
 assert.throws(()=>crewLoaner({...crew,cardIds:[...original.slice(0,9),original[0]]}),/legal/);
});
test('personal version retains owned originals and only offers owned replacements',()=>{
 const excluded=crew.cardIds[2];const owned=cardCatalog.filter(c=>c.kind!=='token'&&c.catalogId!==excluded).map(c=>c.catalogId);
 const version=ownedCrewVersion(crew,owned);
 assert.deepEqual(version.missing,[excluded]);
 assert.ok(version.draft.name.length<=32);
 assert.ok(crew.cardIds.filter(id=>id!==excluded).every(id=>version.draft.cardIds.includes(id)));
 assert.ok(version.draft.cardIds.every(id=>owned.includes(id)&&catalogCardById[id].kind!=='token'));
 assert.ok(validateSavedDeck(version.draft.cardIds,owned,version.draft.heroCardId).valid);
});
