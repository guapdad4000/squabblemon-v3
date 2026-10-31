import type { CSSProperties } from 'react';
import { applyAnunakiRaidAction, ANUNAKI_RAID_DISTRICTS, ANUNAKI_RAID_LOANER, type AnunakiRaid } from '@workspace/squabblemon-engine/anunakiRaid';
import { getLaneScoreForMatch, getLegalCardCost, blockbusterExtraCost, type CardInstance, type Lane } from '../../gameEngine';
import type { BossRaid, BossStatus } from '@workspace/squabblemon-engine/bossRaid';
import type { BossRaidViewAdapter } from './bossRaidViewAdapter';
import type { DojoSpritePhase } from './DojoMotionSprite';
import { BossIdleSprite } from './BossIdleSprite';
import { getAssetUrl } from '../../lib/assets';
import { raidExtraChoice as anunakiRaidExtraChoice, raidCardChoices as anunakiRaidChoices } from './raidCardChoices';
export { raidExtraChoice as anunakiRaidExtraChoice, raidCardChoices as anunakiRaidChoices } from './raidCardChoices';

const PHASES = { descent: 'THE DESCENT', redirect: 'ANCIENT AUTHORITY', heaven: 'HEAVEN COMES DOWN' };
const laneHands = (raid: AnunakiRaid, lane: Lane, owner: 'player' | 'cpu') => getLaneScoreForMatch(raid.match, raid.match.boards[lane].filter(card => card.owner === owner), lane, owner);
export function anunakiRaidCardCost(raid: AnunakiRaid, card: CardInstance, lane: Lane, _squabble: boolean, investment: number) {
  return getLegalCardCost(raid.match, 'player', card, lane) + blockbusterExtraCost(card.cardId, anunakiRaidExtraChoice(card, investment));
}
export function anunakiRaidCanPlay(raid: AnunakiRaid, card: CardInstance, lane: Lane, squabble: boolean, investment: number) {
  try {
    applyAnunakiRaidAction(raid, { type: 'play', instanceId: card.instanceId, lane, squabble, investment: anunakiRaidExtraChoice(card, investment) });
    return true;
  } catch { return false; }
}

/** A read-only display projection. No legacy boss rules, campaign rewards or
 * persistence are executed with this status; native Anunaki intents own them. */
export function anunakiRaidViewStatus(raid: AnunakiRaid): BossStatus {
  const reward = raid.reward ?? { softCurrency: 0, packTickets: 0, styleShards: 0 };
  const run: BossRaid = { version: 1, rulesVersion: 2, id: raid.id, day: '', revision: raid.revision,
    phase: raid.status === 'active' ? 'active' : raid.status === 'retired' ? 'retired' : 'complete',
    deckName: 'Arrival crew', bossTier: 1, maxHp: raid.maxHp, startHp: raid.maxHp, match: raid.match,
    hp: raid.hp, score: raid.maxHp - raid.hp, blasts: [], log: raid.log, used: [], temporarySilences: [] };
  return { day: '', resetsAt: '', serverNow: 0, attemptsRemaining: 0, run, earned: reward, bestScore: run.score, history: [],
    campaign: { version: 2, tier: 1, hp: raid.hp, totalDamage: run.score, attacks: 1, tierAttacks: 1, defeated: [], completed: raid.status === 'won', earned: reward } };
}
export function makeAnunakiRaidViewAdapter(raid: AnunakiRaid, presentation: { phase?: DojoSpritePhase } = {}): BossRaidViewAdapter {
  const hands = ([0,1,2] as const).map(lane => laneHands(raid,lane,'player')) as [number,number,number];
  const policeHands = ([0,1,2] as const).map(lane => laneHands(raid,lane,'cpu')) as [number,number,number];
  const damage = hands.map(power => Math.max(0,power) * (raid.protection ? 1 : 2)) as [number,number,number];
  return {
    status: anunakiRaidViewStatus(raid),
    stageLabel: 'Anu First Arrival raid battle', mode: 'anunaki',
    background: getAssetUrl('assets/anunaki-event/descent.webp'),
    identity: { title: 'ANU', operation: 'THE FIRST ARRIVAL', opposition: 'Anunaki', lanes: ANUNAKI_RAID_DISTRICTS.map(d => d.name) },
    cinematic: {
      title: 'ANU', projectionLabel: 'FORMATION', lethalLabel: 'FINISHER', subtitle: `THE FIRST ARRIVAL · ${raid.difficulty.toUpperCase()}`,
      backdrop: getAssetUrl('assets/anunaki-event/descent.webp'), portrait: getAssetUrl('assets/anunaki-event/anu.webp'),
      sprite: ({ paused, reducedMotion }) => <BossIdleSprite className="raid-scene-portrait" asset="anunaki:boss-anu" name="Anu" paused={paused} reduced={reducedMotion} phase={presentation.phase ?? "idle"}/>,
      phaseLabel: PHASES[raid.phase], phase: raid.phase,
      meta: <><b>{raid.protection ? '✦ PROTECTED · HALF DAMAGE' : 'GATE OPEN · FULL DAMAGE'}</b><small>{raid.phase === 'heaven' ? `FINAL CHARGE ${raid.charge} / 3` : 'THREE PHASES · SIX ROUNDS'}</small></>,
    },
    preview: { hands, policeHands, winners: hands.map((power,lane) => power > policeHands[lane] ? 'player' : power < policeHands[lane] ? 'cpu' : 'draw'), armor: [0,0,0], damage, total: damage.reduce((sum,power) => sum + power,0) },
    canPlay: (_run,card,lane,squabble,investment) => anunakiRaidCanPlay(raid,card,lane,squabble,investment),
    cardCost: (_run,card,lane,squabble,investment) => anunakiRaidCardCost(raid,card,lane,squabble,investment),
    extraChoices: anunakiRaidChoices,
    directive: <><strong>⚡ NEXT STRIKE · {ANUNAKI_RAID_DISTRICTS[raid.targetLane].name.toUpperCase()}</strong><span>{raid.lastBlast ? `LAST STRIKE −${raid.lastBlast.damage} HP${raid.lastBlast.interrupted ? ' · CHARGE INTERRUPTED' : ''}. ` : ''}{raid.phase === 'heaven' ? `Interrupt the charge: ${raid.charge} / 3.` : 'Hold 6 Hands at the Conduit to reduce the strike.'}</span></>,
    persistenceNote: <>{raid.difficulty === 'training' ? 'PRACTICE · NO REWARDS' : 'SAVED AFTER EVERY MOVE · WEEKLY REWARDS CAPPED'} · Projection is before the enemy turn and round effects.</>,
    helpContent: <><small>THE ANUNAKI ARRIVAL · {raid.difficulty.toUpperCase()}</small><h2>BREAK THE ARRIVAL</h2><p>Play a six-round match. Surviving crew Hands strike Anu at ×2 after the announced attack and round effects. Protection halves that damage. The lane comparison shows your current formation, not a damage requirement.</p><p>At 70% and 35% HP, Anu changes phase at the round boundary. His next target is always announced. In Heaven Comes Down, interrupt the charge before its third round.</p>{ANUNAKI_RAID_DISTRICTS.map(district => <section key={district.name}><h3>{district.name}</h3><p>{district.rule} {district.objective}</p></section>)}<p>Your run saves after each move. Training pays no rewards. Standard and Ascended have first-clear rewards and a weekly reward cap. Retiring ends this run without a clear reward.</p></>,
    retire: { title: 'Retire this raid?', description: 'This ends your saved run. A clear reward requires defeating Anu. You can start another raid from the arrival gate.', action: 'RETIRE RAID' },
    districtRules: ANUNAKI_RAID_DISTRICTS,
    renderEnemy: (card, { paused, reducedMotion }) => (ANUNAKI_RAID_LOANER as readonly string[]).includes(card.cardId)
      ? <BossIdleSprite asset={card.cardId === 'anu' ? 'anunaki:boss-anu' : `anunaki:${card.cardId}`} name={card.name} paused={paused} reduced={reducedMotion}/> : null,
    hit: presentation.phase === 'recoil',
    targetLane: raid.targetLane,
    tabletLanes: raid.match.ancientTablets?.filter(tablet => tablet.owner === 'player').map(tablet => tablet.lane),
    style: { '--raid-accent': '#f0cb72', '--raid-cinema-energy': '#6affe1' } as CSSProperties,
  };
}
