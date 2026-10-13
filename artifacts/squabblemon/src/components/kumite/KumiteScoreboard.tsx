import { useId, useState } from 'react';
import { Check, Clock3, HandFist } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';
import { emptyKumiteRounds, kumiteCountdown, kumiteDate, type KumiteMatch, type KumiteRecords, type KumiteTournament, type KumiteWinner } from '../../lib/kumite';
import { KumiteLogo } from './KumiteBanner';
import { KumitePortrait } from './KumiteWinnerCard';
import { KumiteSideFlag } from './KumiteSideFlag';

const roundNames = ['Quarterfinals', 'Semifinals', 'Final'];

function FlagDate({ timestamp }: { timestamp: number }) {
  return <time dateTime={new Date(timestamp).toISOString()}><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(timestamp)}</span><span>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(timestamp)}</span></time>;
}

function fightDuration(durationMs: number) {
  const seconds = Math.floor(Math.max(0, durationMs) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function kumiteMatchTiming(match: KumiteMatch, now: number) {
  if (match.completedAt != null) return `${match.reason === 'played' ? 'Finished' : 'Resolved'} ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(match.completedAt)}${match.durationMs != null ? ` · ${fightDuration(match.durationMs)}` : ''}`;
  if (match.startedAt != null) return `Fighting · ${fightDuration(now - match.startedAt)} elapsed`;
  return match.deadline ? `Check in by ${kumiteDate(match.deadline)}` : 'Draw pending';
}

/** Eight editable seats on the hanging board. Artwork never supplies player names. */
export function KumiteScoreboard({ tournament, currentMatch, lastWinner, records, archiveStatus = 'ready', now }: {
  tournament: KumiteTournament; currentMatch?: KumiteMatch | null; lastWinner?: KumiteWinner; records?: KumiteRecords; archiveStatus?: 'pending' | 'error' | 'ready'; now: number;
}) {
  const id = useId();
  const [pickedRound, setPickedRound] = useState<number | null>(null);
  const [failedArt, setFailedArt] = useState(false);
  const activeRound = currentMatch?.round ?? (tournament.status === 'complete' ? 2 : Math.max(0, tournament.finals.findIndex(round => round.some(match => ['ready', 'playing'].includes(match.status)))));
  const round = pickedRound ?? activeRound;
  const matches = (tournament.finals.length ? tournament.finals : emptyKumiteRounds(null))[round] ?? [];
  return <section className="kumite-scoreboard-stage" aria-labelledby={id}>
    <div className="kumite-scoreboard__flags">
    <KumiteSideFlag title="This week" className="kumite-side-flag--dates">
      <dl><div><dt>Opens</dt><dd><FlagDate timestamp={tournament.registrationOpensAt} /></dd></div><div><dt>First fight</dt><dd><FlagDate timestamp={tournament.startsAt} /></dd></div><div><dt>Final deadline</dt><dd><FlagDate timestamp={tournament.endsAt} /></dd></div></dl>
      <div className="kumite-side-flag__clock"><Clock3 size={15} aria-hidden="true" /><span>{currentMatch ? 'ROUND DEADLINE' : tournament.status === 'registration' ? 'SIGN-UP CLOSES IN' : tournament.status === 'active' ? 'FINAL CLOSES IN' : 'FINISHED'}<strong>{tournament.status === 'registration' || tournament.status === 'active' ? kumiteCountdown(currentMatch?.deadline ?? (tournament.status === 'registration' ? tournament.startsAt : tournament.endsAt), now) : '—'}</strong></span></div>
      <p className="kumite-side-flag__format">8 players<br />3 rounds</p>
    </KumiteSideFlag>
    <KumiteSideFlag title="Fight records" className="kumite-side-flag--records">
      <div className="kumite-side-flag__fastest"><h3>FASTEST FIGHT</h3>{records?.fastestFight ? <><strong>{fightDuration(records.fastestFight.durationMs)}<small>.{String(Math.floor(records.fastestFight.durationMs % 1000)).padStart(3, '0')}</small></strong><span>{records.fastestFight.winner.name}</span><small>vs {records.fastestFight.opponent.name}</small></> : <p>No record yet.</p>}</div>
      <div className="kumite-side-flag__legends"><h3>RECENT WINNERS</h3>{records?.recentWinners.length ? <ol>{records.recentWinners.slice(0, 2).map(winner => <li key={winner.tournamentId}><HandFist size={12} aria-hidden="true" /><span title={winner.name}>{winner.name}</span></li>)}</ol> : tournament.champion ? <p>{tournament.champion.name}<Check size={12} aria-label="Current champion" /></p> : lastWinner ? <p>{lastWinner.name}</p> : <p>{archiveStatus === 'pending' ? 'Loading…' : archiveStatus === 'error' ? 'History unavailable' : 'No champions yet.'}</p>}</div>
      <div className="kumite-side-flag__legends"><h3>HAND THROWERS</h3>{records?.handThrowers.length ? <ol>{records.handThrowers.slice(0, 3).map(fighter => <li key={fighter.rank}><b>{fighter.rank}</b><span title={fighter.name}><strong>{fighter.name}</strong><small>{fighter.playedWins} W · {fighter.championships} titles</small></span></li>)}</ol> : <p>No ranked records yet.</p>}</div>
      {records && <small className="kumite-side-flag__scope">{records.scope}</small>}
    </KumiteSideFlag>
    </div>
    <div className="kumite-scoreboard">
    <div className="kumite-scoreboard__rounds" role="group" aria-label="Choose live scoreboard round">{roundNames.map((name, index) => <button type="button" key={name} aria-label={name} aria-pressed={round === index} onClick={() => setPickedRound(index)}><img className="kumite-scoreboard__round-cloth" src={getAssetUrl('assets/kumite/nav-flag.webp')} alt="" draggable={false} /><span>{['Quarters', 'Semis', 'Final'][index]}</span></button>)}</div>
    <div className={`kumite-scoreboard__frame ${failedArt ? 'kumite-scoreboard__frame--fallback' : ''}`}>
      {!failedArt && <img className="kumite-scoreboard__art" src={getAssetUrl('assets/kumite/scoreboard.webp')} alt="" draggable={false} decoding="async" onError={() => setFailedArt(true)} />}
      <header className="kumite-scoreboard__heading"><h2 id={id}>KUMITE</h2><span>{roundNames[round]} · {tournament.weekLabel}</span></header>
      <div className="kumite-scoreboard__matches">{Array.from({ length: 4 }, (_, index) => {
        const match = matches[index];
        if (!match) return <div key={`vacant-${index}`} className="kumite-scoreboard__row kumite-scoreboard__row--vacant" aria-hidden="true"><KumiteLogo decorative /><span>—</span><KumiteLogo decorative /></div>;
        return <article key={match.id} className="kumite-scoreboard__row" data-status={match.status} aria-label={`${roundNames[round]} match ${index + 1}: ${match.entrants.map(entrant => entrant?.name ?? 'Awaiting draw').join(' versus ')}`}>
          {match.entrants.map((entrant, side) => <div key={side} className={`kumite-scoreboard__seat ${entrant && match.winner?.id === entrant.id ? 'is-winner' : ''} ${entrant ? '' : 'is-empty'}`}>
            {entrant && <KumitePortrait hero={entrant.hero} avatarKey={entrant.avatarKey} />}
            <div><strong title={entrant?.name}>{entrant?.name ?? <span aria-label={match.reason === 'bye' ? 'Bye' : match.reason === 'double-forfeit' ? 'Empty seat' : round === 0 ? 'Awaiting draw' : 'Awaiting winner'}>—</span>}</strong>{entrant && <small>{match.winner?.id === entrant.id ? 'WINNER' : match.status === 'complete' ? 'OUT' : match.status === 'playing' ? 'FIGHTING' : match.checkedIn[side] ? 'CHECKED IN' : match.status === 'ready' ? 'CHECK IN OPEN' : '—'}</small>}</div>
            {entrant && match.winner?.id === entrant.id && <HandFist size={12} aria-label="Winner" />}
          </div>)}
          <span className="kumite-scoreboard__versus" aria-hidden="true">VS</span>
          {(match.entrants.some(Boolean) || match.deadline > 0 || match.status !== 'pending') && <p className="kumite-scoreboard__time"><Clock3 size={10} aria-hidden="true" />{kumiteMatchTiming(match, now)}{match.status === 'playing' && match.deadline ? ` · ${kumiteCountdown(match.deadline, now)} left` : ''}</p>}
        </article>;
      })}</div>
    </div>
    </div>
  </section>;
}
