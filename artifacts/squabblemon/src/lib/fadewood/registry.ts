import type { StoryCampaign, StoryNodeProgress } from '@workspace/api-client-react';
import { storySeasons } from '@workspace/squabblemon-engine/storySeasons';
import data from './arc-data.json';
import { readStoryResume } from './journey';
import tracking from './node-tracking.json';

export type FadewoodArc = { id: string; title: string; chapterIds: readonly string[]; hostId: string; arrivalId: string; participantIds: readonly string[]; available: boolean };
export const FADEWOOD_ARCS: readonly FadewoodArc[] = data.map(item => {
  const season = storySeasons.find(s => s.id === item.id);
  return { id: item.id, title: season?.title ?? item.fallbackTitle, chapterIds: season?.chapterIds ?? item.fallbackChapterIds, hostId: item.hostId, arrivalId: item.arrivalId, participantIds: item.participantIds, available: !!season };
});
export const getArcForChapter = (id: string) => FADEWOOD_ARCS.find(arc => arc.chapterIds.includes(id));
export function resolveContinue(campaign: StoryCampaign, accountId: string, arcId?: string): { arc: FadewoodArc; node: StoryNodeProgress } | null {
  const saved = readStoryResume(accountId);
  const requestedArc = arcId ? FADEWOOD_ARCS.find(a => a.id === arcId) : undefined;
  if (arcId && (!requestedArc || !requestedArc.available)) return null;
  const usable = (n: StoryNodeProgress) => n.status !== 'locked' && !!getArcForChapter(n.chapterId)?.available && (!requestedArc || requestedArc.chapterIds.includes(n.chapterId));
  const metadata = tracking.nodes as Record<string, { token: string; post: number; participants: string[] }>;
  const hasPost = (n: StoryNodeProgress) => {
    const m = metadata[n.nodeId];
    return n.cleared && n.kind === 'battle' && !!m && Array.from({length:m.post},(_,i)=>`${m.token}:post:${i}`).some(token => !n.dialogueSeen.includes(token));
  };
  // Authoritative play history recovers the arc after a new session. Old unread
  // dialogue must not pull a player back from a more recently played chapter.
  const latestPlayed = campaign.nodes.filter(n => usable(n) && n.lastPlayedAt).sort((a,b)=>Date.parse(b.lastPlayedAt!) - Date.parse(a.lastPlayedAt!))[0];
  const savedNode = saved && campaign.nodes.find(n => n.nodeId === saved.nodeId && usable(n));
  const savedIsCurrent = !!saved && (!latestPlayed || Date.parse(latestPlayed.lastPlayedAt!) <= saved.updatedAt)
    && (!savedNode?.cleared || !latestPlayed || latestPlayed.nodeId === savedNode.nodeId);
  let node = savedIsCurrent && savedNode && (!savedNode.cleared || hasPost(savedNode)) ? savedNode : undefined;
  if (latestPlayed && !latestPlayed.cleared) node ??= latestPlayed;
  const sameSavedArc = !requestedArc
    ? (savedIsCurrent ? FADEWOOD_ARCS.find(a => a.id === saved!.arcId && a.available) : undefined) ?? (latestPlayed ? getArcForChapter(latestPlayed.chapterId) : undefined)
    : undefined;
  const remaining = campaign.nodes.filter(n => usable(n) && !n.cleared && n.status === 'available');
  node ??= remaining.find(n => sameSavedArc?.chapterIds.includes(n.chapterId) && !n.optional);
  node ??= remaining.find(n => n.nodeId === campaign.recommendedNodeId);
  node ??= remaining.find(n => !n.optional) ?? remaining[0];
  if (!node) return null;
  const arc = getArcForChapter(node.chapterId);
  return arc?.available ? { arc, node } : null;
}
export function getActiveCharacterId(arc: FadewoodArc, nodeId: string) {
  const item = (tracking.nodes as Record<string, { participants: string[] }>)[nodeId];
  return item?.participants.find(id => arc.participantIds.includes(id)) ?? arc.hostId;
}

export type WorldIntent = { kind: 'arc'; arcId: string } | { kind: 'mode'; route: string } | { kind: 'mail' };
export type WorldAction = { id: string; label: string; intent: WorldIntent };
const arc = (id: string): WorldAction => ({ id, label: FADEWOOD_ARCS.find(a => a.id === id)?.title ?? 'Story', intent: {kind:'arc',arcId:id} });
const mode = (id: string, label: string, route: string): WorldAction => ({id,label,intent:{kind:'mode',route}});
const mail: WorldAction = {id:'mail',label:'Your mail & deliveries',intent:{kind:'mail'}};
const market = mode('market','Enter Fade Market','/game/shop?view=corner');
const friends = mode('friends','Friendly Fades','/game/online?tab=friends');
const park = mode('ranked','Enter Fade Park','/game/online');
const home = mode('safehouse','Enter Safehouse','/game');
const dojo = mode('training','Practice at the Dojo','/game/training');
const kumite = mode('arena','Enter Kumite','/game/kumite');
const breakthrough = mode('breakthrough-practice','Breakthrough · CPU practice','/game/kumite/breakthrough/practice');
const patrol = mode('patrol','Punch on Patrol','/game/challenges?game=punch-on-patrol');
const events = mode('events','Events on the block','/game/events');
const bounties = mode('bounties','Check the bounties','/game/missions');
const S1=()=>arc('season-1'), S2=()=>arc('season-2');
const ACTIONS: Record<string, readonly WorldAction[]> = {
  cornball:[S1(),market], 'ganger-blue':[S1(),friends], 'ganger-red':[S1(),friends], 'og-blue':[friends], 'og-red':[friends],
  'homeless-guy':[arc('special-leon'),mail], 'squabble-house-manager':[arc('special-squabble-house'),market],
  wifey:[S2(),friends], 'baby-momma':[S1(),park], 'inmate-kingpin':[arc('special-cellblock')], yasuke:[arc('special-yasuke'),dojo],
  mailman:[mail,home], 'dr-fade':[kumite,breakthrough,arc('special-kumite-break-the-bracket'),dojo], 'blue-yb':[friends], sherlock:[arc('special-sherlock')],
  'golden-doberman':[home,dojo], 'cracked-head':[S1(),S2()], snitch:[S1(),S2()], 'officer-oinkston':[patrol,S2()],
  'alice-hat':[arc('special-alice')], 'anunaki-ufo':[arc('special-anunaki-arrival')], 'underground-arena':[kumite,breakthrough,arc('special-kumite-break-the-bracket')],
  'safehouse-door':[home], safehouse:[home], 'story-mural':[arc('special-oz')], 'oz-mural':[arc('special-oz')],
  'squabble-house':[arc('special-squabble-house')], 'fade-market':[market], 'blue-block':[S1()], 'red-block':[S1()], county:[arc('special-cellblock')],
  'fade-park-bulletin':[events,bounties], 'post-office':[mail], 'fade-park':[park,friends], dojo:[dojo,arc('special-yasuke')], 'open-garage':[S1()],
};
const LEGACY_SCREENS: Record<string,string>={blueWelcome:'season-1',bluePressure:'season-1',redReceipts:'season-1',redRetaliation:'season-1',seasonOne:'season-1',seasonTwo:'season-2',sherlock:'special-sherlock',alice:'special-alice',yasuke:'special-yasuke',cellblock:'special-cellblock',leon:'special-leon',diner:'special-squabble-house',crackedHead:'season-1',snitch:'season-1',noiseComplaint:'season-2',storyArchive:'special-anunaki-arrival'};
export const isMemorialSource = (sourceId: string) => sourceId === 'nova';
export const getWorldActions = (sourceId: string): readonly WorldAction[] => !isMemorialSource(sourceId) && Object.hasOwn(ACTIONS,sourceId) ? ACTIONS[sourceId] : [];
/** Current narrative participants may offer an arc outside their fixed neighborhood roles. */
export function getWorldActionsForCampaign(sourceId: string, campaign: StoryCampaign, accountId: string, preferredArcId?: string): readonly WorldAction[] {
  if (isMemorialSource(sourceId)) return [];
  const actions = [...getWorldActions(sourceId)];
  for (const candidate of FADEWOOD_ARCS) {
    const next = resolveContinue(campaign, accountId, candidate.id);
    if (!next || getActiveCharacterId(candidate, next.node.nodeId) !== sourceId) continue;
    if (!actions.some(action => action.id === candidate.id)) actions.push(arc(candidate.id));
  }
  const preferred = actions.findIndex(action => action.id === preferredArcId);
  if (preferred > 0) actions.unshift(...actions.splice(preferred, 1));
  return actions;
}
export function resolveWorldIntent(sourceId: string, screenId?: string): WorldIntent | null {
  const actions=getWorldActions(sourceId);
  if (!screenId) return actions[0]?.intent ?? null;
  const id=Object.hasOwn(LEGACY_SCREENS,screenId)?LEGACY_SCREENS[screenId]:screenId;
  return actions.find(a=>a.id===id)?.intent ?? null;
}
const HOST_NAMES:Record<string,string>={cornball:'Cornball',wifey:'Wifey',sherlock:'Sherlock','oz-mural':'The Yellow Line mural','story-mural':'The Yellow Line mural','alice-hat':'The moving hat',yasuke:'Yasuke','inmate-kingpin':'Inmate Kingpin','homeless-guy':'Leon','squabble-house-manager':'The Manager','dr-fade':'Dr. Fade','anunaki-ufo':'Anunaki UFO',mailman:'The Mailman','officer-oinkston':'Officer Oinkston','ganger-blue':'Ganger Blue','ganger-red':'Ganger Red','og-blue':'OG Blue','og-red':'OG Red','baby-momma':'Baby Momma','cracked-head':'Cracked Head',snitch:'Snitch','blue-yb':'Blue YB',nova:'Nova','golden-doberman':'Golden Doberman','fade-park-bulletin':'Events & bounties','safehouse-door':'Safehouse',safehouse:'Safehouse','post-office':'Post Office','underground-arena':'Underground arena','demario-luigion-booth':'DeMario & Luigion'};
export const getHostName=(id:string)=>Object.hasOwn(HOST_NAMES,id)?HOST_NAMES[id]:id.replaceAll('-',' ');
export const WORLD_PLACES = [
  {id:'squabble-house',name:'Squabble House',note:'The Last Waffle'}, {id:'fade-market',name:'Fade Market',note:'Store & neighborhood'},
  {id:'blue-block',name:'Blue Block',note:'Around the block'}, {id:'red-block',name:'Red Block',note:'Across the street'},
  {id:'county',name:'County / Library',note:'The Library Hour'}, {id:'post-office',name:'Post Office',note:'Mail & deliveries'},
  {id:'fade-park',name:'Fade Park',note:'Ranked & friendly fades'}, {id:'dojo',name:'Dojo',note:'Yasuke & practice'},
  {id:'open-garage',name:'Open Garage',note:'Cracked Head'}, {id:'safehouse',name:'Safehouse',note:'Home court'},
  {id:'underground-arena',name:'Underground arena',note:'Kumite'}, {id:'anunaki-ufo',name:'Anunaki UFO',note:'Anunaki signal'},
  {id:'story-mural',name:'Story mural',note:'The Yellow Line'},
  {id:'fade-park-bulletin',name:'Events & Bounties',note:'The Fade Park bulletin board'},
  {id:'demario-luigion-booth',name:'DeMario & Luigion',note:'Smoke shop · Chapter in development'},
] as const;
