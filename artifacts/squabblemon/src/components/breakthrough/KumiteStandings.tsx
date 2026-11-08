import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BreakthroughStanding, BreakthroughStandings } from '@workspace/api-zod';
import { breakthroughRequest } from '../../lib/breakthroughOnline';
import { FighterPortrait } from '../profile/FighterPortrait';
import { hallwayArt } from '../kumite/hallwayArt';
function Rank({ player }: { player: BreakthroughStanding }) {
  return <li data-you={player.isYou}>
    <b className="bt-standings__position">{String(player.position).padStart(2, '0')}</b>
    <FighterPortrait name={player.name} avatarKey={player.avatarKey} decorative />
    <div className="bt-standings__name"><strong>{player.name}{player.isYou && <em>YOU</em>}</strong><small>{player.automated ? 'AI · ' : ''}{player.wins} W / {player.games} PLAYED</small></div>
    <span className="bt-standings__score"><b>{player.trophies.toLocaleString()}</b><small>TROPHIES</small></span>
  </li>;
}
export function KumiteStandings({ profileId }: { profileId: string }) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, {rootMargin:'120px'});
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const query = useQuery({
    queryKey: ['breakthrough-standings', profileId],
    queryFn: ({signal}) => breakthroughRequest<BreakthroughStandings>('/standings', undefined, signal),
    enabled: visible, staleTime: 60000, refetchOnWindowFocus: false, retry: false,
  });
  const shown = query.data?.leaders.slice(0, expanded ? 20 : 3) ?? [];
  return <section ref={root} className="bt-standings" data-expanded={expanded} aria-labelledby="bt-world-title">
    <img className="bt-flyer-lobby__paper" src={hallwayArt.paper} alt="" draggable={false} />
    <header><div><small>KUMITE / GLOBAL PVP</small><h2 id="bt-world-title">WORLDWIDE.</h2></div><span>{query.data ? `${query.data.total} RANKED` : 'THE RANKS'}</span></header>
    {query.isPending && <p role="status">Checking the ranks…</p>}
    {query.isError && <p role="status">Standings unavailable. <button type="button" onClick={() => void query.refetch()}>Retry</button></p>}
    {query.data && <>
      {!shown.length && <p>Be the first name on the wall.</p>}
      <ol tabIndex={expanded ? 0 : undefined} aria-label="Kumite worldwide leaders">{shown.map((player, i) => <Rank key={`${player.position}:${i}`} player={player} />)}</ol>
      {query.data.you && !shown.some(player => player.isYou) && <ol className="bt-standings__you" aria-label="Your Kumite rank"><Rank player={query.data.you} /></ol>}
      {!query.data.you && <p className="bt-standings__note">Complete a rated match to claim your rank.</p>}
      {query.data.leaders.length > 3 && <button type="button" className="bt-standings__expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'FOLD THE RANKS ↑' : 'UNROLL TOP 20 ↓'}</button>}
    </>}
  </section>;
}
