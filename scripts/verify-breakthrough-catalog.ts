/** Release acceptance matrix; complements authored rule tests and rendered presentation proof. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { advance, createGame, deploy, deploymentChoices, deploymentCost, effectiveHands, isActionCard, type FighterDefinition, type GameState, type Lane, type Side, type Unit } from '../lib/squabblemon-engine/src/breakthrough';
import { BREAKTHROUGH_ROSTER, getBreakthroughLaunchCoverage } from '../lib/squabblemon-engine/src/breakthroughCatalog';
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function fixture(card: FighterDefinition, lastStand: boolean): GameState {
  const deck = [
    card.id,
    ...BREAKTHROUGH_ROSTER.filter((c) => c.id !== card.id)
      .slice(0, 9)
      .map((c) => c.id),
  ];
  const s = createGame(BREAKTHROUGH_ROSTER, {
    seed: 71231,
    decks: { player: deck, opponent: deck },
    travelMs: 12000,
  });
  s.elapsedMs = lastStand ? s.durationMs - 20000 : 0;
  if (lastStand) s.drawsLocked = true;
  for (const side of ['player', 'opponent'] as const) {
    s.players[side].hand = side === 'player' ? [card.id] : [];
    s.players[side].queue = [];
    s.players[side].motion = 9;
    s.players[side].nextDrawAt = 1e9;
  }
  for (const side of ['player', 'opponent'] as const)
    for (const lane of [0, 1, 2] as const) {
      const id = side === 'player' ? 'edgar' : 'nguyen',
        def = BREAKTHROUGH_ROSTER.find((c) => c.id === id)!;
      const u: Unit = {
        id: `fixture-${side}-${lane}`,
        cardId: id,
        side,
        lane,
        position: side === 'player' ? 0.1 : 0.9,
        hands: 12,
        baseHands: def.hands,
        maxHands: 16,
        damageTaken: 4,
        squabbled: false,
        nextEffectAt: 1e9,
        origin: 'deck',
      };
      s.units.push(u);
      s.units.push({
        ...u,
        id: `${u.id}-second`,
        cardId: 'racially-ambiguous-transplant',
      });
    }
  return s;
}
function invariant(s: GameState, context: string) {
  assert.equal(
    new Set(s.units.map((u) => u.id)).size,
    s.units.length,
    `${context}: instance ids`,
  );
  for (const side of ['player', 'opponent'] as Side[]) {
    assert(
      Number.isFinite(s.players[side].motion),
      `${context}: finite Motion`,
    );
    assert(
      s.players[side].motion >= -1e-8 && s.players[side].motion <= 9 + 1e-8,
      `${context}: Motion bounds`,
    );
    assert.equal(
      s.players[side].reinforcements.length,
      0,
      `${context}: no deployment wait`,
    );
  }
  for (const u of s.units) {
    assert(Number.isFinite(u.hands), `${context}: Hands`);
    assert(Number.isFinite(effectiveHands(u)), `${context}: effective Hands`);
    assert([0, 1, 2].includes(u.lane), `${context}: legal lane`);
    assert(u.position >= 0 && u.position <= 1, `${context}: track bounds`);
  }
}

const coverage=getBreakthroughLaunchCoverage();
const cards=[];
for (const card of BREAKTHROUGH_ROSTER) {
  let scenarios=0, choices=0;
  for (const lastStand of [false,true]) for (const side of ['player','opponent'] as const) for (const lane of [0,1,2] as Lane[]) {
    const initial=fixture(card,lastStand);
    initial.players.player.hand=[]; initial.players.opponent.hand=[];
    initial.players[side].hand=[card.id];
    const before=copy(initial), label=`${card.id}/${side}/${lane}/${lastStand}`;
    if (!Number.isFinite(deploymentCost(initial,side,card.id,lane))) {
      const bad=deploy(initial,side,card.id,lane);
      assert(bad.error,`${label}: invalid lane accepted`); assert.equal(bad.state,initial); continue;
    }
    const plan=deploymentChoices(initial,side,card.id,lane);
    const options=plan.options.filter(o=>!o.disabled).map(o=>o.value);
    for (const choice of options.length ? options : [undefined]) {
      const target=choice===undefined?undefined:{choice};
      const apply=()=>deploy(initial,side,card.id,lane,false,target);
      const result=apply();
      assert.equal(result.error,undefined,`${label}: ${result.error}`);
      assert.deepEqual(initial,before,`${label}: input mutation`);
      assert.deepEqual(apply(),result,`${label}: activation determinism`);
      assert.equal(result.state.elapsedMs,initial.elapsedMs);
      assert.equal(result.state.commands.at(-1)?.cardId,card.id);
      if(isActionCard(card))assert(!result.state.units.some(u=>u.cardId===card.id));
      invariant(result.state,label);
      const bad=deploy(initial,side,card.id,3 as Lane,false,target);
      assert(bad.error); assert.equal(bad.state,initial); assert.deepEqual(initial,before);
      if(options.length) {
        const wrong=deploy(initial,side,card.id,lane,false,{choice:'invalid-release-choice'});
        assert(wrong.error,`${label}: invalid choice accepted`);assert.equal(wrong.state,initial);
      }
      const next=advance(result.state,12000);
      assert.deepEqual(advance(copy(result.state),12000),next,`${label}: checkpoint continuation`);
      invariant(next,label);
      const duration=next.durationMs-next.elapsedMs+30000;
      const final=advance(next,duration);
      invariant(final,label);
      assert.notEqual(final.winner,null,`${label}: match failed to terminate`);
      assert.deepEqual(advance(copy(next),duration),final,`${label}: terminal replay`);
      scenarios++; if(choice!==undefined)choices++;
    }
  }
  assert(scenarios>=4,`${card.id}: inadequate legal scenarios`);
  cards.push({cardId:card.id,scenarios,choices,checks:['activation','targeting','rejected-input','interaction','lifecycle','last-stand','deterministic-replay']});
}
const output={evidenceId:'kumite-netlify-launch-20261105',ruleset:coverage.ruleset,catalogSignature:coverage.catalogSignature,catalogSha256:createHash('sha256').update(coverage.catalogSignature).digest('hex'),cards,limitation:'Presentation is verified separately in the rendered BreakthroughArena; authored module tests remain the effect-specific oracle.'};
writeFileSync(process.argv[2]??'/tmp/bt-catalog-mechanics.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({cards:cards.length,scenarios:cards.reduce((sum,c)=>sum+c.scenarios,0),choices:cards.reduce((sum,c)=>sum+c.choices,0),signatureBytes:coverage.catalogSignature.length,status:'passed'}));
