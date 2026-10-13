import globeArt from '../assets/crew-select/global-globe-v1.webp';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { FighterPortrait } from "./profile/FighterPortrait";
import "../styles/community-crews.css";
type Standing = {
  name: string;
  avatarKey: string;
  position: number;
  points: number;
  tier: string;
  wins: number;
  games: number;
  isYou: boolean;
};
export type Standings = {
  season: string;
  total: number;
  updatedAt: string;
  leaders: Standing[];
  you: Standing | null;
};
export function GlobalStandings({ playerId }: { playerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({
    queryKey: ["park-standings", playerId],
    queryFn: ({ signal }) =>
      customFetch<Standings>("/api/multiplayer/ranked/standings", { signal }),
    staleTime: 60000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
  return (
    <section className="park-standings park-standings--globe" aria-labelledby="standings-title">
      <header>
        <span>THE WHOLE BLOCK</span>
        <h2 id="standings-title">
          GLOBAL <em>HANDS.</em>
        </h2>
        <p>
          {query.data?.you
            ? `You’re #${query.data.you.position} of ${query.data.total} ranked players · ${query.data.you.points} RP`
            : "Finish a ranked fade to take your place."}
        </p>
      </header>
      {query.isPending && <p role="status">Checking the standings…</p>}
      {query.isError && (
        <p role="alert">
          Couldn’t load standings.{" "}
          <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {query.data && !query.data.leaders.length && (
        <p>The park is open. Be the first name on the wall.</p>
      )}
      {query.data && (
        <>
          <div className="park-global-orbit"><img className="park-global-globe" src={globeArt} alt="" aria-hidden="true" /><ol>
            {query.data.leaders
              .slice(0, expanded ? 20 : 3)
              .map((player, index) => (
                <li key={`${player.position}:${index}`} data-you={player.isYou}>
                  <b>#{player.position}</b>
                  <FighterPortrait
                    name={player.name}
                    avatarKey={player.avatarKey}
                    decorative
                  />
                  <div>
                    <strong>
                      {player.name}
                      {player.isYou ? " · YOU" : ""}
                    </strong>
                    <small>
                      {player.tier} · {player.wins} W / {player.games} played
                    </small>
                  </div>
                  <span>
                    {player.points.toLocaleString()}
                    <small>RP</small>
                  </span>
                </li>
              ))}
          </ol></div>
          {query.data.leaders.length > 3 && (
            <button
              className="standings-expand"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Close full standings" : "See the top 20 →"}
            </button>
          )}
          {query.data.you &&
            !query.data.leaders.some((player) => player.isYou) && (
              <p className="park-your-standing">
                Your position <b>#{query.data.you.position}</b> ·{" "}
                {query.data.you.tier} · {query.data.you.points} RP
              </p>
            )}
          <footer>
            Current preseason · shared ranks for equal RP · refreshed each
            minute
          </footer>
        </>
      )}
    </section>
  );
}
