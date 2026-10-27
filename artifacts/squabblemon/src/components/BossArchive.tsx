import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  BOSS_ARCHIVE,
  archiveDefeatedTier,
  type BossArchiveEntry,
} from "@workspace/squabblemon-engine/bossArchive";
import type { BossStatus } from "@workspace/squabblemon-engine/bossRaid";
import { getAssetUrl } from "../lib/assets";
import { CardInspector } from "./CardInspector";
import "../styles/boss-archive.css";
export function BossArchive({ playerId }: { playerId: string }) {
  const [selected, setSelected] = useState<BossArchiveEntry | null>(null);
  const [mode, setMode] = useState<"kumite" | "precinct">("kumite");
  const raid = useQuery({
    queryKey: ["boss-archive", playerId, mode],
    queryFn: ({ signal }) =>
      customFetch<BossStatus>(`/api/player/boss-raid?mode=${mode}`, { signal }),
    staleTime: 30000,
    retry: 1,
  });
  return (
    <section className="boss-archive" aria-label="Boss and Dojo archive">
      <header>
        <h2>BOSS & DOJO ARCHIVE</h2>
        <span>UNPLAYABLE IN PVP</span>
        <div role="group" aria-label="Archive faction">
          {(["kumite", "precinct"] as const).map((id) => (
            <button
              key={id}
              aria-pressed={id === mode}
              onClick={() => setMode(id)}
            >
              {id === "kumite" ? "DOJO" : "PRECINCT"}
            </button>
          ))}
        </div>
      </header>
      <div className="boss-archive__wall">
        {BOSS_ARCHIVE.filter((e) => e.mode === mode).map((entry) => {
          const defeated = archiveDefeatedTier(
            entry,
            raid.data?.campaign.defeated ?? [],
          );
          return (
            <button
              key={entry.id}
              className="boss-archive__plaque"
              onClick={() => setSelected(entry)}
              aria-label={`Inspect ${entry.name}, unplayable archive`}
            >
              <img
                src={getAssetUrl(entry.art)}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <strong>{entry.name}</strong>
              <small>
                {defeated
                  ? `DEFEATED · TIER ${defeated}`
                  : "BOSS THREAT · UNPLAYABLE"}
              </small>
            </button>
          );
        })}
      </div>
      {raid.isError && (
        <button onClick={() => void raid.refetch()}>Retry defeat record</button>
      )}
      {selected && (
        <CardInspector
          card={{
            ...selected,
            defeatedTier: archiveDefeatedTier(
              selected,
              raid.data?.campaign.defeated ?? [],
            ),
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
