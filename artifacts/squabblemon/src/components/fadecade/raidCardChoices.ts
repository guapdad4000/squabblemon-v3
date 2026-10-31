import { bossCardCost, type BossRaid } from '@workspace/squabblemon-engine/bossRaid';
import { blockbusterExtraCost, type CardInstance, type Lane } from '../../gameEngine';

/** Native optional choices shared by every raid. Zero is Dice's canonical
 * one-Motion wager; ordinary fighters must never inherit another card's choice. */
export function raidExtraChoice(card: CardInstance, investment: number) {
  return ['homelessguy','the-dice-game','the-concert'].includes(card.cardId) ? investment : 0;
}
export function raidCardChoices(card: CardInstance) {
  if (card.cardId === 'homelessguy') return { label: 'Extra Motion investment', defaultValue: 0, options: [0,1,2,3,4].map(value => ({value,label:`Invest ${value} Motion`})) };
  if (card.cardId === 'the-dice-game') return { label: 'Dice wager', defaultValue: 0, options: [{value:0,label:'Wager 1 Motion'},{value:2,label:'Wager 2 Motion'},{value:3,label:'Wager 3 Motion'}] };
  if (card.cardId === 'the-concert') return { label: 'Concert mode', defaultValue: 0, options: [{value:0,label:'Hype · allies +3 / enemies +1 Hands'},{value:1,label:'Mosh · enemies −3 / allies −1 Hands'}] };
  return null;
}
/** Read-only quote of the existing applyBossAction → playTurnCard charge. Keep
 * bossCardCost's default RICO calculation unchanged inside the native engine. */
export function legacyRaidCardQuote(run: BossRaid, card: CardInstance, lane: Lane, _squabble = false, investment = 0) {
  return bossCardCost(run,card,lane,false,0) + blockbusterExtraCost(card.cardId,raidExtraChoice(card,investment));
}
