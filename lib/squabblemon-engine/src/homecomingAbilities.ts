import type { CardInstance, Lane, Match } from './gameEngine';
import type { CreativeTools } from './creativeReworks';

export const HOMECOMING_KIT_IDS = new Set(['counter', 'concrete', 'lola', 'repoman', 'madhatter']);
export type HomecomingTools = CreativeTools & {
  tow(m: Match, source: CardInstance, target: CardInstance): Match;
  returnAlly(m: Match, source: CardInstance, target: CardInstance): Match;
};
const lanes: Lane[] = [0, 1, 2];
const crew = (m: Match) => m.boards.flat().filter(c => !c.hazard && c.kind !== 'support');
const find = (m: Match, id: string) => crew(m).find(c => c.instanceId === id);
const identity = (c: CardInstance) => c.copiedAbilityCardId ?? c.cardId;
const active = (c: CardInstance) => !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened;
const weakest = (cs: CardInstance[], t: CreativeTools) => cs.sort((a,b) => t.power(a)-t.power(b) || a.instanceId.localeCompare(b.instanceId))[0];
const strongest = (cs: CardInstance[], t: CreativeTools) => cs.sort((a,b) => t.power(b)-t.power(a) || a.instanceId.localeCompare(b.instanceId))[0];
const space = (m: Match, c: CardInstance, lane: Lane) => m.boards[lane].filter(x => !x.hazard && x.owner === c.owner).length < 4;
const give = (m: Match, c: CardInstance, amount: number, t: CreativeTools) => t.modify(m,c.instanceId,x => ({...x,powerModifier:x.powerModifier+amount}));

export function homecomingReveal(m: Match, s: CardInstance, t: HomecomingTools, echoed: boolean): Match | null {
  if (!HOMECOMING_KIT_IDS.has(s.cardId)) return null;
  const before=m, lane=s.lane!;
  const allies=() => crew(m).filter(c => c.owner===s.owner && c.instanceId!==s.instanceId);
  let success=false, note='', targets:string[]=[];
  if (s.cardId==='counter') {
    const target=strongest(crew(m).filter(c => c.owner!==s.owner && c.lane===lane),t);
    if (target) {
      targets.push(target.instanceId);
      m=t.hit(m,s,target,3,'Wheel & Come Again: opening shot, -3 Hands.');
      const hit=find(m,target.instanceId);
      success=!hit || hit.powerModifier<target.powerModifier;
    }
    note='Wheel & Come Again: opening shot, -3 Hands. Up to two cross-district encores for -2 Hands, once per round.';
  } else if (s.cardId==='concrete') {
    for (const destination of lanes.filter(l=>l!==lane)) {
      if ((m.creativeMarks??[]).some(x=>x.kind==='home-parcel' && x.owner===s.owner && x.lane===destination && x.expires>=m.round)) continue;
      m={...m,creativeMarks:[...(m.creativeMarks??[]),{id:`home-parcel:${s.owner}:${destination}`,kind:'home-parcel',source:s,owner:s.owner,lane:destination,targets:[],expires:m.round+1}]};
      success=true;
    }
    note='From Home, With Love: care packages wait in the other districts through next round.';
  } else if (s.cardId==='lola') {
    // A guest already attending dinner cannot be booked again by an echo or another Lola.
    for (const origin of lanes.filter(l=>l!==lane)) {
      const guest=weakest(allies().filter(c=>c.lane===origin && t.canMove(m,c,lane)
        && !(m.creativeMarks??[]).some(x=>x.kind==='home-dinner' && x.targets.includes(c.instanceId))),t);
      if (!guest || !space(m,guest,lane)) continue;
      m=t.move(m,guest,lane,'Kain Muna!: come eat at Lola’s table.');
      const arrived=find(m,guest.instanceId);
      if (!arrived || arrived.lane!==lane) continue;
      m=give(t.cleanse(m,arrived.instanceId),arrived,1,t);
      m={...m,creativeMarks:[...(m.creativeMarks??[]),{id:`home-dinner:${guest.instanceId}`,kind:'home-dinner',source:s,owner:s.owner,lane,origin,targets:[guest.instanceId],expires:m.round}]};
      targets.push(guest.instanceId); success=true;
    }
    note=success?'Kain Muna!: guests cleansed and fed +1. Return home at round end for another +1.':'Kain Muna!: no movable guests or no room at the table.';
  } else if (s.cardId==='repoman') {
    const target=crew(m).filter(c=>c.owner!==s.owner && c.lane!==lane)
      .sort((a,b)=>Math.max(0,b.powerModifier)-Math.max(0,a.powerModifier) || b.cost-a.cost || a.instanceId.localeCompare(b.instanceId))[0];
    if (target) {
      targets.push(target.instanceId); m=t.tow(m,s,target);
      success=find(m,target.instanceId)?.lane===lane;
    }
    note=success?'Tow & Collect: towed the target and redistributed up to 3 bonus Hands.':'Tow & Collect: no tow completed; movement restrictions and defenses apply.';
  } else if (s.cardId==='madhatter') {
    const local=weakest(allies().filter(c=>c.lane===lane && (c.kind??'character')==='character'),t);
    if (local) {
      m=t.returnAlly(m,s,local);
      const hand=s.owner==='player'?'playerHand':'cpuHand';
      if (m[hand].some(c=>c.instanceId===local.instanceId)) {
        targets.push(local.instanceId); success=true;
        const remote=strongest(allies().filter(c=>c.lane!==lane && (c.kind??'character')==='character' && t.canMove(m,c,lane)),t);
        if (remote && space(m,remote,lane)) {
          m=t.move(m,remote,lane,'Change Places!: the stronger guest took the open seat.');
          if (find(m,remote.instanceId)?.lane===lane) {
            targets.push(remote.instanceId);
            if (local.cost===remote.cost) {
              m={...m,[hand]:m[hand].map(c=>c.instanceId===local.instanceId
                ? {...c,powerModifier:c.powerModifier+1,lastEffectNote:'Change Places!: returned with +2 Hands and a one-use −1 Motion credit.'} : c)};
              m=give(m,remote,1,t);
            } else if (local.cost<remote.cost) {
              m={...m,[hand]:m[hand].map(c=>c.instanceId===local.instanceId
                ? {...c,powerModifier:c.powerModifier+3,lastEffectNote:'Change Places!: returned with +4 Hands and a one-use −1 Motion credit.'} : c)};
              m=t.protect(m,s,remote.instanceId);
            } else {
              m=give(m,remote,3,t);
            }
          }
        }
      }
      note=success?'Change Places!: weaker guest returned with +1 Hand and a one-use −1 Motion credit; if another guest moved in, the cheaper guest also gained +3 Hands (equal costs: +1 each).':'Change Places!: no guest returned.';
    } else {
      m=give(m,s,2,t);
      success=true;
      note='Change Places!: alone here, Mad Hatter gains +2 Hands.';
    }
  }
  if (success && !echoed) m=t.train(m,s.instanceId);
  return t.event(before,m,s,targets,note);
}

/** Called only for genuine placements and successful moves, never an entrance echo. */
export function homecomingArrival(m: Match, id: string, t: CreativeTools): Match {
  const c=find(m,id); if (!c) return m;
  const parcel=(m.creativeMarks??[]).find(x=>x.kind==='home-parcel' && x.owner===c.owner && x.lane===c.lane && x.expires>=m.round && x.source.instanceId!==id);
  if (!parcel) return m;
  const before=m;
  m={...m,creativeMarks:m.creativeMarks!.filter(x=>x.id!==parcel.id)};
  const amount=c.type==='Earth' || c.type==='Rock'?2:1;
  m=give(t.cleanse(m,id),c,amount,t);
  return t.event(before,m,parcel.source,[id],`From Home, With Love: package opened, +${amount} ${amount===1?'Hand':'Hands'} and cleansed.`);
}

export function homecomingAfterPlay(m: Match, placed: CardInstance, t: CreativeTools): Match {
  if (placed.hazard || placed.kind==='support') return m;
  const sources=crew(m).filter(c=>c.owner===placed.owner && identity(c)==='counter' && c.instanceId!==placed.instanceId && c.lane!==placed.lane);
  for (const original of sources) {
    const s=find(m,original.instanceId);
    if (!s || !active(s) || s.homecomingEncoreRound===m.round || (s.homecomingEncores??0)>=2) continue;
    const target=strongest(crew(m).filter(c=>c.owner!==s.owner && c.lane===placed.lane),t);
    if (!target) continue;
    const before=m;
    // Spend before the shot, including blocked shots; no repeat from echoes or reactions.
    m=t.modify(m,s.instanceId,c=>({...c,homecomingEncoreRound:m.round,homecomingEncores:(c.homecomingEncores??0)+1}));
    m=t.hit(m,s,target,2,'Wheel & Come Again: encore shot, -2 Hands.');
    const hit=find(m,target.instanceId);
    if (!hit || hit.powerModifier<target.powerModifier) m=t.train(m,s.instanceId);
    m=t.event(before,m,s,[target.instanceId],'Wheel & Come Again: cross-district encore shot (two per match, once per round).');
  }
  return m;
}

export function homecomingRoundEnd(m: Match, t: CreativeTools): Match {
  for (const invitation of (m.creativeMarks??[]).filter(x=>x.kind==='home-dinner' && x.expires<=m.round)) {
    const before=m, guest=find(m,invitation.targets[0]);
    m={...m,creativeMarks:m.creativeMarks!.filter(x=>x.id!==invitation.id)};
    if (!guest || guest.lane!==invitation.lane || invitation.origin===undefined || !space(m,guest,invitation.origin) || !t.canMove(m,guest,invitation.origin)) {
      m=t.event(before,m,invitation.source,guest?[guest.instanceId]:[],'Kain Muna!: dinner ended; return blocked or guest already left.'); continue;
    }
    m=t.move(m,guest,invitation.origin,'Kain Muna!: heading home with leftovers.');
    if (find(m,guest.instanceId)?.lane===invitation.origin) m=give(m,guest,1,t);
    m=t.event(before,m,invitation.source,[guest.instanceId],'Kain Muna!: returned home, +1 Hand from leftovers.');
  }
  return m;
}
