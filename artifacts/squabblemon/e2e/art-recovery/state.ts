import { createMatch, createCardInstance, playTurnCard, getCharacterDistrictMarks, nextRound, type Match, type Owner, type Lane } from '../../src/gameEngine';

// Exercise real ability resolution; no production account or invented active-item metadata.
export function createArtworkReviewMatch(): Match {
  let match: Match = { ...createMatch('block', 'block'), round: 3, boards: [[], [], []], playerHand: [], cpuHand: [] };
  const cast = (id: string, owner: Owner, lane: Lane) => {
    const card = createCardInstance(id, owner, 'art-review', match.nextEventSequence);
    match = playTurnCard({ ...match, phase: owner === 'player' ? 'player' : 'cpu-reveal',
      playerMotion: 9, cpuMotion: 9, [owner === 'player' ? 'playerHand' : 'cpuHand']: [card],
    }, owner, card.instanceId, lane);
  };
  cast('buddy', 'player', 0);
  cast('inmate-kingpin', 'cpu', 0);
  cast('abuela', 'player', 0);
  match.boards[2].push({ ...createCardInstance('bonnetgirl', 'cpu', 'guard-target', 99), lane: 2 });
  cast('queenofhearts', 'player', 2);
  return { ...match, phase: 'player', playerMotion: 3, playerHand: ['hooper','queenofhearts','buddy','og','transplant'].map((id,i)=>createCardInstance(id,'player','review-hand',i)) };
}
export const artworkReviewMarks = (match: Match) => getCharacterDistrictMarks(match);

export function artworkEffectScenario(kind: string) {
  let m = createArtworkReviewMatch();
  const cast = (id: string, owner: Owner, lane: Lane = 0) => {
    const c = createCardInstance(id, owner, 'cue-review', m.nextEventSequence);
    m = playTurnCard({...m, phase:owner==='player'?'player':'cpu-reveal', playerMotion:9, cpuMotion:9, [owner==='player'?'playerHand':'cpuHand']:[c]},owner,c.instanceId,lane);
  };
  if(kind==='sprout') { m=nextRound({...m,phase:'resolved',playerHand:[],cpuHand:[]});m=nextRound({...m,phase:'resolved',playerHand:[],cpuHand:[]}); }
  if(kind==='pass') cast('inmate-crafty','cpu',1);
  if(kind==='heal') {
    m={...createMatch('block','block'),round:3,boards:[[{...createCardInstance('og','player','healing-target'),lane:0,powerModifier:3}],[],[]],playerHand:[],cpuHand:[]};
    cast('abuela','player');cast('inmate-informant','cpu');cast('inmate-informant','cpu');
  }
  return m;
}
