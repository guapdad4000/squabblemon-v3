import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { getGetPlayerStoryQueryKey, useGetPlayerStory, type PlayerBootstrap } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, Moon, Sun, RotateCcw, Tv, Dumbbell, Layers, Smartphone, Disc3, Move, MousePointer2 } from 'lucide-react';
import { PageDecor } from '../../components/venue/PageDecor';
import { MusicControls } from '../../components/MusicControls';
import { useMusic, musicActions } from '../../musicStore';
import { catalogCardById, getCardImage } from '../../data';
import { soundtrack } from '../../musicPlayer';
import { SceneFrame, sendScene, type SceneMessage } from '../../components/venue/SceneFrame';
import { storyContent } from '@workspace/squabblemon-engine/story';
import '../../styles/studio.css';
import '../../styles/safehouse-stage.css';

const stations = [
  { id: 'story', label: 'The television', short: 'Story', icon: Tv, title: 'The block is waiting.', detail: 'Pick up your story where you left it.', action: 'Hit the streets', href: '/game/story' },
  { id: 'training', label: 'The heavy bag', short: 'Train', icon: Dumbbell, title: 'Stay ready.', detail: 'Get your reps in. Then put your crew to work.', action: 'Start training', href: '/game/play' },
  { id: 'cards', label: 'Your crew cards', short: 'Crew', icon: Layers, title: 'Every legend starts here.', detail: 'Build the lineup that runs your block.', action: 'Build your crew', href: '/game/decks' },
  { id: 'phone', label: 'The phone', short: 'Fight', icon: Smartphone, title: 'Call somebody out.', detail: 'Your friend. Your crew. A score to settle.', action: 'Challenge a friend', href: '/game/online' },
  { id: 'music', label: 'The turntable', short: 'Records', icon: Disc3, title: 'Oakland Chrome and Curls.', detail: 'Original music by Treblo. Made for the block.', action: '', href: '' },
] as const;
type Station = typeof stations[number]['id'];

// Keep the one set of room controls reachable when an object moves out of view.
// Read geometry before writing positions, and use nearby free spots for overlapping labels.
function positionRoomMarkers(layer: HTMLElement, frame: HTMLIFrameElement, markers: Map<string, HTMLButtonElement>, anchors: NonNullable<SceneMessage['anchors']>) {
  if (layer.hidden) return;
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
  }
}

export function Home({ bootstrap, onGuideComplete }: { bootstrap: PlayerBootstrap; onGuideComplete?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [view, setView] = useState<Station | 'room'>('room');
  const [night, setNight] = useState(() => {
    try { return localStorage.getItem('squabblemon_safehouse_lighting') !== 'golden'; } catch { return true; }
  });
  const music = useMusic();
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const markerLayer = useRef<HTMLElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const previousView = useRef<Station | 'room'>('room');
  const station = stations.find(item => item.id === view);
  const crew = (bootstrap.profile.savedDecks[0]?.cardIds ?? bootstrap.profile.ownedCardIds).slice(0, 3).map(id => catalogCardById[id]).filter(Boolean);
  function explore(next: Station | 'room') { setView(next); sendScene(frame, { type: 'view', view: next }); }
  function receive(message: SceneMessage) {
    if (message.type === 'interact' && music.enabled && !music.playing) musicActions.play();
    if (message.type === 'view' && (message.view === 'room' || stations.some(item => item.id === message.view))) setView(message.view as Station | 'room');
    if (message.type === 'error') setSceneReady(false);
    if (message.type === 'anchors' && markerLayer.current && frame.current) {
      positionRoomMarkers(markerLayer.current, frame.current, markers.current, message.anchors ?? []);
    }
  }
  useEffect(() => {
    const previous = previousView.current;
    previousView.current = view;
    if (previous === view) return;
    if (view !== 'room') backButton.current?.focus({ preventScroll: true });
    else if (previous !== 'room') markers.current.get(previous)?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    sendScene(frame, { type: 'light', night });
    try { localStorage.setItem('squabblemon_safehouse_lighting', night ? 'night' : 'golden'); } catch { /* Preferences are optional. */ }
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
    sendScene(frame, { type: 'light', night });
    sendScene(frame, { type: 'music', playing: music.playing });
    sendScene(frame, { type: 'crew', cards: crew.map(card => ({ name: card.name, image: getCardImage(card.artworkId) })) });
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
      data-view={view} data-scene-ready={sceneReady} data-lighting={night ? 'night' : 'golden'}>
      <PageDecor theme="safehouse" />
      <SceneFrame kind="safehouse" frameRef={frame} poster={`${import.meta.env.BASE_URL}scenes/safehouse/concept.png`}
        onMessage={receive} onReady={() => { setSceneReady(true); syncRoom(); sendScene(frame, { type: 'view', view }); }} />
      <div className="safehouse__shade" />
      <header className="safehouse-room-header">
        <div className="safehouse-room-title"><span><i /> OAKLAND / HOME COURT</span><h1>The <span className="safehouse-room-title__hand">Safe</span>house<span className="safehouse-room-title__period">.</span></h1><p>The city can wait a minute.</p></div>
        <div className="safehouse-room-tools">
          <button type="button" className="room-tool" onClick={() => setNight(value => !value)}
            aria-label={night ? 'Switch to golden hour' : 'Switch to late night'} aria-pressed={night}>
            {night ? <Moon size={16} /> : <Sun size={16} />}<span>{night ? 'Late night' : 'Golden hour'}</span>
          </button>
          <MusicControls compact />
          <button type="button" className="room-tool room-tool--reset" aria-label="Reset room camera" onClick={() => explore('room')}><RotateCcw size={16} /></button>
        </div>
      </header>
      <nav ref={markerLayer} className="safehouse-room-markers" data-guide-fallback={Boolean(onGuideComplete && !sceneReady)} hidden={view !== 'room' || (!sceneReady && !onGuideComplete)} aria-label="Explore the safehouse">
        {stations.map(item => <button key={item.id} type="button" ref={node => { if (node) markers.current.set(item.id, node); else markers.current.delete(item.id); }}
          aria-label={`Explore ${item.label.toLowerCase()}`} onClick={() => explore(item.id)}>
          <item.icon size={16} aria-hidden="true" /><span>{item.short}</span>
        </button>)}
      </nav>
      <div className="safehouse-room-bottom">
        {station ? <section className="safehouse-room-detail" aria-live="polite" aria-label={station.label}>
          <button type="button" className="room-back" ref={backButton} onClick={() => explore('room')}><ArrowLeft size={14} /> Back to the room</button>
          <div className="safehouse-room-detail__body"><div><span className="room-eyebrow">{station.label}</span><h2>{station.title}</h2>
            <p>{station.id === 'music' ? `${music.playing ? 'Now playing' : 'On the turntable'}: ${soundtrack[music.trackIndex].title} · Treblo` : station.id === 'story' && chapter ? chapter.title : station.detail}</p></div>
            <div className="safehouse-room-actions">
              {station.id === 'music' ? <MusicControls /> : onGuideComplete && station.id === 'cards' ? <button className="room-action" onClick={onGuideComplete}>Build your crew<ArrowRight size={15} /></button> : <Link href={station.href} className="room-action">{station.action}<ArrowRight size={15} /></Link>}
              {station.id === 'training' && sceneReady && <button type="button" className="room-punch" onClick={() => sendScene(frame, { type: 'punch' })}>Hit the bag</button>}
            </div>
          </div>
        </section> : <div className="safehouse-room-welcome">
          <div><span className="room-eyebrow">YOUR CORNER OF THE CITY</span><p>Kick back. Build your crew. Run it back.</p></div>
          <Link href="/game/play" className="room-action">Run the block<ArrowRight size={15} /></Link>
        </div>}
        <div className="safehouse-room-hint"><span><Move size={11} /> Drag to look <i /> Pinch or scroll to zoom</span>
          {claimed > 0 ? <Link href="/game/missions">{claimed} {claimed === 1 ? 'bounty' : 'bounties'} ready <ArrowRight size={11} /></Link> : <span><MousePointer2 size={11} /> Tap an object to explore</span>}
        </div>
      </div>
    </div>
  );
}
