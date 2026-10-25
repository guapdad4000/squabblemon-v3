import { createMatch, createCardInstance, playTurnCard, pass, type Lane, type Match } from '../src/gameEngine';
import { computeBattleJob, computationMatch } from '../src/lib/battleComputation';
import { BattleWorkerClient } from '../src/lib/battleWorkerClient';
let acknowledgements = 0;
document.querySelector('#responsive')!.addEventListener('click', event => { (event.target as HTMLElement).textContent = `Input acknowledged: ${++acknowledgements}`; });
const client = new BattleWorkerClient();
function fixture(count: number) {
  let match = createMatch('block', 'combo');
  for (let i = 0; i < count; i++) {
    const owner = i % 2 ? 'cpu' : 'player';
    const card = createCardInstance('hooper', owner, 'worker-diagnostic', i);
    match = { ...match, round: 4, phase: owner === 'player' ? 'player' : 'cpu-reveal', [owner === 'player' ? 'playerHand' : 'cpuHand']: [card], [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 100 };
    match = playTurnCard(match, owner, card.instanceId, (Math.floor(i / 2) % 3) as Lane);
  }
  match = { ...match, phase: 'player', playerHand: [], cpuHand: ['snow', 'barber', 'hooper', 'buddy', 'wifey'].map((id, index) => createCardInstance(id, 'cpu', 'worker-rival', index)), playerMotion: 20, cpuMotion: 10 };
  return pass(match, 'player');
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
Object.assign(window, { battleWorkerDiagnostic: {
  async run(count: number) {
    const match = fixture(count);
    const job = { kind: 'rival' as const, input: computationMatch(match) };
    // Prime module loading and engine code before comparing deterministic work.
    await client.request({ kind: 'previews', input: { match: computationMatch({ ...match, phase: 'player' }, true), instanceId: 'none', squabble: false, lane: null, investment: 0 } });
    let timerTicks = 0;
    const timer = setInterval(() => { timerTicks++; }, 0);
    const syncStart = performance.now(); const baseline = computeBattleJob(job); const syncMs = performance.now() - syncStart;
    await new Promise(resolve => setTimeout(resolve, 0));
    timerTicks = 0;
    const workerStart = performance.now(); const pending = client.request(job); const dispatchMs = performance.now() - workerStart;
    const result = await pending; const elapsedMs = performance.now() - workerStart;
    clearInterval(timer);
    return { boardCards: count, events: match.effectLog.length, fullBytes: JSON.stringify(match).length, inputBytes: JSON.stringify(job).length, equal: equal(result, baseline), syncMs, dispatchMs, elapsedMs, timerTicks };
  },
  dispose() { client.dispose(); },
} });
