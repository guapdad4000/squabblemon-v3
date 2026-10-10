/** Export printed base-card values only. No progression or upgraded matches. */
import { writeFileSync } from 'node:fs';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';
const destination = process.argv[2];
if (!destination) throw new Error('Usage: exportBasePvpCatalog.ts <output.json>');
const cards = cardCatalog.filter(card => card.kind !== 'token' && !card.hazard).map(card => ({
  engineId: card.engineId, catalogId: card.catalogId, name: card.name,
  cost: card.cost, power: card.power, kind: card.kind ?? 'character', type: card.type,
  ability: card.ability, effect: card.effect,
}));
writeFileSync(destination, JSON.stringify({ balanceVersion: CARD_BALANCE_VERSION, scope: 'Printed base cards only', cards }, null, 2) + '\n');
console.log(`Exported ${cards.length} base cards`);
