import managerCinematic from "../assets/promotion/squabblehouse-openart-cinematic-v1.mp4";
import managerPoster from "../assets/promotion/squabblehouse-manager-poster-v1.webp";
import { canPlayOptionalBroadcast } from "../lib/optionalBroadcastMedia";
import { useEffect, useState } from "react";
import { rankProgress, type RankedResult } from "@workspace/squabblemon-engine/ranked";
import { RankTrophy } from "./RankArtwork";
import { GameGlyph } from "./venue/GameGlyph";
import { AnimatedNumber } from "./AnimatedNumber";
import { DialogTitle, DialogDescription } from "./ui/dialog";
import "../styles/rank-up-reward.css";
export function RankUpReward({
  rank,
  reduced,
  onDone,
}: {
  rank: RankedResult;
  reduced: boolean;
  onDone: () => void;
}) {
  const [backgroundMotion, setBackgroundMotion] = useState(
    () => !reduced && canPlayOptionalBroadcast(),
  );
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const refresh = () =>
      setBackgroundMotion(!reduced && canPlayOptionalBroadcast());
    refresh();
    document.addEventListener("visibilitychange", refresh);
    media.addEventListener("change", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      media.removeEventListener("change", refresh);
    };
  }, [reduced]);
  const rewards = rank.rewards ?? [];
  const earnedTier = rankProgress(rank.after).tier;
  return (
    <div
      className="rank-promotion"
      data-reduced-motion={reduced}
      data-testid="rank-promotion"
    >
      <div className="rank-promotion__cinema" aria-hidden="true">
        <img src={managerPoster} alt="" />
        {backgroundMotion && !videoFailed && (
          <video
            src={managerCinematic}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              if (event.currentTarget.duration > 55) {
                event.currentTarget.currentTime = 50;
              }
            }}
            onError={() => setVideoFailed(true)}
          />
        )}
      </div>
      <div className="rank-promotion__hero">
        <span>FADE PARK · PROMOTION SECURED</span>
        <DialogTitle>
          THE BLOCK
          <br />
          <em>KNOWS YOUR NAME.</em>
        </DialogTitle>
        <div className="rank-promotion__emblem">
          <RankTrophy tier={earnedTier} />
        </div>
        <strong>{earnedTier}</strong>
        <p>
          <AnimatedNumber
            value={rank.after}
            from={rank.before}
            reducedMotion={reduced}
          />{" "}
          RP
        </p>
      </div>
      <section className="rank-promotion__haul">
        <DialogDescription>
          {rewards.length ? 'Your rank rewards are already saved in your bag. Each milestone pays once per season.' : 'Milestone gifts pay once per season. This promotion has no new gift.'}
        </DialogDescription>
        <div>
          {rewards.map((reward) => (
            <article key={reward.tier}>
              <span>{reward.tier.toUpperCase()} REWARD</span>
              <p>
                <GameGlyph name="cloutStack" />
                <b>+{reward.softCurrency}</b> Clout
              </p>
              <p>
                <GameGlyph name="ticket" />
                <b>+{reward.packTickets}</b> Tickets
              </p>
              <p>
                <GameGlyph name="shards" />
                <b>+{reward.styleShards}</b> Shards
              </p>
            </article>
          ))}
        </div>
        <button className="rank-promotion__continue" onClick={onDone}>
          KEEP MY SPOT <GameGlyph name="fight" />
        </button>
      </section>
    </div>
  );
}
