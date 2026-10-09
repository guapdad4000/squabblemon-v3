import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { cards, cardCatalog } from '@workspace/squabblemon-engine/data';
import { greedyBalancePolicy, seededLegalBalancePolicy, simulateBalanceMatch, type BalanceDeck } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { allRankingDecks } from './all-decks-ranking-decks';

const out = process.argv[2];
if (!out) throw new Error('Supply output directory');
const decks = allRankingDecks();
// Earlier league excluded Folks too. This sweep excludes only GUAP.
const red = decks.find(d => d.id === 'focused-red-set')!;
decks.push({ ...red, id: 'red-with-folks', cardIds: red.cardIds.map(id => id === 'redside5' ? 'folks' : id) });
const eligible = cardCatalog.filter(c => c.engineId !== 'guap' && c.kind !== 'token' && !c.hazard).map(c => ({ ...c, id: c.engineId }));
const previous = process.env.SWEEP_REUSE ? JSON.parse(readFileSync(process.env.SWEEP_REUSE, 'utf8')) : null;
const baselineById = new Map(previous?.cards.map((c: any) => [c.id,c]) ?? []);
const baselineCatalog = process.env.SWEEP_REUSE ? JSON.parse(readFileSync(new URL('../../artifacts/deliverables/full-roster-buffs-2026-10-07/catalog-before.json', import.meta.url), 'utf8')) : [];
const changed = process.env.SWEEP_CHANGED ? process.env.SWEEP_CHANGED.split(',') : baselineCatalog.filter((c:any) => JSON.stringify(cards[c.engineId]) !== JSON.stringify({ ...cards[c.engineId], power:c.power, cost:c.cost })).map((c:any)=>c.engineId);
const cache = new Map<string, ReturnType<typeof simulateBalanceMatch>>();
const report: any = { balanceVersion: CARD_BALANCE_VERSION, excluded: ['guap'], catalog: cardCatalog.length, cards: [], failures: [] };
const opponents = ['starter-block', 'starter-combo', 'focused-red-set', 'focused-blue-set'].map(id => decks.find(d => d.id === id)).filter(Boolean) as BalanceDeck[];
if (opponents.length !== 4) throw new Error('Missing benchmark crew');
console.log(`Starting ${eligible.length} cards`);
for (const [index, card] of eligible.entries()) {
  if (process.env.SWEEP_ONLY && !process.env.SWEEP_ONLY.split(',').includes(card.id)) continue;
  if (index % Number(process.argv[4] ?? 1) !== Number(process.argv[3] ?? 0)) continue;
  console.log(`Considering ${card.id}`);
  const authored = decks.filter(d => d.cardIds.includes(card.id));
  const shell = authored[0] ?? [...decks].sort((a,b) => b.cardIds.filter(id => cards[id].type === card.type).length - a.cardIds.filter(id => cards[id].type === card.type).length)[0];
  const deck = authored.length ? shell : { ...shell, id: `probe-${card.id}`, cardIds: [card.id, ...shell.cardIds.slice(1)] };
  if (previous && ![...deck.cardIds,...opponents.flatMap(d=>d.cardIds)].some(id=>changed.includes(id))) {
    const old = baselineById.get(card.id) as any;
    if (!old || JSON.stringify(old.shell)!==JSON.stringify(deck.cardIds) || old.games!==32) throw new Error(`Invalid reuse: ${card.id}`);
    report.cards.push({ ...old, reusedBaseline:true }); continue;
  }
  const rows: any[] = [];
  for (const opponent of opponents) for (const tier of [0,3] as const) for (const seat of ['a-player','b-player'] as const) for (const [policyName,policy] of [['greedy',greedyBalancePolicy],['seeded',seededLegalBalancePolicy]] as const) {
    try {
      const key = JSON.stringify([deck.cardIds,opponent.cardIds,tier,seat,policyName]);
      let r = cache.get(key);
      if (!r) { r = simulateBalanceMatch({deckA:deck,deckB:opponent,districtSeed:'full-roster-sweep-2026-10-07',rotation:0,tier,seat,policy,allowSquabble:true}); cache.set(key,r); }
      rows.push({ opponent: opponent.id, tier, seat, policy: policyName, score:r.logicalWinner==='a'?1:r.logicalWinner==='draw'?.5:0, observation:r.cardsA.find(c=>c.cardId===card.id) });
    } catch(e) { report.failures.push({card:card.id,opponent:opponent.id,tier,seat,policy:policyName,error:String(e)}); }
  }
  const obs=rows.map(r=>r.observation).filter(Boolean);
  report.cards.push({id:card.id,name:card.name,type:card.type,kind:card.kind??'character',cost:card.cost,power:card.power,ability:card.ability,effect:card.effect,roles:card.roles,authoredShells:authored.map(d=>d.id),shell:deck.cardIds,injected:!authored.length,games:rows.length,score:rows.reduce((n,r)=>n+r.score,0)/rows.length,played:obs.reduce((n,r)=>n+r.played,0),finalCopies:obs.reduce((n,r)=>n+r.finalCopies,0),finalPower:obs.reduce((n,r)=>n+r.finalPower,0),baseEvents:obs.reduce((n,r)=>n+r.abilityEvidence.baseEvents,0),directEvents:obs.reduce((n,r)=>n+r.abilityEvidence.baseDirectEffectEvents,0),nestedEvents:obs.reduce((n,r)=>n+r.abilityEvidence.baseNestedEffectEvents,0),noEffectEvents:obs.reduce((n,r)=>n+r.abilityEvidence.baseNoObservedEffectEvents,0),rows});
  if(report.cards.length%20===0) console.log(`${report.cards.length}/${eligible.length} considered; ${report.failures.length} failures`);
}
report.uniqueSimulations = cache.size;
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/sweep.json`,JSON.stringify(report,null,2));
console.log(`Complete: ${report.cards.length} cards; ${report.cards.reduce((n:any,c:any)=>n+c.games,0)} games; ${report.failures.length} failures`);
if(report.failures.length)process.exitCode=1;
