import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { getGetPlayerStoryQueryKey, useGetPlayerStory, type PlayerBootstrap } from '@workspace/api-client-react';
import { ArrowRight } from 'lucide-react';
import { SceneFrame, sendScene } from '../../components/venue/SceneFrame';
import { storyContent } from '@workspace/squabblemon-engine/story';
import '../../styles/studio.css';
import '../../styles/safehouse-stage.css';

export function Home({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
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
  useEffect(() => { sendScene(frame, { type: 'view', view: 'room' }); }, []);
  const claimedBadge = claimed > 0;

  return (
    <div
      className="safehouse venue-page studio-page safehouse-stage safehouse-stage--hero"
      data-view="room"
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
        <div className="safehouse__heading-actions">
          <Link href="/game/play" className="studio-action studio-action--gold">
            Run the block
            <ArrowRight size={16} />
          </Link>
          {claimedBadge && (
            <Link href="/game/missions" className="safehouse__heading-bounties">
              <span>{claimed} {claimed === 1 ? 'bounty' : 'bounties'} ready</span>
              <ArrowRight size={12} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
