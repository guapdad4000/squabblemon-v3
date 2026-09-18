import { GameGlyph } from '../../components/venue/GameGlyph';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { getGetPlayerStoryQueryKey, useGetPlayerStory, type PlayerBootstrap } from '@workspace/api-client-react';
import { ArrowRight, Layers, Moon, RotateCcw, Smartphone, Sun, Tv, Zap } from 'lucide-react';
import { SceneFrame, sendScene } from '../../components/venue/SceneFrame';
import { storyContent } from '@workspace/squabblemon-engine/story';
import '../../styles/studio.css';
import '../../styles/safehouse-stage.css';
import type { SceneMessage } from '../../components/venue/SceneFrame';

const stations = [
  {
    id: 'story',
    icon: Tv,
    glyph: 'story',
    number: '01',
    title: 'The streets',
    subtitle: 'Your story. Your territory.',
    action: 'Continue story',
    href: '/game/story',
    art: 'neighborhood-map',
    portrait: 'rastamon',
    color: '#ffcc1a',
  },
  {
    id: 'training',
    icon: Zap,
    glyph: 'fight',
    number: '02',
    title: 'Heavy hitters',
    subtitle: 'Your crew. Their problem.',
    action: 'Challenge a friend',
    href: '/game/online',
    portrait: 'ganger-red',
    color: '#fb4265',
  },
  {
    id: 'cards',
    icon: Layers,
    glyph: 'crew',
    number: '03',
    title: 'The lineup',
    subtitle: 'Every legend starts with a crew.',
    action: 'Manage decks',
    href: '/game/decks',
    art: 'deck-stack',
    portrait: 'og-uncle',
    color: '#bd83ff',
  },
  {
    id: 'phone',
    icon: Smartphone,
    glyph: 'bounty',
    number: '04',
    title: 'The hustle',
    subtitle: 'Check in. Cash out.',
    action: 'View bounties',
    href: '/game/missions',
    art: 'sticker-phone',
    portrait: 'techbro-rich',
    color: '#69b5ff',
  },
] as const;

export function Home({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const landmarks = useRef<HTMLDivElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [selected, setSelected] = useState('room');
  const [night, setNight] = useState(false);
  const preview = bootstrap.profile.id === 'e2e-player';
  const storyQuery = useGetPlayerStory({
    query: { queryKey: getGetPlayerStoryQueryKey(), enabled: !preview },
  });
  const campaign = storyQuery.data;
  const validCampaign = campaign && typeof campaign === 'object' && Array.isArray(campaign.chapters);
  const chapter = validCampaign
    ? (campaign.chapters.find((c) => c.status !== 'locked' && c.status !== 'cleared') ?? campaign.chapters.at(-1))
    : undefined;
  const activeStation = stations.find((station) => station.id === selected);
  const claimed = bootstrap.missions.filter((mission) => mission.status === 'claimable').length;

  const syncRoom = () => {
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
  useEffect(syncRoom, [campaign, bootstrap.profile.settings.reducedMotion, preview]);
  function focus(view: string) {
    setSelected(view);
    sendScene(frame, { type: 'view', view });
  }

  function receive(message: SceneMessage) {
    if (message.type === 'view' && message.view) setSelected(message.view);
    if (message.type === 'error') setSceneReady(false);
    if (message.type === 'anchors' && Array.isArray(message.anchors)) {
      for (const anchor of message.anchors) {
        if (
          !stations.some((station) => station.id === anchor.id) ||
          !Number.isFinite(anchor.x) ||
          !Number.isFinite(anchor.y)
        )
          continue;
        const marker = landmarks.current?.querySelector<HTMLElement>(`[data-station="${anchor.id}"]`);
        if (marker) {
          marker.style.left = `${anchor.x}%`;
          marker.style.top = `${anchor.y}%`;
          marker.style.visibility = anchor.visible ? 'visible' : 'hidden';
        }
      }
    }
  }
  return (
    <div
      className="safehouse venue-page studio-page safehouse-stage"
      data-view={selected}
      data-scene-ready={sceneReady}
    >
      <SceneFrame
        kind="safehouse"
        frameRef={frame}
        poster={`${import.meta.env.BASE_URL}scenes/safehouse/concept.png`}
        onReady={() => {
          setSceneReady(true);
          syncRoom();
        }}
        onMessage={receive}
      />
      <div className="safehouse__shade" />
      <div className="safehouse__heading">
        <span className="studio-eyebrow">Your home court</span>
        <h1>
          THE
          <br />
          <em>SAFEHOUSE</em>
        </h1>
        <p>
          Out there, earn your name.
          <br />
          In here, build your legacy.
        </p>
        <Link href="/game/play" className="studio-action studio-action--gold">
          Run the block
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="safehouse__tools">
        <button
          className="studio-icon"
          aria-label={night ? 'Switch to golden hour' : 'Switch to late night'}
          title={night ? 'Golden hour' : 'Late night'}
          onClick={() => {
            setNight(!night);
            sendScene(frame, { type: 'light', night: !night });
          }}
        >
          {night ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button
          className="studio-icon"
          aria-label="Reset room camera"
          title="Reset camera"
          onClick={() => focus('room')}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div
        ref={landmarks}
        className="safehouse-stage__landmarks"
        aria-label="Room landmarks"
        hidden={selected !== 'room' || !sceneReady}
      >
        {stations.map((station) => (
          <button
            key={station.id}
            data-station={station.id}
            style={{ '--station-color': station.color } as CSSProperties}
            aria-label={`Inspect ${station.title}`}
            onClick={() => focus(station.id)}
          >
            <station.icon size={17} />
            <span>{station.title}</span>
          </button>
        ))}
      </div>
      <div className="safehouse-stage__bottom">
        {activeStation ? (
          <div className="safehouse-stage__detail" style={{ '--station-color': activeStation.color } as CSSProperties}>
            <div>
              <span className="studio-eyebrow">Station {activeStation.number}</span>
              <h2>{activeStation.title}</h2>
              <p>{activeStation.subtitle}</p>
            </div>
            <Link href={activeStation.href} className="studio-action studio-action--gold">
              {activeStation.action}
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="safehouse-stage__hint">
            <span>Drag to explore. Choose a station.</span>
            {claimed > 0 && (
              <Link href="/game/missions">
                {claimed} bounties ready
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        )}
        <nav className="safehouse-stage__stations" aria-label="Safehouse stations">
          {stations.map((station) => (
            <button
              key={station.id}
              aria-pressed={selected === station.id}
              style={{ '--station-color': station.color } as CSSProperties}
              onClick={() => focus(station.id)}
            >
              <GameGlyph name={station.glyph} />
              <span>{station.title}</span>
              <i />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
