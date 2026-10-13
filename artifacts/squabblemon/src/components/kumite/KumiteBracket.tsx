import { HandFist } from 'lucide-react';
import { emptyKumiteRounds, type KumiteMatch, type KumiteTournament } from '../../lib/kumite';
import { KumitePortrait } from './KumiteWinnerCard';

function Match({ match, index }: { match: KumiteMatch; index: number }) {
  return <article className="kumite-match" data-status={match.status} aria-label={`Round ${index + 1}, match ${match.slot + 1}: ${match.entrants.map(e => e?.name ?? 'Awaiting draw').join(' versus ')}`}>
    {match.entrants.map((entrant, side) => <div key={side} className={`kumite-match__entrant ${entrant && entrant.id === match.winner?.id ? 'is-winner' : ''}`}>
      <KumitePortrait hero={entrant?.hero} avatarKey={entrant?.avatarKey} />
      <span>{entrant?.name ?? (match.reason === 'bye' ? 'Bye' : match.reason === 'double-forfeit' ? 'Empty slot' : index === 0 ? 'Awaiting draw' : 'To be decided')}</span>
      {entrant && entrant.id === match.winner?.id && <HandFist size={14} aria-label="Winner" />}
    </div>)}
    {match.status === 'playing' && <small className="kumite-match__state">In the arena</small>}
    {match.reason && match.reason !== 'played' && <small className="kumite-match__state">{match.reason.replaceAll('-', ' ')}</small>}
  </article>;
}

/** The entire eight-person tournament: four quarterfinals, two semifinals, one final. */
export function KumiteBracket({ tournament }: { tournament: KumiteTournament }) {
  const rounds = tournament.finals.length ? tournament.finals : emptyKumiteRounds(null);
  return <div className="kumite-bracket">
    <div className="kumite-bracket__label"><h3>Eight fighters. One champion.</h3><span>{tournament.status === 'registration' ? 'Draw locks when registration closes' : 'Single elimination'}</span></div>
    <p className="kumite-bracket__hint" aria-hidden="true">Swipe to see the final <span>→</span></p>
    <div className="kumite-bracket__scroll" tabIndex={0} role="region" aria-label="Eight-person bracket. Scroll horizontally or use arrow keys; End reveals the final." onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      const rail = event.currentTarget;
      const left = event.key === 'ArrowRight' ? rail.scrollLeft + 140 : event.key === 'ArrowLeft' ? rail.scrollLeft - 140 : event.key === 'Home' ? 0 : event.key === 'End' ? rail.scrollWidth : null;
      if (left === null) return;
      event.preventDefault(); rail.scrollTo({ left });
    }}>
      <div className="kumite-bracket__tree">
        {rounds.map((round, index) => <div className="kumite-bracket__round" key={index}>
          <h4>{['QUARTERFINALS', 'SEMIFINALS', 'FINAL'][index]}</h4>
          <div className="kumite-bracket__matches">{round.map(match => <Match key={match.id} match={match} index={index} />)}</div>
        </div>)}
        <div className="kumite-bracket__champion"><span className="kumite-fist-seal"><HandFist aria-hidden="true" /></span><small>WEEKLY CHAMPION</small><strong>{tournament.champion?.name ?? 'Your name could be here'}</strong>{tournament.champion && <KumitePortrait hero={tournament.champion.hero} avatarKey={tournament.champion.avatarKey} />}</div>
      </div>
    </div>
    {tournament.status === 'registration' && <p className="kumite-bracket__note">{tournament.entrants.length} / {tournament.capacity} entrants registered. The draw is seeded when registration closes.</p>}
  </div>;
}
