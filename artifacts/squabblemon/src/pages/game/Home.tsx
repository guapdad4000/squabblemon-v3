import { StarterMythic } from '../../components/StarterMythic';
import { GameBackButton } from '../../components/venue/GameBackButton';
import { useViewMemory } from '../../lib/navigationMemory';
import { playInteractionSound, type InteractionSound } from '../../lib/interactionAudio';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { getGetPlayerStoryQueryKey, useGetPlayerStory, useListChallengeRuns, getListChallengeRunsQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { Briefcase, ArrowRight, Moon, Sun, Tv, Dumbbell, Layers, Smartphone, Disc3, Move, MousePointer2, Sprout, UserRound } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';
import { AccountRewards } from '../../components/AccountRewards';
import { MusicControls } from '../../components/MusicControls';
import { SafehouseMail, useSafehouseMail } from '../../components/SafehouseMail';
import { useMusic, musicActions } from '../../musicStore';
import { catalogCardById, getCardImage } from '../../data';
import { soundtrack } from '../../musicPlayer';
import { SceneFrame, sendScene, type SceneMessage } from '../../components/venue/SceneFrame';
import { storyContent } from '@workspace/squabblemon-engine/story';
import '../../styles/studio.css';
import '../../styles/safehouse-stage.css';
import { loadFeedbackPreferences } from '../../battleFeedback';
import { playVoiceLine, stopSoundEffect } from '../../lib/sfx';

const stations = [
  { id: 'mail', label: 'The mail door', short: 'Mail', icon: Briefcase, title: 'Special delivery.', detail: 'Letters, updates, and gifts from your people.', action: 'Open your mail', href: '' },
  { id: 'growth', label: 'Buddy’s plants', short: 'Growth Lab', icon: Sprout, title: 'Buddy’s Growth Lab', detail: 'Helping you get them hands holistically.', action: 'Enter Growth Lab', href: '' },
  { id: 'arcade', label: 'The arcade machine', short: 'Fadecade', icon: Tv, title: 'Got next?', detail: 'Straight to the Back, Stockz, and a whole room of challenges.', action: 'Enter the Fadecade', href: '/game/challenges' },
  { id: 'inventory', label: 'Your inventory bag', short: 'Bag', icon: Briefcase, title: 'Keep it in the bag.', detail: 'Your Clout, tickets, Style Shards, and collection. All accounted for.', action: 'Open your bag', href: '/game/inventory' },
  { id: 'story', label: 'The television', short: 'Story', icon: Tv, title: 'The block is waiting.', detail: 'Pick up your story where you left it.', action: 'Hit the streets', href: '/game/story' },
  { id: 'training', label: 'The heavy bag', short: 'Train', icon: Dumbbell, title: 'Stay ready.', detail: 'Get your reps in. Then put your gang to work.', action: 'Start training', href: '/game/training' },
  { id: 'cards', label: 'Your gang cards', short: 'Gang', icon: Layers, title: 'Every legend starts here.', detail: 'Build the lineup that runs your block.', action: 'Build your gang', href: '/game/decks' },
  { id: 'phone', label: 'The phone', short: 'Fight', icon: Smartphone, title: 'Call somebody out.', detail: 'Your friend. Your gang. A score to settle.', action: 'Challenge a friend', href: '/game/online' },
  { id: 'music', label: 'The turntable', short: 'Records', icon: Disc3, title: 'Fade Tunes.', detail: 'Music for the room. Made for the block.', action: '', href: '' },
  { id: 'profile', label: 'Your portrait shelf', short: 'Profile', icon: UserRound, title: 'This is who you represent.', detail: 'Your fighter tag, portrait, record, and style.', action: 'Open your profile', href: '/game/settings' },
] as const;
type Station = typeof stations[number]['id'];
const welcomedPlayers = new Set<string>();

// Keep the one set of room controls reachable when an object moves out of view.
// Read geometry before writing positions, and use nearby free spots for overlapping labels.
function positionRoomMarkers(layer: HTMLElement, frame: HTMLIFrameElement, markers: Map<string, HTMLButtonElement>, anchors: NonNullable<SceneMessage['anchors']>) {
  if (layer.hidden) return 0;
  resetRoomMarkers(markers);
  const area = layer.getBoundingClientRect();
  const scene = frame.getBoundingClientRect();
  const buttons = anchors.flatMap(anchor => {
    const button = markers.get(anchor.id);
    return button && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
      ? [{ anchor, button, width: button.offsetWidth, height: button.offsetHeight }] : [];
  });
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  for (const { anchor, button, width, height } of buttons) {
    const minX = width / 2, maxX = area.width - width / 2;
    const minY = height / 2, maxY = area.height - height / 2;
    const targetX = clamp(scene.left + anchor.x * scene.width / 100 - area.left, minX, maxX);
    const targetY = clamp(scene.top + anchor.y * scene.height / 100 - area.top, minY, maxY);
    const xs = [targetX, minX, maxX, ...placed.flatMap(p => [p.x - (p.width + width) / 2 - 8, p.x + (p.width + width) / 2 + 8])];
    const ys = [targetY, minY, maxY, ...placed.flatMap(p => [p.y - (p.height + height) / 2 - 8, p.y + (p.height + height) / 2 + 8])];
    let best = { x: targetX, y: targetY }, distance = Infinity;
    for (const x of xs) for (const y of ys) {
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      if (placed.some(p => Math.abs(x - p.x) < (width + p.width) / 2 + 7 && Math.abs(y - p.y) < (height + p.height) / 2 + 7)) continue;
      const nextDistance = (x - targetX) ** 2 + (y - targetY) ** 2;
      if (nextDistance < distance) { best = { x, y }; distance = nextDistance; }
    }
    placed.push({ ...best, width, height });
    button.style.left = `${best.x}px`;
    button.style.top = `${best.y}px`;
    button.style.visibility = 'visible';
    button.dataset.anchorPositioned = 'true';
  }
  return Array.from(markers.values()).filter(button => button.dataset.anchorPositioned === 'true').length;
}

function resetRoomMarkers(markers: Map<string, HTMLButtonElement>) {
  markers.forEach(button => {
    delete button.dataset.anchorPositioned;
    button.style.removeProperty('left');
    button.style.removeProperty('top');
    button.style.removeProperty('visibility');
  });
}

export function Home({ bootstrap, onGuideComplete }: { bootstrap: PlayerBootstrap; onGuideComplete?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const welcomeVoice = useRef<HTMLAudioElement | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  // Readiness and anchor projection are separate scene events; the guided tour
  // fallback must hold until markers have actually been placed on screen.
  const [markersPlaced, setMarkersPlaced] = useState(false);
  const [view, setView] = useViewMemory<Station | 'room'>(`home-view:${bootstrap.profile.id}`, 'room');
  const [growthOpen, setGrowthOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const mail = useSafehouseMail(bootstrap.profile.id);
  const unreadMail = (mail.data?.messages ?? []).filter(item => !item.readAt).length;
  const [night, setNight] = useState(() => {
    try { return localStorage.getItem('squabblemon_safehouse_lighting') === 'night'; } catch { return false; }
  });
  const music = useMusic();
  const arcadeRuns = useListChallengeRuns({ query: { queryKey: getListChallengeRunsQueryKey(), refetchOnMount: 'always', refetchInterval: 30_000 } });
  const arcadeProgress = { status: arcadeRuns.isError ? 'unavailable' : !Array.isArray(arcadeRuns.data) ? 'loading' : arcadeRuns.data.some(run => run.status === 'active') ? 'continue' : 'new', wins: Array.isArray(arcadeRuns.data) ? arcadeRuns.data.find(run => run.status === 'active')?.wins ?? 0 : 0 };
  useEffect(() => { sendScene(frame, { type: 'arcade', ...arcadeProgress }); }, [arcadeProgress.status, arcadeProgress.wins]);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const markerLayer = useRef<HTMLElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const previousView = useRef<Station | 'room'>('room');
  useEffect(() => {
    if (onGuideComplete) return;
    if (welcomedPlayers.has(bootstrap.profile.id)) return;
    welcomedPlayers.add(bootstrap.profile.id);
    welcomeVoice.current = playVoiceLine('home-fade', loadFeedbackPreferences().audioEnabled);
    return () => stopSoundEffect(welcomeVoice.current);
  }, [bootstrap.profile.id, onGuideComplete]);
  const station = stations.find(item => item.id === view);
  useEffect(() => {
    if (view !== 'mail') { setMailOpen(false); return; }
    const timer = window.setTimeout(() => setMailOpen(true), bootstrap.profile.settings.reducedMotion ? 0 : 950);
    return () => clearTimeout(timer);
  }, [view, bootstrap.profile.settings.reducedMotion]);
  useEffect(() => { sendScene(frame, { type: 'mail', unread: unreadMail }); }, [unreadMail]);
  useEffect(() => { sendScene(frame, { type: 'mail-overlay', open: mailOpen }); }, [mailOpen]);
  const crew = (bootstrap.profile.savedDecks[0]?.cardIds ?? bootstrap.profile.ownedCardIds).slice(0, 3).map(id => catalogCardById[id]).filter(Boolean);
  const profileCard = catalogCardById[bootstrap.profile.avatarKey]
    ?? bootstrap.profile.ownedCardIds.map(id => catalogCardById[id]).find(Boolean)
    ?? catalogCardById.cornball;
  function explore(next: Station | 'room') { setView(next); sendScene(frame, { type: 'view', view: next }); }
  function receive(message: SceneMessage) {
    if (message.type === 'interact' && music.enabled && !music.playing) musicActions.play();
    if (message.type === 'view' && (message.view === 'room' || stations.some(item => item.id === message.view))) setView(message.view as Station | 'room');
    if (message.type === 'loading') { setSceneReady(false); setMarkersPlaced(false); resetRoomMarkers(markers.current); }
    if (message.type === 'error') { setSceneReady(false); setMarkersPlaced(false); resetRoomMarkers(markers.current); }
    if (message.type === 'anchors' && markerLayer.current && frame.current) {
      if (!markerLayer.current.hidden) setMarkersPlaced(positionRoomMarkers(markerLayer.current, frame.current, markers.current, message.anchors ?? []) === markers.current.size);
    }
  }
  useEffect(() => {
    const previous = previousView.current;
    previousView.current = view;
    if (previous === view) return;
    const sounds: Partial<Record<Station | 'room', InteractionSound>> = {
      mail: 'door-knock', growth: 'crystal', arcade: 'arcade-beep',
      inventory: 'bag-open', story: 'film', training: 'machine',
      cards: 'cards-spread', phone: 'phone-ring', profile: 'ui-beep',
    };
    if (sounds[view]) playInteractionSound(sounds[view]!);
    if (view !== 'room') backButton.current?.focus({ preventScroll: true });
    else if (previous !== 'room') markers.current.get(previous)?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    sendScene(frame, { type: 'light', night });
    try { localStorage.setItem('squabblemon_safehouse_lighting', night ? 'night' : 'day'); } catch { /* Preferences are optional. */ }
  }, [night]);
  useEffect(() => { sendScene(frame, { type: 'music', playing: music.playing }); }, [music.playing]);
  const preview = bootstrap.profile.id === 'e2e-player';
  const storyQuery = useGetPlayerStory({
    query: { queryKey: getGetPlayerStoryQueryKey(), enabled: !preview },
  });
  const campaign = storyQuery.data;
  const validCampaign = campaign && typeof campaign === 'object' && Array.isArray(campaign.chapters);
  const chapter = validCampaign
    ? (campaign.chapters.find((c) => c.status !== 'locked' && c.status !== 'cleared') ?? campaign.chapters.at(-1))
    : undefined;
  const claimed = bootstrap.missions.filter((mission) => mission.status === 'claimable').length;

  const syncRoom = () => {
    sendScene(frame, { type: 'arcade', ...arcadeProgress });
    sendScene(frame, { type: 'mail', unread: unreadMail });
    sendScene(frame, { type: 'mail-overlay', open: mailOpen });
    sendScene(frame, { type: 'light', night });
    sendScene(frame, { type: 'music', playing: music.playing });
    sendScene(frame, { type: 'crew', cards: crew.map(card => ({ name: card.name, image: getCardImage(card.artworkId) })) });
    sendScene(frame, { type: 'profile', name: bootstrap.profile.displayName, image: getCardImage(profileCard.artworkId) });
    sendScene(frame, {
      type: 'settings',
      reducedMotion: bootstrap.profile.settings.reducedMotion,
    });
    const recommended = validCampaign
      ? campaign.nodes.find((node) => node.nodeId === campaign.recommendedNodeId)
      : undefined;
    const battles = validCampaign
      ? campaign.nodes.filter((node) => node.chapterId === chapter?.id && node.kind === 'battle')
      : [];
    sendScene(frame, {
      type: 'story',
      progress: {
        demo: !validCampaign,
        chapter: chapter?.order ?? 1,
        totalChapters: validCampaign ? campaign.chapters.length : storyContent.chapters.length,
        title: chapter?.title ?? storyContent.chapters[0]?.title ?? 'The block awaits',
        completedChapters: validCampaign ? campaign.chapters.filter((c) => c.status === 'cleared').length : 0,
        objective:
          recommended?.title ??
          (preview ? 'Preview save · explore your safehouse' : 'Connect to load campaign progress'),
        wins: battles.filter((node) => node.status === 'cleared').length,
        targetWins: battles.length || 1,
      },
    });
  };
  useEffect(syncRoom, [campaign, bootstrap.profile.settings.reducedMotion, preview, bootstrap.profile.savedDecks, bootstrap.profile.ownedCardIds]);
  useEffect(() => {
    const reset = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { setView('room'); sendScene(frame, { type: 'view', view: 'room' }); }
    };
    window.addEventListener('keydown', reset);
    return () => window.removeEventListener('keydown', reset);
  }, []);


  return (
    <div className="safehouse venue-page studio-page safehouse-stage safehouse-stage--hero world-decor-host"
      data-view={view} data-scene-ready={sceneReady} data-lighting={night ? 'night' : 'day'}>
      <AccountRewards bootstrap={bootstrap} open={growthOpen} onOpenChange={setGrowthOpen} />
      <SafehouseMail playerId={bootstrap.profile.id} open={mailOpen} onClose={() => { setMailOpen(false); explore('room'); }} />
      <Link className="safehouse-bounty-logo" href="/game/missions" aria-label={`Open bounties${claimed ? ` · ${claimed} ready` : ''}`}><img src={getAssetUrl('assets/bounty-hunter/hero.webp')} alt="" /><span className="sr-only">Bounties</span>{claimed > 0 && <b>{claimed}</b>}</Link>
      <StarterMythic bootstrap={bootstrap} placement="shortcut" autoShow={!onGuideComplete && view === 'room' && !growthOpen && !mailOpen} />
      <SceneFrame kind="safehouse" frameRef={frame} poster={`${import.meta.env.BASE_URL}scenes/safehouse/concept.png`}
        onMessage={receive} onReady={() => { resetRoomMarkers(markers.current); setMarkersPlaced(false); setSceneReady(true); syncRoom(); sendScene(frame, { type: 'view', view }); }} />
      <div className="safehouse__shade" />
      <header className="safehouse-room-header">
        <div className="safehouse-room-title"><span><i /> OAKLAND / HOME COURT</span><h1>The <span className="safehouse-room-title__hand">Safe</span>house<span className="safehouse-room-title__period">.</span></h1><p>The city can wait a minute.</p></div>
        <div className="safehouse-room-tools">
          <button type="button" className="room-tool" onClick={() => setNight(value => !value)}
            aria-label={night ? 'Switch to daylight' : 'Switch to late night'} aria-pressed={night}>
            {night ? <Moon size={16} /> : <Sun size={16} />}<span>{night ? 'Late night' : 'Daylight'}</span>
          </button>
        </div>
      </header>
      <nav ref={markerLayer} className="safehouse-room-markers" data-guide-fallback={Boolean(onGuideComplete && !markersPlaced)} hidden={view !== 'room' || (!sceneReady && !onGuideComplete)} aria-label="Explore the safehouse">
        {stations.map(item => <button key={item.id} type="button" ref={node => { if (node) markers.current.set(item.id, node); else markers.current.delete(item.id); }}
          aria-label={`Explore ${item.label.toLowerCase()}`} onClick={() => explore(item.id)}>
          <item.icon size={16} aria-hidden="true" /><span>{item.short}</span>{item.id === 'mail' && unreadMail > 0 && <b className="mail-count" aria-label={`${unreadMail} unread`}>{unreadMail}</b>}
        </button>)}
      </nav>
      <div className="safehouse-room-bottom">
        {station && station.id !== 'mail' ? <section className="safehouse-room-detail" aria-live="polite" aria-label={station.label}>
          <GameBackButton className="room-back" buttonRef={backButton} onClick={() => explore('room')} label="Back to the room" />
          <div className="safehouse-room-detail__body"><div><span className="room-eyebrow">{station.label}</span><h2>{station.id === 'growth' ? <>Buddy’s <em className="buddy-growth-word">Growth</em> Lab</> : station.title}</h2>
            <p>{station.id === 'music' ? `${music.playing ? 'Now playing' : 'On the turntable'}: ${music.track?.title ?? soundtrack[music.trackIndex].title}` : station.id === 'story' && chapter ? chapter.title : station.detail}</p></div>
            <div className="safehouse-room-actions">
              {station.id === 'growth' ? <div className="room-growth"><img className="room-growth__buddy" src={getAssetUrl('assets/buddy-growth/buddy-welcome.webp')} alt="Buddy welcomes you to his Growth Lab" width="720" height="960" /><button type="button" className="room-action" onClick={() => setGrowthOpen(true)}>Enter Growth Lab<ArrowRight size={15} /></button></div> : station.id === 'music' ? <MusicControls variant="dj" wrapperClassName="room-dj" /> : onGuideComplete && station.id === 'cards' ? <button className="room-action" onClick={onGuideComplete}>Build your gang<ArrowRight size={15} /></button> : <Link href={station.href} className="room-action">{station.action}<ArrowRight size={15} /></Link>}
              {station.id === 'training' && sceneReady && <button type="button" className="room-punch" onClick={() => { playInteractionSound('bag-hit'); sendScene(frame, { type: 'punch' }); }}>Hit the bag</button>}
            </div>
          </div>
        </section> : null}
        <div className="safehouse-room-hint"><span><Move size={11} /> Drag to look <i /> Pinch or scroll to zoom</span>
          {claimed > 0 ? <Link href="/game/missions">{claimed} {claimed === 1 ? 'bounty' : 'bounties'} ready <ArrowRight size={11} /></Link> : <span><MousePointer2 size={11} /> Tap an object to explore</span>}
        </div>
      </div>
    </div>
  );
}
